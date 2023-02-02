/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { DetailedChange, ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, SaltoError } from '@salto-io/adapter-api'
import { applyDetailedChanges, buildElementsSourceFromElements, detailedCompare, transformElement } from '@salto-io/adapter-utils'
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

export type PartialNaclFilesSource = Pick<NaclFilesSource, 'getErrors' | 'getSourceRanges' | 'getNaclFile' | 'setNaclFiles' | 'flush' | 'getParsedNaclFile' | 'getSourceMap' | 'listNaclFiles'>

const { awu } = collections.asynciterable

const VALIDATION_ERRORS_NAMESPACE = 'workspace-salto.config/adapters-validationErrors'
export const CONFIG_PATH = ['salto.config', 'adapters']

export type AdaptersConfigSource = {
  getAdapter(adapter: string, defaultValue?: InstanceElement): Promise<InstanceElement | undefined>
  setAdapter(
    account: string,
    adapter: string,
    config: Readonly<InstanceElement> | Readonly<InstanceElement>[]
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
  const validationErrors = await validateElements(
    await awu(await naclSource.getAll()).toArray(),
    elementsSource
  )

  await validationErrorsMap.clear()
  await validationErrorsMap.setAll(
    _(validationErrors)
      .groupBy(err => err.elemID.createTopLevelParentID().parent.getFullName())
      .entries()
      .map(([key, value]) => ({ key, value }))
      .value()
  )
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
      !(await configElementsSource.get(configTypeID))
      && additionalConfigs[configTypeID.getFullName()] === undefined
    ) {
      const accountConfigType = (await configElementsSource.get(
        createAdapterReplacedID(configTypeID, adapter)
      )).clone()
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

  let elementsSource = buildElementsSourceFromElements(updatedConfigTypes, naclSource)

  const validationErrorsMap = await remoteMapCreator<ValidationError[]>({
    namespace: VALIDATION_ERRORS_NAMESPACE,
    serialize: validationErrors => serialize(validationErrors, 'keepRef'),
    deserialize: async data => deserializeValidationErrors(data),
    persistent,
  })

  if (!changes.cacheValid || changes.changes.length !== 0) {
    await updateValidationErrorsCache(validationErrorsMap, elementsSource, naclSource)
  }

  const overwriteNacl = async (
    configs: InstanceElement | InstanceElement[],
  ): Promise<void> => {
    // This function first removes the existing configuration and then adds the new configuration
    // instead of creating a "modify" change so the config element will be split exactly like the
    // new configuration and not like the old one

    const configsArr = collections.array.makeArray(configs)

    await naclSource.updateNaclFiles(_.uniqBy(configsArr, conf => conf.elemID.getFullName())
      .map(conf => ({
        id: conf.elemID, action: 'remove', data: { before: conf },
      })))
    // If flush is not called here the removal seems to be ignored
    await naclSource.flush()

    const removeUndefined = async (instance: InstanceElement): Promise<InstanceElement> =>
      transformElement({
        element: instance,
        strict: false,
        allowEmpty: true,
        transformFunc: ({ value }) => value,
        elementsSource: naclSource,
      })

    const configsToUpdate = await Promise.all(configsArr.map(removeUndefined))
    await naclSource.updateNaclFiles(
      configsToUpdate.map(conf => ({
        id: conf.elemID, action: 'add', data: { after: conf }, path: [...CONFIG_PATH, conf.elemID.adapter, ...conf.path ?? [conf.elemID.adapter]],
      }))
    )
  }

  const getConfigWithoutOverrides = (adapter: string): Promise<InstanceElement | undefined> => (
    naclSource.get(new ElemID(adapter, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME))
  )

  const validateConfigChanges = (configChanges: DetailedChange[]): void => {
    const updatedOverriddenIds = configOverrides.filter(
      overiddeChange => configChanges.some(
        updateChange => updateChange.id.isParentOf(overiddeChange.id)
          || overiddeChange.id.isParentOf(updateChange.id)
          || overiddeChange.id.isEqual(updateChange.id)
      )
    )

    if (updatedOverriddenIds.length !== 0) {
      throw new Error(`cannot update fields that were overridden by the user: ${updatedOverriddenIds.map(change => change.id.getFullName())}`)
    }
  }

  const createConfigError = <T extends SaltoError>(error: T): T => {
    const configError = _.clone(error)
    configError.source = 'config'
    return configError
  }

  return {
    getAdapter: async (adapter, defaultValue) => {
      const conf = (await getConfigWithoutOverrides(adapter) ?? defaultValue)?.clone()
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
        elementsSource = buildElementsSourceFromElements(
          updatedConfigTypes,
          naclSource
        )
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
    getElementNaclFiles: async adapter => (await naclSource.listNaclFiles())
      .filter(filePath => filePath.startsWith(path.join(...CONFIG_PATH, adapter).concat(path.sep))),

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
