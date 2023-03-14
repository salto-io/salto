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
import {
  Change,
  getChangeData,
  Element,
  toChange,
  CORE_ANNOTATIONS,
  isAdditionChange,
  isModificationChange,
  ObjectType, isObjectTypeChange, ModificationChange, isField, isInstanceChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { getRelevantNamesFromChange, prettifyName } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ElementsSource } from './elements_source'
import { getAllElementsChanges } from './index_utils'
import { RemoteMap } from './remote_map'

const { isDefined } = lowerdashValues
const log = logger(module)
export const ALIAS_INDEX_VERSION = 1
const ALIAS_INDEX_KEY = 'alias_index'

const calcAlias = (elem: Element): string => elem.annotations[CORE_ANNOTATIONS.ALIAS] ?? prettifyName(elem.elemID.name)

const getChangedFields = (change: ModificationChange<ObjectType>): Change<Element>[] => {
  const afterFields = Object.values(change.data.after.fields)
  const beforeFields = Object.values(change.data.before.fields)
  const afterFieldsNamesSet = new Set(afterFields.map(field => field.name))
  const beforeFieldsNamesSet = new Set(beforeFields.map(field => field.name))

  const addedFields = afterFields.filter(afterField => !beforeFieldsNamesSet.has(afterField.name))
  const removedFields = beforeFields.filter(beforeField => !afterFieldsNamesSet.has(beforeField.name))
  const aliasModifiedFields = afterFields.filter(afterField => {
    const field = change.data.before.fields[afterField.name]
    return isField(field) && (calcAlias(afterField) !== calcAlias(field))
  })
  return (addedFields.map(field => toChange({ after: field })))
    .concat(aliasModifiedFields.map(field => toChange({ after: field })))
    .concat(removedFields.map(field => toChange({ before: field })))
}

const getAllRelevantChanges = (changes: Change<Element>[]): Change<Element>[] =>
  changes.flatMap((change):Change<Element> | Change<Element>[] | undefined => {
    if (isModificationChange(change)) {
      if (isObjectTypeChange(change)) {
        const changedFields = getChangedFields(change)
        const objAliasModification = calcAlias(change.data.before) !== calcAlias(change.data.after)
          ? [toChange({ after: change.data.after })]
          : []
        return changedFields.concat(objAliasModification)
      }
      if (isInstanceChange(change)) {
        if (calcAlias(change.data.before) !== calcAlias(change.data.after)) {
          return toChange({ after: change.data.after })
        }
      }

      // any other modification
      return undefined // the relevant modification changes are added as addition changes
    }
    // if it is an addition of an object we want to add all its fields as addition changes
    if (isAdditionChange(change) && isObjectTypeChange(change)) {
      const addedFields: Element[] = Object.values(change.data.after.fields)
      return (addedFields.map(f => toChange({ after: f })) ?? []).concat([change])
    }
    return change
  }).filter(isDefined)

const getRemovalsAndAdditions = (changes: Change<Element>[]):
  {additions: Change<Element>[]; removals:Change<Element>[] } => {
  const [additions, removals] = _.partition(
    getAllRelevantChanges(changes),
    isAdditionChange
  )
  return { additions, removals }
}

const getInfoForIndex = (changes: Change<Element>[]):
  { removalNames:string[]; additionsIdsToAlias: Record<string, string> } => {
  const { additions, removals } = getRemovalsAndAdditions(changes)
  const additionsIdsToAlias = _.mapValues(
    _.keyBy(additions.map(getChangeData), elem => elem.elemID.getFullName()),
    elem => calcAlias(elem)
  )
  const removalNames = removals.flatMap(getRelevantNamesFromChange)
  return { removalNames, additionsIdsToAlias }
}
const updateChanges = async (
  changes: Change<Element>[],
  index: RemoteMap<string>
): Promise<void> => {
  const { removalNames, additionsIdsToAlias } = getInfoForIndex(changes)
  await index.setAll(Object.keys(additionsIdsToAlias).map(id => ({ key: id, value: additionsIdsToAlias[id] })))
  await index.deleteAll(removalNames)
}

export const updateAliasIndex = async (
  changes: Change<Element>[],
  aliasIndex: RemoteMap<string>,
  mapVersions: RemoteMap<number>,
  elementsSource: ElementsSource,
  isCacheValid: boolean
): Promise<void> =>
  log.time(async () => {
    let relevantChanges = changes
    const isVersionMatch = (await mapVersions.get(ALIAS_INDEX_KEY)) === ALIAS_INDEX_VERSION
    if (!isCacheValid || !isVersionMatch) {
      if (!isVersionMatch) {
        relevantChanges = await getAllElementsChanges(changes, elementsSource)
        log.info('alias index map is out of date, re-indexing')
      }
      if (!isCacheValid) {
        // When cache is invalid, changes will include all the elements in the workspace.
        log.info('cache is invalid, re-indexing alias index')
      }
      await Promise.all([
        aliasIndex.clear(),
        mapVersions.set(ALIAS_INDEX_KEY, ALIAS_INDEX_VERSION),
      ])
    }
    await updateChanges(relevantChanges, aliasIndex)
  }, 'updating alias index')
