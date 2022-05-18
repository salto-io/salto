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
import { Change, ElemID, getChangeData, Element, isModificationChange, toChange, CORE_ANNOTATIONS, AdditionChange, RemovalChange, ModificationChange, isAdditionChange, isRemovalChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ElementsSource } from './elements_source'
import { RemoteMap } from './remote_map'

const { awu } = collections.asynciterable

const log = logger(module)
export const CHANGED_BY_INDEX_VERSION = 1
export const CHANGED_BY_INDEX_KEY = 'changed_by_index'
export const UNKNOWN_USER_NAME = 'Unknown'
const CHANGED_BY_KEY_DELIMITER = '@@'

export type Author = {
  user: string
  account: string
}

export const authorKeyToAuthor = (authorKey: string): Author => {
  const AuthorParts = authorKey.split('@@')
  return {
    user: AuthorParts[1],
    account: AuthorParts[0],
  }
}

export const authorToAuthorKey = (author: Author): string => {
  return `${author.account}@@${author.user}`
}

const getAllElementsChanges = async (
  currentChanges: Change<Element>[],
  elementsSource: ElementsSource,
): Promise<Change<Element>[]> => awu(await elementsSource.getAll())
  .map(element => toChange({ after: element }))
  .concat(currentChanges)
  .toArray()

const getChangeAuthor = (change: Change<Element>): string => {
  const element = getChangeData(change)
  const author = element.annotations[CORE_ANNOTATIONS.CHANGED_BY] ?? UNKNOWN_USER_NAME
  return `${element.elemID.adapter}${CHANGED_BY_KEY_DELIMITER}${author}`
}

const updateAdditionChange = async (
  change: AdditionChange<Element>,
  index: RemoteMap<ElemID[]>,
): Promise<void> => {
  const author = getChangeAuthor(change)
  const elementIds = await index.get(author) ?? []
  if (!elementIds.some(elemId => elemId.isEqual(change.data.after.elemID))) {
    elementIds.push(change.data.after.elemID)
    await index.set(author, elementIds)
  }
}

const updateRemovalChange = async (
  change: RemovalChange<Element>,
  index: RemoteMap<ElemID[]>,
): Promise<void> => {
  const author = getChangeAuthor(change)
  const elementIds = await index.get(author)
  if (elementIds) {
    _.remove(elementIds, elemId => elemId.isEqual(change.data.before.elemID))
    await index.set(author, elementIds)
  }
}

const updateModificationChange = async (
  change: ModificationChange<Element>,
  index: RemoteMap<ElemID[]>,
): Promise<void> => {
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
  index: RemoteMap<ElemID[]>,
): Promise<void> => {
  if (isAdditionChange(change)) {
    await updateAdditionChange(change, index)
  } else if (isRemovalChange(change)) {
    await updateRemovalChange(change, index)
  } else if (isModificationChange(change)) {
    await updateModificationChange(change, index)
  }
}

export const updateChangedByIndex = async (
  changes: Change<Element>[],
  changedByIndex: RemoteMap<ElemID[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
): Promise<void> => log.time(async () => {
  let relevantChanges = changes
  const isVersionMatch = await mapVersions.get(CHANGED_BY_INDEX_KEY) === CHANGED_BY_INDEX_VERSION
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
  await awu(relevantChanges).forEach(async change => updateChange(change, changedByIndex))
}, 'updating changed by index')
