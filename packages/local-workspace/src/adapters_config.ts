/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'
import {
  nacl,
  staticFiles,
  adaptersConfigSource as acs,
  remoteMap,
  buildStaticFilesCache,
  EnvConfig,
  getAdapterConfigsPerAccount,
} from '@salto-io/workspace'
import { Adapter, DetailedChange, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { localDirectoryStore, createExtensionFileFilter } from './dir_store'

const createNaclSource = async (
  baseDir: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  persistent: boolean,
): Promise<nacl.NaclFilesSource> => {
  const naclFilesStore = localDirectoryStore({
    baseDir,
    accessiblePath: path.join(...acs.CONFIG_PATH),
    fileFilter: createExtensionFileFilter(nacl.FILE_EXTENSION),
    encoding: 'utf8',
  })

  const naclStaticFilesStore = localDirectoryStore({
    baseDir: path.join(baseDir, ...acs.CONFIG_PATH),
    nameSuffix: 'static-resources',
  })

  const staticFileSource = staticFiles.buildStaticFilesSource(
    naclStaticFilesStore,
    buildStaticFilesCache('config-cache', remoteMapCreator, persistent),
  )

  const source = await nacl.naclFilesSource(
    'salto.config/adapters',
    naclFilesStore,
    staticFileSource,
    remoteMapCreator,
    persistent,
  )
  return source
}

type BuildLocalAdaptersConfigSourceParams = {
  baseDir: string
  remoteMapCreator: remoteMap.RemoteMapCreator
  persistent: boolean
  configTypes?: ObjectType[]
  configOverrides?: DetailedChange[]
  adapterCreators: Record<string, Adapter>
  envs: EnvConfig[]
}

export async function buildLocalAdaptersConfigSource(
  args: BuildLocalAdaptersConfigSourceParams,
): Promise<acs.AdaptersConfigSource> {
  const {
    baseDir,
    remoteMapCreator,
    persistent,
    envs,
    adapterCreators,
    configTypes = await getAdapterConfigsPerAccount(envs, adapterCreators),
    configOverrides = [],
  } = args
  return acs.buildAdaptersConfigSource({
    naclSource: await createNaclSource(baseDir, remoteMapCreator, persistent),
    ignoreFileChanges: false,
    remoteMapCreator,
    persistent,
    configTypes,
    configOverrides,
  })
}
