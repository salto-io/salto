
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
import path from 'path'
import { nacl, staticFiles, adaptersConfigSource as acs, remoteMap } from '@salto-io/workspace'
import { DetailedChange, ObjectType } from '@salto-io/adapter-api'
import { localDirectoryStore, createExtensionFileFilter } from './dir_store'
import { buildLocalStaticFilesCache } from './static_files_cache'

const createNaclSource = async (
  baseDir: string,
  localStorage: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  persistent: boolean,
) : Promise<nacl.NaclFilesSource> => {
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
    buildLocalStaticFilesCache(localStorage, 'config-cache'),
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

export const buildLocalAdaptersConfigSource = async (
  baseDir: string,
  localStorage: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  persistent: boolean,
  configTypes: ObjectType[],
  configOverrides: DetailedChange[] = [],
): Promise<acs.AdaptersConfigSource> => acs.buildAdaptersConfigSource({
  naclSource: await createNaclSource(baseDir, localStorage, remoteMapCreator, persistent),
  ignoreFileChanges: false,
  remoteMapCreator,
  persistent,
  configTypes,
  configOverrides,
})
