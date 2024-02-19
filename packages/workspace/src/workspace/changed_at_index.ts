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

export const CHANGED_AT_INDEX_VERSION = 4
const CHANGED_AT_INDEX_KEY = 'changed_at_index'

const getChangedAtDates = (change: Change<Element>): Record<string, ElemID[]> => {
  const changeElement = getChangeData(change)
  const datesMap: Record<string, ElemID[]> = {}
  const addElementToDatesMap = (element: Element): void => {
    const date = element.annotations[CORE_ANNOTATIONS.CHANGED_AT]
    if (isDefined(date)) {
      if (!datesMap[date]) {
        datesMap[date] = []
      }
      datesMap[date].push(element.elemID)
    }
  }
  if (isObjectType(changeElement)) {
    Object.values(changeElement.fields).forEach(addElementToDatesMap)
  }
  addElementToDatesMap(changeElement)
  return datesMap
}

const updateAdditionChange = (change: AdditionChange<Element>, datesMap: Record<string, Set<string>>): void => {
  Object.entries(getChangedAtDates(change)).forEach(entry => {
    const [date, elemIds] = entry
    if (!datesMap[date]) {
      datesMap[date] = new Set()
    }
    elemIds.forEach(elemId => datesMap[date].add(elemId.getFullName()))
  })
}

const updateRemovalChange = (change: RemovalChange<Element>, datesMap: Record<string, Set<string>>): void => {
  Object.entries(getChangedAtDates(change)).forEach(entry => {
    const [date, elemIds] = entry
    if (datesMap[date]) {
      elemIds.forEach(elemId => datesMap[date].delete(elemId.getFullName()))
    }
  })
}

const updateChange = (change: Change<Element>, datesMap: Record<string, Set<string>>): void => {
  if (isAdditionChange(change)) {
    updateAdditionChange(change, datesMap)
  } else if (isRemovalChange(change)) {
    updateRemovalChange(change, datesMap)
  } else {
    updateRemovalChange(toChange({ before: change.data.before }) as RemovalChange<Element>, datesMap)
    updateAdditionChange(toChange({ after: change.data.after }) as AdditionChange<Element>, datesMap)
  }
}

const getUniqueDates = (changes: Change<Element>[]): Set<string> => {
  const dateSet = new Set<string>()
  changes.flatMap(change =>
    (isModificationChange(change)
      ? [
          ...Object.keys(getChangedAtDates(toChange({ before: change.data.before }))),
          ...Object.keys(getChangedAtDates(toChange({ after: change.data.after }))),
        ]
      : [...Object.keys(getChangedAtDates(change))]
    ).forEach(date => dateSet.add(date)),
  )
  return dateSet
}

const mergeDateMap = (dateList: string[], indexValues: (ElemID[] | undefined)[]): Record<string, Set<string>> => {
  const datesMap: Record<string, ElemID[]> = _.pickBy(_.zipObject(dateList, indexValues), isDefined)
  return _.mapValues(datesMap, (elemIds: ElemID[]) => new Set(elemIds.map(elemId => elemId.getFullName())))
}

const getCompleteDateMap = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
): Promise<Record<string, Set<string>>> => {
  const datesList = Array.from(getUniqueDates(changes))
  const indexValues = await index.getMany(datesList)
  const dateMap = mergeDateMap(datesList, indexValues)
  changes.forEach(change => updateChange(change, dateMap))
  return dateMap
}

const updateChanges = async (changes: Change<Element>[], index: RemoteMap<ElemID[]>): Promise<void> => {
  const completeAuthorMap = await getCompleteDateMap(changes, index)
  const [toBeRemoved, toBeSet] = _.partition(Object.keys(completeAuthorMap), key => isEmpty(completeAuthorMap[key]))
  await index.setAll(toBeSet.map(key => ({ key, value: Array.from(completeAuthorMap[key]).map(ElemID.fromFullName) })))
  await index.deleteAll(toBeRemoved)
}

export const updateChangedAtIndex = async (
  changes: Change<Element>[],
  changedAtIndex: RemoteMap<ElemID[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean,
): Promise<void> =>
  updateIndex({
    changes,
    index: changedAtIndex,
    indexVersionKey: CHANGED_AT_INDEX_KEY,
    indexVersion: CHANGED_AT_INDEX_VERSION,
    indexName: 'changed at',
    mapVersions,
    elementsSource,
    isCacheValid,
    updateChanges,
  })
