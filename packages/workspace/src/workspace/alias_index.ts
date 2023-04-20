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
import _ from 'lodash'
import { getRelevantNamesFromChange } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { ElementsSource } from './elements_source'
import { updateIndex } from './index_utils'
import { RemoteMap } from './remote_map'

const { isDefined } = lowerdashValues
export const ALIAS_INDEX_VERSION = 3
const ALIAS_INDEX_KEY = 'alias_index'


const getAlias = (element: Element): string | undefined => element.annotations[CORE_ANNOTATIONS.ALIAS]

const calculateAliasChange = (
  afterElement: Element,
  aliasBefore: string | undefined,
  aliasAfter: string | undefined
)
  : Change<Element>[] => {
  if (aliasBefore !== aliasAfter) {
    if (aliasAfter !== undefined) {
      return [toChange({ after: afterElement })]
    }
    return [toChange({ before: afterElement })]
  }
  return []
}

const getChangedFields = (change: ModificationChange<ObjectType>): Change<Element>[] => {
  const afterFields = Object.values(change.data.after.fields)
  const beforeFields = Object.values(change.data.before.fields)
  const afterFieldsNamesSet = new Set(afterFields.map(field => field.name))
  const beforeFieldsNamesSet = new Set(beforeFields.map(field => field.name))

  const addedFields = afterFields.filter(afterField =>
    !beforeFieldsNamesSet.has(afterField.name) && getAlias(afterField) !== undefined)
  const removedFields = beforeFields.filter(beforeField =>
    !afterFieldsNamesSet.has(beforeField.name) && getAlias(beforeField) !== undefined)
  const aliasModifiedFields = afterFields
    .flatMap(afterField => {
      const field = change.data.before.fields[afterField.name]
      return isField(field)
        ? calculateAliasChange(afterField, getAlias(field), getAlias(afterField))
        : []
    })
  return aliasModifiedFields
    .concat(addedFields.map(field => toChange({ after: field })))
    .concat(removedFields.map(field => toChange({ before: field })))
}

const getAllRelevantChanges = (changes: Change<Element>[]): Change<Element>[] =>
  changes.flatMap((change):Change<Element> | Change<Element>[] | undefined => {
    if (isModificationChange(change)) {
      if (isObjectTypeChange(change)) {
        const changedFields = getChangedFields(change)
        const objAliasModification = calculateAliasChange(
          change.data.after,
          getAlias(change.data.before),
          getAlias(change.data.after)
        )
        return changedFields.concat(objAliasModification)
      }
      if (isInstanceChange(change)) {
        const instAliasModification = calculateAliasChange(
          change.data.after,
          getAlias(change.data.before),
          getAlias(change.data.after)
        )
        return _.isEmpty(instAliasModification) ? undefined : instAliasModification
      }

      // any other modification
      return undefined // the relevant modification changes are added as addition changes or removal
    }
    // if it is an addition of an object we want to add all its fields as addition changes
    if (isAdditionChange(change) && isObjectTypeChange(change)) {
      // take only the fields with alias
      const addedAliasFields: Element[] = Object.values(change.data.after.fields).filter(getAlias)
      return (addedAliasFields.map(f => toChange({ after: f })) ?? [])
        .concat(getAlias(getChangeData(change)) ? [change] : [])
    }
    if (isAdditionChange(change) && isInstanceChange(change)) {
      return getAlias(getChangeData(change)) ? change : undefined
    }
    return change // should only be removals
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
  { removalNames: string[]; additionsIdsToAlias: Record<string, string> } => {
  const { additions, removals } = getRemovalsAndAdditions(changes)
  const filteredAdditions = additions.map(getChangeData)
    .filter(elem => elem.annotations[CORE_ANNOTATIONS.ALIAS] !== undefined)
  const additionsIdsToAlias: Record<string, string> = _.mapValues(
    _.keyBy(
      filteredAdditions,
      elem => elem.elemID.getFullName()
    ),
    elem => elem.annotations[CORE_ANNOTATIONS.ALIAS]
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
): Promise<void> => updateIndex({
  changes,
  index: aliasIndex,
  indexVersionKey: ALIAS_INDEX_KEY,
  indexVersion: ALIAS_INDEX_VERSION,
  indexName: 'alias',
  mapVersions,
  elementsSource,
  isCacheValid,
  updateChanges,
})
