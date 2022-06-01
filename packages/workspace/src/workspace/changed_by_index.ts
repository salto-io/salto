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
// const getAuthorMap = (changes: Change<Element>[]): Record<string, ElemID[]> => {
//   const authorMap: Record<string, ElemID[]> = {}
//   changes.forEach(change => {
//     const author = getChangeAuthor(change)
//     if (!authorMap[author]) {
//       authorMap[author] = []
//     }
//     authorMap[author].push(getChangeData(change).elemID)
//   })
//   return authorMap
// }

// const addToIndex = async (
//   index: RemoteMap<ElemID[]>,
//   key: string,
//   value: ElemID[]
// ): Promise<void> => {
//   const existingValue = await index.get(key)
//   if (existingValue) {
//     await index.set(key, Array.from(new Set(existingValue.concat(value))))
//   } else {
//     await index.set(key, value)
//   }
// }

// const removeFromIndex = async (
//   index: RemoteMap<ElemID[]>,
//   key: string,
//   value: ElemID[]
// ): Promise<void> => {
//   const existingValue = await index.get(key)
//   if (existingValue) {
//     _.remove(existingValue, elemId => value.includes(elemId))
//     if (_.isEmpty(existingValue)) {
//       await index.delete(key)
//     } else {
//       await index.set(key, existingValue)
//     }
//   }
// }

// const updateAdditionChanges = async (
//   changes: Change<Element>[],
//   index: RemoteMap<ElemID[]>
// ): Promise<void> => {
//   const authorMap = getAuthorMap(changes)
//   await awu(Object.entries(authorMap)).forEach(async ([key, value]) =>
//     addToIndex(index, key, value))
// }

// const updateDeletionChanges = async (
//   changes: Change<Element>[],
//   index: RemoteMap<ElemID[]>
// ): Promise<void> => {
//   const authorMap = getAuthorMap(changes)
//   await awu(Object.entries(authorMap)).forEach(async ([key, value]) =>
//     removeFromIndex(index, key, value))
// }
const updateAdditionChange = async (
  change: AdditionChange<Element>,
  index: Record<string, ElemID[]>,
): Promise<void> => {
  const author = getChangeAuthor(change)
  const elementIds = index[author] ?? []
  if (!elementIds.some(elemId => elemId.isEqual(change.data.after.elemID))) {
    elementIds.push(change.data.after.elemID)
    index[author] = elementIds
  }
}

const updateRemovalChange = async (
  change: RemovalChange<Element>,
  index: Record<string, ElemID[]>,
): Promise<void> => {
  const author = getChangeAuthor(change)
  const elementIds = index[author]
  if (elementIds) {
    _.remove(elementIds, elemId => elemId.isEqual(change.data.before.elemID))
    index[author] = elementIds
    // if (_.isEmpty(elementIds)) {
    //   delete index.author
    // } else {
    //   index[author] = elementIds
    // }
  }
}

const updateModificationChange = async (
  change: ModificationChange<Element>,
  index: Record<string, ElemID[]>,
): Promise<void> => {
  if (change.data.after.annotations[CORE_ANNOTATIONS.CHANGED_BY]
    === change.data.before.annotations[CORE_ANNOTATIONS.CHANGED_BY]) {
    return
  }
  await updateRemovalChange(
    toChange({ before: change.data.before }) as RemovalChange<Element>,
    index,
  )
  await updateAdditionChange(
    toChange({ after: change.data.after }) as AdditionChange<Element>,
    index,
  )
}

const updateChange = async (
  change: Change<Element>,
  index: Record<string, ElemID[]>,
): Promise<void> => {
  if (isAdditionChange(change)) {
    await updateAdditionChange(change, index)
  } else if (isRemovalChange(change)) {
    await updateRemovalChange(change, index)
  } else {
    await updateModificationChange(change, index)
  }
}

const getAuthorList = (changes: Change<Element>[]): string[] => {
  const authorMap: string[] = []
  const addAuthor = (author: string): void => {
    if (!authorMap.includes(author)) {
      authorMap.push(author)
    }
  }
  changes.forEach(change => {
    if (isModificationChange(change)) {
      addAuthor(getChangeAuthor(toChange({ before: change.data.before })))
      addAuthor(getChangeAuthor(toChange({ after: change.data.after })))
    } else {
      addAuthor(getChangeAuthor(change))
    }
  })
  return authorMap
}

const getCompleteAuthorMap = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
): Promise<Record<string, ElemID[]>> => {
  const authorList = getAuthorList(changes)
  const indexValues = await index.getMany(authorList)
  const authorMap: Record<string, ElemID[]> = _.pickBy(_.zipObject(authorList, indexValues), isDefined)
  changes.forEach(change => updateChange(change, authorMap))
  return authorMap
}

const updateChanges = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>
): Promise<void> => {
  const completeAuthorMap = await getCompleteAuthorMap(changes, index)
  const toBeRemoved = Object.keys(completeAuthorMap).filter(key => isEmpty(completeAuthorMap[key]))
  await index.setAll(Object.entries(completeAuthorMap).map(([key, value]) => ({ key, value })))
  await index.deleteAll(toBeRemoved)
  // Object.entries(completeAuthorMap).forEach(async ([author, elementIds]) => {

  // })
  // const changesByAction = _.groupBy(changes, change => change.action)
  // const additions = changesByAction.add ?? []
  // const removals = changesByAction.remove ?? []
  // const modifications = (changesByAction.modify as ModificationChange<Element>[]) ?? []
  // await updateAdditionChanges(additions, index)
  // await updateDeletionChanges(removals, index)
  // await updateDeletionChanges(
  //   modifications.map(change => toChange({ before: change.data.before })),
  //   index
  // )
  // await updateAdditionChanges(
  //   modifications.map(change => toChange({ after: change.data.after })),
  //   index
  // )
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
