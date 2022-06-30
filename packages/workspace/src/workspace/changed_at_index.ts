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
export const CHANGED_AT_INDEX_VERSION = 1
const CHANGED_AT_INDEX_KEY = 'changed_at_index'

const getAllElementsChanges = async (
  currentChanges: Change<Element>[],
  elementsSource: ElementsSource
): Promise<Change<Element>[]> =>
  awu(await elementsSource.getAll())
    .map(element => toChange({ after: element }))
    .concat(currentChanges)
    .toArray()

const getChangedAt = (change: Change<Element>): string | undefined =>
  getChangeData(change).annotations[CORE_ANNOTATIONS.CHANGED_AT]

const updateAdditionChange = (
  change: AdditionChange<Element>,
  datesMap: Record<string, Set<ElemID>>,
): void => {
  const modificationDate = getChangedAt(change)
  if (!modificationDate) {
    return
  }
  if (!datesMap[modificationDate]) {
    datesMap[modificationDate] = new Set()
  }
  datesMap[modificationDate].add(change.data.after.elemID)
}

const updateRemovalChange = (
  change: RemovalChange<Element>,
  datesMap: Record<string, Set<ElemID>>,
): void => {
  const modificationDate = getChangedAt(change)
  if (modificationDate && datesMap[modificationDate]) {
    datesMap[modificationDate].delete(change.data.before.elemID)
  }
}

const updateModificationChange = (
  change: ModificationChange<Element>,
  datesMap: Record<string, Set<ElemID>>,
): void => {
  if (change.data.after.annotations[CORE_ANNOTATIONS.CHANGED_AT]
    !== change.data.before.annotations[CORE_ANNOTATIONS.CHANGED_AT]) {
    updateRemovalChange(
      toChange({ before: change.data.before }) as RemovalChange<Element>,
      datesMap,
    )
    updateAdditionChange(
      toChange({ after: change.data.after }) as AdditionChange<Element>,
      datesMap,
    )
  }
}

const updateChange = (
  change: Change<Element>,
  datesMap: Record<string, Set<ElemID>>,
): void => {
  if (isAdditionChange(change)) {
    updateAdditionChange(change, datesMap)
  } else if (isRemovalChange(change)) {
    updateRemovalChange(change, datesMap)
  } else {
    updateModificationChange(change, datesMap)
  }
}

const getUniqueDates = (changes: Change<Element>[]): Set<string> => {
  const dateSet = new Set<string>()
  changes.flatMap(change => (
    isModificationChange(change)
      ? [getChangedAt(toChange({ before: change.data.before })),
        getChangedAt(toChange({ after: change.data.after }))]
      : [getChangedAt(change)])
    .filter(values.isDefined)
    .forEach(date => dateSet.add(date)))
  return dateSet
}

const mergeDateMap = (
  dateList: string[],
  indexValues: (ElemID[] | undefined)[]
): Record<string, Set<ElemID>> => {
  const datesMap: Record<string, ElemID[]> = _.pickBy(
    _.zipObject(dateList, indexValues),
    isDefined,
  )
  return _.mapValues(datesMap, (elemIds: ElemID[]) => new Set(elemIds))
}

const getCompleteDateMap = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>,
): Promise<Record<string, Set<ElemID>>> => {
  const datesList = Array.from(getUniqueDates(changes))
  const indexValues = await index.getMany(datesList)
  const dateMap = mergeDateMap(datesList, indexValues)
  changes.forEach(change => updateChange(change, dateMap))
  return dateMap
}

const updateChanges = async (
  changes: Change<Element>[],
  index: RemoteMap<ElemID[]>
): Promise<void> => {
  const completeAuthorMap = await getCompleteDateMap(changes, index)
  const [toBeRemoved, toBeSet] = _.partition(
    Object.keys(completeAuthorMap),
    key => isEmpty(completeAuthorMap[key]),
  )
  await index.setAll(toBeSet.map(key => ({ key, value: Array.from(completeAuthorMap[key]) })))
  await index.deleteAll(toBeRemoved)
}

export const updateChangedAtIndex = async (
  changes: Change<Element>[],
  changedAtIndex: RemoteMap<ElemID[]>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean
): Promise<void> =>
  log.time(async () => {
    let relevantChanges = changes
    const isVersionMatch = (await mapVersions.get(CHANGED_AT_INDEX_KEY))
      === CHANGED_AT_INDEX_VERSION
    if (!isCacheValid || !isVersionMatch) {
      if (!isVersionMatch) {
        relevantChanges = await getAllElementsChanges(changes, elementsSource)
        log.info('changed at index map is out of date, re-indexing')
      }
      if (!isCacheValid) {
        log.info('cache is invalid, re-indexing changed at index')
      }
      await Promise.all([
        changedAtIndex.clear(),
        mapVersions.set(CHANGED_AT_INDEX_KEY, CHANGED_AT_INDEX_VERSION),
      ])
    }
    await updateChanges(relevantChanges, changedAtIndex)
  }, 'updating changed at index')
