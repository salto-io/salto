
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
import { applyDetailedChanges, detailedCompare } from '@salto-io/adapter-utils'
import { localDirectoryStore } from './dir_store'
import { buildLocalStaticFilesCache } from './static_files_cache'

const { awu } = collections.asynciterable

export type WorkspaceConfigSource = wcs.WorkspaceConfigSource & {
  localStorage: string
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

  const setUnsafe = async (configs: Readonly<InstanceElement> | Readonly<InstanceElement>[]):
  Promise<void> => {
    // This functions first remove the existing configuration and then add the new configuration
    // instead of creating a "modify" change to the configuration so the config element will
    // be splitted exactly like the new configuration and not like the old one

    const configsArr = collections.array.makeArray(configs)
    await Promise.all(_(configsArr)
      .map(conf => conf.elemID)
      .uniqBy(id => id.getFullName())
      .map(async id => naclSource.removeNaclFiles(...await naclSource.getElementNaclFiles(id)))
      .value())
    // If flush is not called here the removal seems to be ignore
    await naclSource.flush()
    await naclSource.updateNaclFiles(
      configsArr.map(conf => ({
        id: conf.elemID, action: 'add', data: { after: conf }, path: conf.path ?? [conf.elemID.adapter],
      }))
    )
    await naclSource.flush()
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
      const currConfWithoutOverrides = await getConfigWithoutOverrides(adapter)
      // Could happen at the initialization of a service.
      if (currConfWithoutOverrides === undefined) {
        await setUnsafe(configs)
        return
      }
      const currConf = currConfWithoutOverrides.clone()
      applyConfigOverrides(currConf)

      const [mergeConfig] = await awu(
        await (
          await merger.mergeElements(awu(collections.array.makeArray(configs)).map(e => e.clone()))
        ).merged.values()
      ).toArray() as [InstanceElement]

      const configChanges = await detailedCompare(currConf, mergeConfig)

      validateConfigChanges(configChanges)

      await setUnsafe(configs)
      const overridesForInstance = configOverridesById[adapter]
      if (overridesForInstance !== undefined) {
        const reversedOverrides = await detailedCompare(currConf, currConfWithoutOverrides)
        await naclSource.updateNaclFiles(reversedOverrides)
        await applyDetailedChanges(mergeConfig, reversedOverrides)
      }
      await naclSource.flush()
    },
    source: naclSource,
  }
}
