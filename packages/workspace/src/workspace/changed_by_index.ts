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
import {
  Change,
  ElemID,
  getChangeData,
  Element,
  toChange,
  CORE_ANNOTATIONS,
  ModificationChange,
  AdditionChange,
  RemovalChange,
  isAdditionChange,
  isRemovalChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import _, { isEmpty } from 'lodash'
import { ElementsSource } from './elements_source'
import { RemoteMap } from './remote_map'

const { isDefined } = values

const { awu } = collections.asynciterable

const log = logger(module)
export const CHANGED_BY_INDEX_VERSION = 12
const CHANGED_BY_INDEX_KEY = 'changed_by_index'
const UNKNOWN_USER_NAME = 'Unknown'
const CHANGED_BY_KEY_DELIMITER = '@@'

const getAllElementsChanges = async (
  currentChanges: Change<Element>[],
  elementsSource: ElementsSource
): Promise<Change<Element>[]> =>
  awu(await elementsSource.getAll())
    .map(element => toChange({ after: element }))
    .concat(currentChanges)
    .toArray()

const getChangeAuthor = (change: Change<Element>): string => {
  const element = getChangeData(change)
  if (element.annotations[CORE_ANNOTATIONS.CHANGED_BY]) {
    return `${element.elemID.adapter}${CHANGED_BY_KEY_DELIMITER}${
      element.annotations[CORE_ANNOTATIONS.CHANGED_BY]
    }`
  }
  return UNKNOWN_USER_NAME
}

const updateAdditionChange = async (
  change: AdditionChange<Element>,
  authorMap: Record<string, Set<ElemID>>,
): Promise<void> => {
  const author = getChangeAuthor(change)
  if (!authorMap[author]) {
    authorMap[author] = new Set()
  }
  authorMap[author].add(change.data.after.elemID)
}

const updateRemovalChange = async (
  change: RemovalChange<Element>,
  authorMap: Record<string, Set<ElemID>>,
): Promise<void> => {
  const author = getChangeAuthor(change)
  if (!authorMap[author]) {
    authorMap[author] = new Set()
  }
  authorMap[author].delete(change.data.before.elemID)
}

const updateModificationChange = async (
  change: ModificationChange<Element>,
  authorMap: Record<string, Set<ElemID>>,
): Promise<void> => {
  if (!change.data.after.annotations[CORE_ANNOTATIONS.CHANGED_BY]
    === change.data.before.annotations[CORE_ANNOTATIONS.CHANGED_BY]) {
    await updateRemovalChange(
      toChange({ before: change.data.before }) as RemovalChange<Element>,
      authorMap,
    )
    await updateAdditionChange(
      toChange({ after: change.data.after }) as AdditionChange<Element>,
      authorMap,
    )
  }
}

const updateChange = async (
  change: Change<Element>,
  authorMap: Record<string, Set<ElemID>>,
): Promise<void> => {
  if (isAdditionChange(change)) {
    await updateAdditionChange(change, authorMap)
  } else if (isRemovalChange(change)) {
    await updateRemovalChange(change, authorMap)
  } else {
    await updateModificationChange(change, authorMap)
  }
}

const getUniqueAuthors = (changes: Change<Element>[]): Set<string> => {
  const authorSet = new Set<string>()
  changes.forEach(change => {
    if (isModificationChange(change)) {
      if (!change.data.after.annotations[CORE_ANNOTATIONS.CHANGED_BY]
          === change.data.before.annotations[CORE_ANNOTATIONS.CHANGED_BY]) {
        authorSet.add(getChangeAuthor(toChange({ before: change.data.before })))
        authorSet.add(getChangeAuthor(toChange({ after: change.data.after })))
      }
    } else {
      authorSet.add(getChangeAuthor(change))
    }
  })
  return authorSet
}

const mergeAuthorMap = (
  authorList: string[],
  indexValues: (ElemID[] | undefined)[]
): Record<string, Set<ElemID>> => {
  const authorMap: Record<string, ElemID[]> = _.pickBy(
    _.zipObject(authorList, indexValues),
    isDefined,
  )
  return _.mapValues(authorMap, (elemIds: ElemID[]) => new Set(elemIds))
}

const getCompleteAuthorMap = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
): Promise<Record<string, Set<ElemID>>> => {
  const authorList = Array.from(getUniqueAuthors(changes))
  const indexValues = await index.getMany(authorList)
  const authorMap = mergeAuthorMap(authorList, indexValues)
  changes.forEach(change => updateChange(change, authorMap))
  return authorMap
}

const updateChanges = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>
): Promise<void> => {
  const completeAuthorMap = await getCompleteAuthorMap(changes, index)
  const toBeRemoved = Object.keys(completeAuthorMap).filter(key => isEmpty(completeAuthorMap[key]))
  await index.setAll(Object.entries(completeAuthorMap)
    .map(([key, value]) => ({ key, value: Array.from(value) })))
  await index.deleteAll(toBeRemoved)
}

export const updateChangedByIndex = async (
  changes: Change<Element>[],
  changedByIndex: RemoteMap<ElemID[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean
): Promise<void> =>
  log.time(async () => {
    let relevantChanges = changes
    const isVersionMatch = (await mapVersions.get(CHANGED_BY_INDEX_KEY))
      === CHANGED_BY_INDEX_VERSION
    if (!isCacheValid || !isVersionMatch) {
      if (!isVersionMatch) {
        relevantChanges = await getAllElementsChanges(changes, elementsSource)
        log.info('changed by index map is out of date, re-indexing')
      }
      if (!isCacheValid) {
        log.info('cache is invalid, re-indexing changed by index')
      }
      await Promise.all([
        changedByIndex.clear(),
        mapVersions.set(CHANGED_BY_INDEX_KEY, CHANGED_BY_INDEX_VERSION),
      ])
    }
    await updateChanges(relevantChanges, changedByIndex)
  }, 'updating changed by index')
