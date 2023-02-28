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
  isObjectType, ObjectType, isObjectTypeChange, ModificationChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { prettifyName } from '@salto-io/adapter-utils'
import { ElementsSource } from './elements_source'
import { getAllElementsChanges } from './index_utils'
import { RemoteMap } from './remote_map'


const log = logger(module)
export const ALIAS_INDEX_VERSION = 4
const ALIAS_INDEX_KEY = 'alias_index'

const getFieldsElemIDsFullName = (objectType: ObjectType): string[] =>
  Object.values(objectType.fields).map(field => field.elemID.getFullName())

const getChangedFields = (change: ModificationChange<ObjectType>): Change<Element>[] => {
  const afterFields = Object.values(change.data.after.fields)
  const beforeFields = Object.values(change.data.before.fields)
  const additionFields = afterFields.filter(field => !beforeFields.find(f => f.elemID.isEqual(field.elemID)))
  const removalFields = beforeFields.filter(field => !afterFields.find(f => f.elemID.isEqual(field.elemID)))
  const aliasModificationFields = afterFields
    .filter(afterField => {
      const beforeField = beforeFields.find(f => f.elemID.isEqual(afterField.elemID))
      return (beforeField !== undefined)
        && afterField.annotations[CORE_ANNOTATIONS.ALIAS] !== beforeField.annotations[CORE_ANNOTATIONS.ALIAS]
    })
  return [
    ...additionFields.map(f => toChange({ after: f })),
    ...aliasModificationFields.map(f => toChange({ after: f })),
    ...removalFields.map(f => toChange({ before: f })),
  ]
}

const updateChanges = async (
  changes: Change<Element>[],
  index: RemoteMap<string>
): Promise<void> => {
  const getRelevantNamesFromChange = (change: Change<Element>): string[] => {
    const element = getChangeData(change)
    const fieldsNames = isObjectType(element)
      ? getFieldsElemIDsFullName(element)
      : []
    return [element.elemID.getFullName(), ...fieldsNames]
  }
  const [additions, removals] = _.partition(changes.flatMap(change => {
    if (isModificationChange(change)) {
      if (isObjectTypeChange(change)) {
        const changedFields = getChangedFields(change)
        const objAliasModification = change.data.before.annotations[CORE_ANNOTATIONS.ALIAS]
        !== change.data.after.annotations[CORE_ANNOTATIONS.ALIAS]
          ? [toChange({ after: change.data.after })]
          : []
        return changedFields.concat(objAliasModification)
      }
      if (change.data.before.annotations[CORE_ANNOTATIONS.ALIAS]
        !== change.data.after.annotations[CORE_ANNOTATIONS.ALIAS]) {
        return toChange({ after: change.data.after })
      }
    }
    if (isAdditionChange(change) && isObjectTypeChange(change)) {
      const addedFields = Object.values(change.data.after.fields)
      return [
        ...addedFields.map(f => toChange({ after: f })),
        change,
      ]
    }
    return change
  }).filter(change => !isModificationChange(change)),
  isAdditionChange)
  const elemById = _.keyBy(additions.map(getChangeData), elem => elem.elemID.getFullName())
  const additionsNames = Object.keys(elemById)

  await index.setAll(additionsNames.map(name => ({
    key: name,
    value: elemById[name].annotations[CORE_ANNOTATIONS.ALIAS] ?? prettifyName(name.split('.').slice(-1)[0]),
  })))
  const removalNames = removals.flatMap(getRelevantNamesFromChange)
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
