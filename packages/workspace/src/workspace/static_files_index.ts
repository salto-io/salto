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
import { Change, getChangeData, Element, isAdditionOrModificationChange, isRemovalChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _, { isEmpty } from 'lodash'
import { ElementsSource } from './elements_source'
import { getAllElementsChanges } from './index_utils'
import { getNestedStaticFiles } from './nacl_files'
import { RemoteMap } from './remote_map'

const log = logger(module)
export const STATIC_FILES_INDEX_VERSION = 1
const STATIC_FILES_INDEX_KEY = 'static_files_index'

const updateChanges = async (
  changes: Change<Element>[],
  index: RemoteMap<string[]>
): Promise<void> => {
  const staticFilesMap = Object.fromEntries(
    changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .map(element => [
        element.elemID.getFullName(),
        getNestedStaticFiles(element).map(staticFile => staticFile.filepath),
      ])
  )
  const [toBeRemoved, toBeSet] = _.partition(
    Object.keys(staticFilesMap),
    key => isEmpty(staticFilesMap[key]),
  )
  const removedElementIds = changes
    .filter(isRemovalChange)
    .map(getChangeData)
    .map(element => element.elemID.getFullName())
  await index.setAll(toBeSet
    .map(key => ({ key, value: staticFilesMap[key] })))
  await index.deleteAll(toBeRemoved.concat(removedElementIds))
}

export const updateReferencedStaticFilesIndex = async (
  changes: Change<Element>[],
  staticFilesIndex: RemoteMap<string[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
): Promise<void> => log.time(async () => {
  let relevantChanges = changes
  const isVersionMatch = await mapVersions.get(STATIC_FILES_INDEX_KEY)
    === STATIC_FILES_INDEX_VERSION
  if (!isCacheValid || !isVersionMatch) {
    if (!isVersionMatch) {
      relevantChanges = await getAllElementsChanges(changes, elementsSource)
      log.info('static files index is out of date, re-indexing')
    }
    if (!isCacheValid) {
      // When cache is invalid, changes will include all of the elements in the workspace.
      log.info('cache is invalid, re-indexing static files index')
    }
    await Promise.all([
      staticFilesIndex.clear(),
      mapVersions.set(STATIC_FILES_INDEX_KEY, STATIC_FILES_INDEX_VERSION),
    ])
  }
  await updateChanges(relevantChanges, staticFilesIndex)
}, 'updating static files index')
