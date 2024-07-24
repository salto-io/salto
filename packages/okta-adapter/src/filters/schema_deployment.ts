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
  InstanceElement,
  ModificationChange,
  getChangeData,
  isInstanceChange,
  isModificationChange,
  ElemID,
  Values,
  isAdditionOrModificationChange,
  AdditionChange,
  isAdditionChange,
} from '@salto-io/adapter-api'
import { resolvePath, setPath } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { APP_USER_SCHEMA_TYPE_NAME, GROUP_SCHEMA_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../constants'
import { BASE_PATH } from '../change_validators/app_user_schema_base_properties'

const log = logger(module)

const CUSTOM_PROPERTIES_PATH = ['definitions', 'custom', 'properties']

export const SCHEMAS_TO_PATH: Record<string, string[]> = {
  [GROUP_SCHEMA_TYPE_NAME]: CUSTOM_PROPERTIES_PATH,
  [APP_USER_SCHEMA_TYPE_NAME]: CUSTOM_PROPERTIES_PATH,
  [USER_SCHEMA_TYPE_NAME]: CUSTOM_PROPERTIES_PATH,
}

const getBaseElemID = (appUserSchemaInstance: InstanceElement): ElemID =>
  appUserSchemaInstance.elemID.createNestedID(...BASE_PATH)

const setBaseField = (
  change: ModificationChange<InstanceElement>,
  elemIdToAfterBaseFields: Record<string, Values>,
): void => {
  const { before, after } = change.data
  const baseElemId = getBaseElemID(after)
  elemIdToAfterBaseFields[after.elemID.getFullName()] = resolvePath(after, baseElemId)
  setPath(after, baseElemId, resolvePath(before, baseElemId))
}

const makeCustomPropertiesDeployable = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  elemIdToAfterCustomProperties: Record<string, Values>,
): void => {
  const { after } = change.data
  const customPropertiesElemID = after.elemID.createNestedID(...SCHEMAS_TO_PATH[after.elemID.typeName])
  const afterCustomProperties = resolvePath(after, customPropertiesElemID)
  elemIdToAfterCustomProperties[after.elemID.getFullName()] = _.cloneDeep(afterCustomProperties)
  if (!values.isPlainRecord(afterCustomProperties)) {
    if (afterCustomProperties !== undefined) {
      log.error('Custom properties should be a record. Instance: %s', after.elemID.getFullName())
    }
    setPath(after, customPropertiesElemID, {})
  }
  const updatedAfterCustomProperties = resolvePath(after, customPropertiesElemID)
  if (isAdditionChange(change)) {
    return
  }
  const { before } = change.data
  const beforeCustomProperties = resolvePath(before, customPropertiesElemID)
  if (!values.isPlainRecord(beforeCustomProperties)) {
    return
  }

  const afterCustomPropertiesKeys = new Set(Object.keys(updatedAfterCustomProperties))
  const propertiesToRemove = Object.keys(beforeCustomProperties).filter(key => !afterCustomPropertiesKeys.has(key))

  propertiesToRemove.forEach(property => {
    updatedAfterCustomProperties[property] = null
  })
}

const returnCustomPropertiesToOriginal = (
  instance: InstanceElement,
  elemIdToAfterCustomProperties: Record<string, Values>,
): void => {
  const customPropertiesElemID = instance.elemID.createNestedID(...SCHEMAS_TO_PATH[instance.elemID.typeName])
  const originalCustomProperties = elemIdToAfterCustomProperties[instance.elemID.getFullName()]
  setPath(instance, customPropertiesElemID, originalCustomProperties)
}

const returnBaseToOriginal = (instance: InstanceElement, elemIdToAfterBaseFields: Record<string, Values>): void => {
  const baseElemId = getBaseElemID(instance)
  const originalBase = elemIdToAfterBaseFields[instance.elemID.getFullName()]
  setPath(instance, baseElemId, originalBase)
}

export const makeSchemaDeployable = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  elemIdToAfterBaseFields: Record<string, Values>,
  elemIdToAfterCustomProperties: Record<string, Values>,
): void => {
  makeCustomPropertiesDeployable(change, elemIdToAfterCustomProperties)
  if (isModificationChange(change)) {
    setBaseField(change, elemIdToAfterBaseFields)
  }
}

const returnToOriginalForm = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  elemIdToAfterBaseFields: Record<string, Values>,
  elemIdToAfterCustomProperties: Record<string, Values>,
): void => {
  returnCustomPropertiesToOriginal(getChangeData(change), elemIdToAfterCustomProperties)
  if (isModificationChange(change)) {
    returnBaseToOriginal(getChangeData(change), elemIdToAfterBaseFields)
  }
}
// TODO change the documentation
/**
 * When a user wants to delete a custom property from a schema, the custom property is set to null.
 * This is in order for Okta to delete the property from the schema.
 * This filter removes the custom properties that are set to null in the onDeploy.
 */
const filterCreator: FilterCreator = () => {
  const elemIdToAfterBaseFields: Record<string, Values> = {}
  const elemIdToAfterCustomProperties: Record<string, Values> = {}
  return {
    name: 'schemaDeploymentFilter',
    preDeploy: async (changes: Change<InstanceElement>[]) =>
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => Object.keys(SCHEMAS_TO_PATH).includes(getChangeData(change).elemID.typeName))
        .forEach(change => makeSchemaDeployable(change, elemIdToAfterBaseFields, elemIdToAfterCustomProperties)),
    onDeploy: async (changes: Change<InstanceElement>[]) =>
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => Object.keys(SCHEMAS_TO_PATH).includes(getChangeData(change).elemID.typeName))
        .forEach(change => returnToOriginalForm(change, elemIdToAfterBaseFields, elemIdToAfterCustomProperties)),
  }
}

export default filterCreator
