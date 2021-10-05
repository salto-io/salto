
/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import path from 'path'
import { workspaceConfigSource as wcs,
  nacl, staticFiles, merger, adaptersConfigSource as acs, remoteMap } from '@salto-io/workspace'
import { DetailedChange, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { applyDetailedChanges, detailedCompare, transformValues } from '@salto-io/adapter-utils'
import { localDirectoryStore } from './dir_store'
import { buildLocalStaticFilesCache } from './static_files_cache'

export type WorkspaceConfigSource = wcs.WorkspaceConfigSource & {
  localStorage: string
}

const removeUndefined = async (instance: InstanceElement): Promise<InstanceElement> => {
  const transformedElement = instance.clone()
  transformedElement.value = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    strict: false,
    allowEmpty: true,
    transformFunc: ({ value }) => value,
  }) ?? {}
  return transformedElement
}


const createNaclSource = async (
  baseDir: string,
  localStorage: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  persistent: boolean,
)
  : Promise<nacl.NaclFilesSource> => {
  const naclFilesStore = localDirectoryStore({
    baseDir: path.join(baseDir, 'salto.config', 'adapters'),
    encoding: 'utf8',
    fileFilter: `*${nacl.FILE_EXTENSION}`,
  })

  const naclStaticFilesStore = localDirectoryStore({
    baseDir: path.join(baseDir, 'salto.config', 'adapters'),
    nameSuffix: 'static-resources',
  })

  const staticFileSource = staticFiles.buildStaticFilesSource(
    naclStaticFilesStore,
    buildLocalStaticFilesCache(localStorage, 'config-cache'),
  )

  const source = await nacl.naclFilesSource(
    'salto.config/adapters',
    naclFilesStore,
    staticFileSource,
    remoteMapCreator,
    persistent,
  )
  await source.load({})
  const errors = await source.getErrors()
  if (errors.hasErrors()) {
    throw new Error(`failed to load config file: ${errors.strings()}`)
  }
  return source
}

export const adaptersConfigSource = async (
  baseDir: string,
  localStorage: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  persistent: boolean,
  configOverrides: DetailedChange[] = [],
): Promise<acs.AdaptersConfigSource> => {
  const configOverridesById = _.groupBy(configOverrides, change => change.id.adapter)

  const applyConfigOverrides = (conf: InstanceElement): void => {
    const overridesForInstance = configOverridesById[conf.elemID.adapter] ?? []
    applyDetailedChanges(conf, overridesForInstance)
  }

  const naclSource = await createNaclSource(baseDir, localStorage, remoteMapCreator, persistent)

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

    const configsToUpdate = await Promise.all(configsArr.map(removeUndefined))
    await naclSource.updateNaclFiles(
      configsToUpdate.map(conf => ({
        id: conf.elemID, action: 'add', data: { after: conf }, path: conf.path ?? [conf.elemID.adapter],
      }))
    )
  }

  const getConfigWithoutOverrides = (adapter: string): Promise<InstanceElement | undefined> => naclSource.get(new ElemID(adapter, ElemID.CONFIG_NAME, 'instance'))

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

  return {
    getAdapter: async (adapter, defaultValue) => {
      const conf = (await getConfigWithoutOverrides(adapter) ?? defaultValue)?.clone()
      if (conf === undefined) {
        return undefined
      }
      applyConfigOverrides(conf)
      return conf
    },

    setAdapter: async (adapter, configs) => {
      const configsToUpdate = collections.array.makeArray(configs).map(e => e.clone())
      const currConfWithoutOverrides = await getConfigWithoutOverrides(adapter)
      // Could happen at the initialization of a service.
      if (currConfWithoutOverrides === undefined) {
        await overwriteNacl(configsToUpdate)
        await naclSource.flush()
        return
      }
      const currConf = currConfWithoutOverrides.clone()
      applyConfigOverrides(currConf)

      const mergedConfig = await merger.mergeSingleElement(configsToUpdate)
      const configChanges = await detailedCompare(currConf, mergedConfig)

      validateConfigChanges(configChanges)

      await overwriteNacl(configsToUpdate)
      const overridesForInstance = configOverridesById[adapter]
      if (overridesForInstance !== undefined) {
        // configs includes the configuration overrides which we wouldn't want
        // to save so here we remove the configuration overrides from the NaCl
        const reversedOverrides = await detailedCompare(currConf, currConfWithoutOverrides)
        await naclSource.updateNaclFiles(reversedOverrides)
      }
      await naclSource.flush()
    },
    getElementNaclFiles: async adapter => (await naclSource.getElementNaclFiles(
      new ElemID(adapter, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME)
    )).map(filePath => path.join('salto.config', 'adapters', filePath)),
  }
}
