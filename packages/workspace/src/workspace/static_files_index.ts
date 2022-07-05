/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Change, getChangeData, Element, toChange } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _, { isEmpty } from 'lodash'
import { ElementsSource } from './elements_source'
import { RemoteMap } from './remote_map'
import { LazyStaticFile } from './static_files'

const { awu } = collections.asynciterable
const log = logger(module)
export const STATIC_FILES_INDEX_VERSION = 1
const STATIC_FILES_INDEX_KEY = 'static_files_index'

const getAllElementsChanges = async (
  currentChanges: Change<Element>[],
  elementsSource: ElementsSource
): Promise<Change<Element>[]> =>
  awu(await elementsSource.getAll())
    .map(element => toChange({ after: element }))
    .concat(currentChanges)
    .toArray()

const getStaticFilesPaths = (element: Element): string[] => {
  const staticFilesPaths: string[] = []
  walkOnElement({
    element,
    func: ({ value }) => {
      if (value instanceof LazyStaticFile) {
        staticFilesPaths.push(value.filepath)
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })
  return staticFilesPaths
}

const updateChanges = async (
  changes: Change<Element>[],
  index: RemoteMap<string[]>
): Promise<void> => {
  const staticFilesMap = Object.fromEntries(
    changes
      .map(getChangeData)
      .map(element => [element.elemID.getFullName(), getStaticFilesPaths(element)])
  )
  const [toBeRemoved, toBeSet] = _.partition(
    Object.keys(staticFilesMap),
    key => isEmpty(staticFilesMap[key]),
  )
  await index.setAll(toBeSet
    .map(key => ({ key, value: Array.from(staticFilesMap[key]) })))
  await index.deleteAll(toBeRemoved)
}

export const updateStaticFilesIndex = async (
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
      log.info('cache is invalid, re-indexing static files index')
    }
    await Promise.all([
      staticFilesIndex.clear(),
      mapVersions.set(STATIC_FILES_INDEX_KEY, STATIC_FILES_INDEX_VERSION),
    ])
  }
  await updateChanges(relevantChanges, staticFilesIndex)
}, 'updating static files index')
