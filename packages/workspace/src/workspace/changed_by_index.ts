/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  AdditionChange,
  RemovalChange,
  isAdditionChange,
  isRemovalChange,
  isModificationChange,
  isObjectType,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _, { isEmpty } from 'lodash'
import { ElementsSource } from './elements_source'
import { updateIndex } from './index_utils'
import { RemoteMap } from './remote_map'

const { isDefined } = values

export const CHANGED_BY_INDEX_VERSION = 4
const CHANGED_BY_INDEX_KEY = 'changed_by_index'
const UNKNOWN_USER_NAME = 'Unknown'
const CHANGED_BY_KEY_DELIMITER = '@@'

export type Author = {
  user: string
  account: string
}

export const authorKeyToAuthor = (authorKey: string): Author => {
  if (authorKey === UNKNOWN_USER_NAME) {
    return {
      user: UNKNOWN_USER_NAME,
      account: '',
    }
  }
  const AuthorParts = authorKey.split(CHANGED_BY_KEY_DELIMITER)
  return {
    user: AuthorParts[1],
    account: AuthorParts[0],
  }
}

export const authorToAuthorKey = (author: Author): string => {
  if (author.user === UNKNOWN_USER_NAME && author.account === '') {
    return UNKNOWN_USER_NAME
  }
  return `${author.account}${CHANGED_BY_KEY_DELIMITER}${author.user}`
}

const elementToAuthorKey = (element: Element): string =>
  `${element.elemID.adapter}${CHANGED_BY_KEY_DELIMITER}${element.annotations[CORE_ANNOTATIONS.CHANGED_BY]}`

const getChangeAuthors = (change: Change<Element>): Record<string, ElemID[]> => {
  const changeElement = getChangeData(change)
  const authors: Record<string, ElemID[]> = {}
  const addElementToMap = (element: Element): void => {
    const authorKey = element.annotations[CORE_ANNOTATIONS.CHANGED_BY] ? elementToAuthorKey(element) : UNKNOWN_USER_NAME
    if (!authors[authorKey]) {
      authors[authorKey] = []
    }
    authors[authorKey].push(element.elemID)
  }
  if (isObjectType(changeElement)) {
    Object.values(changeElement.fields).forEach(addElementToMap)
  }
  addElementToMap(changeElement)
  return authors
}

const updateAdditionChange = (change: AdditionChange<Element>, authorMap: Record<string, Set<string>>): void => {
  const authors = getChangeAuthors(change)
  Object.entries(authors).forEach(entry => {
    const [author, elements] = entry
    if (!authorMap[author]) {
      authorMap[author] = new Set()
    }
    elements.forEach(element => {
      authorMap[author].add(element.getFullName())
    })
  })
}

const updateRemovalChange = (change: RemovalChange<Element>, authorMap: Record<string, Set<string>>): void => {
  const authors = getChangeAuthors(change)
  Object.entries(authors).forEach(entry => {
    const [author, elements] = entry
    if (authorMap[author]) {
      elements.forEach(element => {
        authorMap[author].delete(element.getFullName())
      })
    }
  })
}

const updateChange = (change: Change<Element>, authorMap: Record<string, Set<string>>): void => {
  if (isAdditionChange(change)) {
    updateAdditionChange(change, authorMap)
  } else if (isRemovalChange(change)) {
    updateRemovalChange(change, authorMap)
  } else {
    updateRemovalChange(toChange({ before: change.data.before }) as RemovalChange<Element>, authorMap)
    updateAdditionChange(toChange({ after: change.data.after }) as AdditionChange<Element>, authorMap)
  }
}

const getUniqueAuthors = (changes: Change<Element>[]): Set<string> => {
  const authorSet = new Set<string>()
  changes.forEach(change => {
    if (isModificationChange(change)) {
      Object.keys(getChangeAuthors(toChange({ before: change.data.before }))).forEach(author => authorSet.add(author))
      Object.keys(getChangeAuthors(toChange({ after: change.data.after }))).forEach(author => authorSet.add(author))
    } else {
      Object.keys(getChangeAuthors(change)).forEach(author => authorSet.add(author))
    }
  })
  return authorSet
}

const mergeAuthorMap = (authorList: string[], indexValues: (ElemID[] | undefined)[]): Record<string, Set<string>> => {
  const authorMap: Record<string, ElemID[]> = _.pickBy(_.zipObject(authorList, indexValues), isDefined)
  return _.mapValues(authorMap, (elemIds: ElemID[]) => new Set(elemIds.map(elemId => elemId.getFullName())))
}

const getCompleteAuthorMap = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
): Promise<Record<string, Set<string>>> => {
  const authorList = Array.from(getUniqueAuthors(changes))
  const indexValues = await index.getMany(authorList)
  const authorMap = mergeAuthorMap(authorList, indexValues)
  changes.forEach(change => updateChange(change, authorMap))
  return authorMap
}

const updateChanges = async (changes: Change<Element>[], index: RemoteMap<ElemID[]>): Promise<void> => {
  const completeAuthorMap = await getCompleteAuthorMap(changes, index)
  const [toBeRemoved, toBeSet] = _.partition(Object.keys(completeAuthorMap), key => isEmpty(completeAuthorMap[key]))
  await index.setAll(toBeSet.map(key => ({ key, value: Array.from(completeAuthorMap[key]).map(ElemID.fromFullName) })))
  await index.deleteAll(toBeRemoved)
}

export const updateChangedByIndex = async (
  changes: Change<Element>[],
  changedByIndex: RemoteMap<ElemID[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
): Promise<void> =>
  updateIndex({
    changes,
    index: changedByIndex,
    indexVersionKey: CHANGED_BY_INDEX_KEY,
    indexVersion: CHANGED_BY_INDEX_VERSION,
    indexName: 'changed by',
    mapVersions,
    elementsSource,
    isCacheValid,
    updateChanges,
  })
