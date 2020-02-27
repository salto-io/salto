/*
*                      Copyright 2020 Salto Labs Ltd.
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

import { File, DirectoryStore } from '../dir_store/dir_store'

export type StaticAssetStore = {
}

const loadStaticAssetSource = (
  sourceBaseDir: string,
  localStorage: string
): StaticAssetSource => {
  const blueprintsStore = localDirectoryStore(
    sourceBaseDir,
    `*${BP_EXTENSION}`,
    (dirParh: string) => !excludeDirs.includes(dirParh),
  )
  const cacheStore = localDirectoryStore(path.join(localStorage, '.cache'))
  return blueprintsSource(blueprintsStore, parseResultCache(cacheStore))
}}


export const loadMultienvStaticAssetSource = (): number => StaticAssetStore
export type StaticAsset = File & {
  hash?: string
  mimetype?: string
}
