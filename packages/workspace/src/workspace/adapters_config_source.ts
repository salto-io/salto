/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Adapter,
  DetailedChange,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  SaltoError,
  toChange,
} from '@salto-io/adapter-api'
import {
  applyDetailedChanges,
  buildElementsSourceFromElements,
  detailedCompare,
  getDetailedChanges,
  getSubtypes,
  transformElement,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import path from 'path'
import { createAdapterReplacedID, updateElementsWithAlternativeAccount } from '../element_adapter_rename'
import { mergeSingleElement } from '../merger'
import { serialize } from '../serializer'
import { deserializeValidationErrors } from '../serializer/elements'
import { validateElements, ValidationError } from '../validator'
import { Errors } from './errors'
import { NaclFilesSource } from './nacl_files'
import { RemoteMap, RemoteMapCreator } from './remote_map'
import { EnvConfig } from './config/workspace_config_types'
import { createInMemoryElementSource } from './elements_source'

export type PartialNaclFilesSource = Pick<
  NaclFilesSource,
  | 'getErrors'
  | 'getSourceRanges'
  | 'getNaclFile'
  | 'setNaclFiles'
  | 'flush'
  | 'getParsedNaclFile'
  | 'getSourceMap'
  | 'listNaclFiles'
>

const { awu } = collections.asynciterable

const VALIDATION_ERRORS_NAMESPACE = 'workspace-salto.config/adapters-validationErrors'
export const CONFIG_PATH = ['salto.config', 'adapters']

export type AdaptersConfigSource = {
  getAdapter(adapter: string, defaultValue?: InstanceElement): Promise<InstanceElement | undefined>
  setAdapter(
    account: string,
    adapter: string,
    config: Readonly<InstanceElement> | Readonly<InstanceElement>[],
  ): Promise<void>
  getElementNaclFiles(adapter: string): Promise<string[]>
  getElements(): ReadOnlyElementsSource
  isConfigFile(filePath: string): boolean
} & PartialNaclFilesSource

const updateValidationErrorsCache = async (
  validationErrorsMap: RemoteMap<ValidationError[]>,
  elementsSource: ReadOnlyElementsSource,
  naclSource: NaclFilesSource,
): Promise<void> => {
  const elementsToValidate = await awu(await naclSource.getAll()).toArray()
  await validationErrorsMap.clear()
  const errors = await validateElements(elementsToValidate, elementsSource)
  await validationErrorsMap.setAll(errors)
}

export type AdaptersConfigSourceArgs = {
  naclSource: NaclFilesSource
  ignoreFileChanges: boolean
  remoteMapCreator: RemoteMapCreator
  persistent: boolean
  configTypes: ObjectType[]
  configOverrides?: DetailedChange[]
}

export const calculateAdditionalConfigTypes = async (
  configElementsSource: ReadOnlyElementsSource,
  configTypeIDs: ElemID[],
  adapter: string,
  account: string,
): Promise<ObjectType[]> => {
  const additionalConfigs: Record<string, ObjectType[]> = {}
  await awu(configTypeIDs).forEach(async configTypeID => {
    if (
      !(await configElementsSource.get(configTypeID)) &&
      additionalConfigs[configTypeID.getFullName()] === undefined
    ) {
      const accountConfigType = (await configElementsSource.get(createAdapterReplacedID(configTypeID, adapter))).clone()
      await updateElementsWithAlternativeAccount([accountConfigType], account, adapter)
      additionalConfigs[configTypeID.getFullName()] = accountConfigType
    }
  })
  return Object.values(additionalConfigs).flat()
}

export const buildAdaptersConfigSource = async ({
  naclSource,
  ignoreFileChanges,
  remoteMapCreator,
  persistent,
  configTypes,
  configOverrides = [],
}: AdaptersConfigSourceArgs): Promise<AdaptersConfigSource> => {
  const configOverridesById = _.groupBy(configOverrides, change => change.id.adapter)

  const applyConfigOverrides = (conf: InstanceElement): void => {
    const overridesForInstance = configOverridesById[conf.elemID.adapter] ?? []
    applyDetailedChanges(conf, overridesForInstance)
  }
  const updatedConfigTypes = [...configTypes]
  const changes = await naclSource.load({ ignoreFileChanges })

  let elementsSource = buildElementsSourceFromElements(updatedConfigTypes, [naclSource])

  const validationErrorsMap = await remoteMapCreator.create<ValidationError[]>({
    namespace: VALIDATION_ERRORS_NAMESPACE,
    serialize: validationErrors => serialize(validationErrors, 'keepRef'),
    deserialize: async data => deserializeValidationErrors(data),
    persistent,
  })

  if (!changes.cacheValid || changes.changes.length !== 0) {
    await updateValidationErrorsCache(validationErrorsMap, elementsSource, naclSource)
  }

  const overwriteNacl = async (configs: InstanceElement | InstanceElement[]): Promise<void> => {
    // This function first removes the existing configuration and then adds the new configuration
    // instead of creating a "modify" change so the config element will be split exactly like the
    // new configuration and not like the old one

    const configsArr = collections.array.makeArray(configs)

    await naclSource.updateNaclFiles(
      _.uniqBy(configsArr, conf => conf.elemID.getFullName()).flatMap(conf =>
        getDetailedChanges(toChange({ before: conf })),
      ),
    )

    const removeUndefined = async (instance: InstanceElement): Promise<InstanceElement> =>
      transformElement({
        element: instance,
        strict: false,
        allowEmptyArrays: true,
        allowEmptyObjects: true,
        transformFunc: ({ value }) => value,
        elementsSource: naclSource,
      })

    const configsToUpdate = await Promise.all(configsArr.map(removeUndefined))
    await naclSource.updateNaclFiles(
      configsToUpdate.flatMap(conf =>
        getDetailedChanges(toChange({ after: conf })).map(change => ({
          ...change,
          path: [...CONFIG_PATH, conf.elemID.adapter, ...(conf.path ?? [conf.elemID.adapter])],
        })),
      ),
    )
  }

  const getConfigWithoutOverrides = (adapter: string): Promise<InstanceElement | undefined> =>
    naclSource.get(new ElemID(adapter, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME))

  const validateConfigChanges = (configChanges: DetailedChange[]): void => {
    const updatedOverriddenIds = configOverrides.filter(overiddeChange =>
      configChanges.some(
        updateChange =>
          updateChange.id.isParentOf(overiddeChange.id) ||
          overiddeChange.id.isParentOf(updateChange.id) ||
          overiddeChange.id.isEqual(updateChange.id),
      ),
    )

    if (updatedOverriddenIds.length !== 0) {
      throw new Error(
        `cannot update fields that were overridden by the user: ${updatedOverriddenIds.map(change => change.id.getFullName())}`,
      )
    }
  }

  const createConfigError = <T extends SaltoError>(error: T): T => {
    const configError = _.clone(error)
    configError.type = 'config'
    return configError
  }

  return {
    getAdapter: async (adapter, defaultValue) => {
      const conf = ((await getConfigWithoutOverrides(adapter)) ?? defaultValue)?.clone()
      if (conf === undefined) {
        return undefined
      }
      applyConfigOverrides(conf)
      return conf
    },
    setAdapter: async (account, adapter, configs) => {
      if (account !== adapter) {
        const additionalConfigs = await calculateAdditionalConfigTypes(
          elementsSource,
          [configs].flat().map(config => config.refType.elemID),
          adapter,
          account,
        )
        updatedConfigTypes.push(...additionalConfigs)
        elementsSource = buildElementsSourceFromElements(updatedConfigTypes, [naclSource])
      }
      const configsToUpdate = collections.array.makeArray(configs).map(e => e.clone())
      const currConfWithoutOverrides = await getConfigWithoutOverrides(account)
      // Could happen at the initialization of an account.
      if (currConfWithoutOverrides === undefined) {
        await overwriteNacl(configsToUpdate)
        await updateValidationErrorsCache(validationErrorsMap, elementsSource, naclSource)
        return
      }
      const currConf = currConfWithoutOverrides.clone()
      applyConfigOverrides(currConf)

      const mergedConfig = await mergeSingleElement(configsToUpdate)
      const configChanges = detailedCompare(currConf, mergedConfig)

      validateConfigChanges(configChanges)

      await overwriteNacl(configsToUpdate)
      const overridesForInstance = configOverridesById[account]
      if (overridesForInstance !== undefined) {
        // configs includes the configuration overrides which we wouldn't want
        // to save so here we remove the configuration overrides from the NaCl
        const reversedOverrides = detailedCompare(currConf, currConfWithoutOverrides)
        await naclSource.updateNaclFiles(reversedOverrides)
      }
      await updateValidationErrorsCache(validationErrorsMap, elementsSource, naclSource)
    },
    getElementNaclFiles: async adapter =>
      (await naclSource.listNaclFiles()).filter(filePath =>
        filePath.startsWith(path.join(...CONFIG_PATH, adapter).concat(path.sep)),
      ),

    getErrors: async () => {
      const validationErrors = await awu(validationErrorsMap.values()).flat().toArray()
      const naclErrors = await naclSource.getErrors()

      return new Errors({
        parse: naclErrors.parse.map(createConfigError),
        merge: naclErrors.merge.map(createConfigError),
        validation: validationErrors.map(createConfigError),
      })
    },
    getSourceRanges: naclSource.getSourceRanges,
    getNaclFile: naclSource.getNaclFile,
    setNaclFiles: async files => {
      const res = await naclSource.setNaclFiles(files)
      await updateValidationErrorsCache(validationErrorsMap, elementsSource, naclSource)
      return res
    },
    flush: async () => {
      await naclSource.flush()
      await validationErrorsMap.flush()
    },
    getElements: () => elementsSource,
    getParsedNaclFile: naclSource.getParsedNaclFile,
    getSourceMap: naclSource.getSourceMap,
    listNaclFiles: naclSource.listNaclFiles,
    isConfigFile: filePath => filePath.startsWith(path.join(...CONFIG_PATH)),
  }
}
export const getAdaptersConfigTypesMap = (adapterCreators: Record<string, Adapter>): Record<string, ObjectType[]> =>
  Object.fromEntries(
    Object.entries(
      _.mapValues(adapterCreators, adapterCreator =>
        adapterCreator.configType ? [adapterCreator.configType, ...getSubtypes([adapterCreator.configType], true)] : [],
      ),
    ).filter(entry => entry[1].length > 0),
  )
export const getAdapterConfigsPerAccount = async (
  envs: EnvConfig[],
  adapterCreators: Record<string, Adapter>,
): Promise<ObjectType[]> => {
  const configTypesByAccount = getAdaptersConfigTypesMap(adapterCreators)
  const configElementSource = createInMemoryElementSource(Object.values(configTypesByAccount).flat())
  const differentlyNamedAccounts = Object.fromEntries(
    envs
      .flatMap(env => Object.entries(env.accountToServiceName ?? {}))
      .filter(([accountName, serviceName]) => accountName !== serviceName),
  )
  await awu(Object.keys(differentlyNamedAccounts)).forEach(async account => {
    const adapter = differentlyNamedAccounts[account]
    const adapterConfigs = configTypesByAccount[adapter]
    const additionalConfigs = await calculateAdditionalConfigTypes(
      configElementSource,
      adapterConfigs.map(conf => createAdapterReplacedID(conf.elemID, account)),
      adapter,
      account,
    )
    configTypesByAccount[account] = additionalConfigs
  })
  return Object.values(configTypesByAccount).flat()
}
