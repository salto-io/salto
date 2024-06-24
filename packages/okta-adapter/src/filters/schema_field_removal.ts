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
} from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { APP_USER_SCHEMA_TYPE_NAME, GROUP_SCHEMA_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../constants'

const CUSTOM_PROPERTIES_PATH = ['definitions', 'custom', 'properties']

const SCHEMAS_TO_PATH: Record<string, string[]> = {
  [GROUP_SCHEMA_TYPE_NAME]: CUSTOM_PROPERTIES_PATH,
  [APP_USER_SCHEMA_TYPE_NAME]: CUSTOM_PROPERTIES_PATH,
  [USER_SCHEMA_TYPE_NAME]: CUSTOM_PROPERTIES_PATH,
}

const addNullToRemovedProperties = (change: ModificationChange<InstanceElement>): void => {
  const { before, after } = change.data
  const path = SCHEMAS_TO_PATH[before.elemID.typeName]
  const customPropertiesPath = before.elemID.createNestedID(...path)
  const beforeCustomProperties = resolvePath(before, customPropertiesPath)
  const afterCustomProperties = resolvePath(after, customPropertiesPath)
  if (beforeCustomProperties === undefined || afterCustomProperties === undefined) {
    return
  }
  const afterCustomPropertiesKeys = new Set(Object.keys(afterCustomProperties))
  const propertiesToRemove = Object.keys(beforeCustomProperties).filter(key => !afterCustomPropertiesKeys.has(key))

  propertiesToRemove.forEach(property => {
    afterCustomProperties[property] = null
  })
}

const deletePropertiesWithNull = (instance: InstanceElement): void => {
  const path = SCHEMAS_TO_PATH[instance.elemID.typeName]
  const customPropertiesPath = instance.elemID.createNestedID(...path)
  const customProperties = resolvePath(instance, customPropertiesPath)

  Object.keys(customProperties).forEach(property => {
    if (customProperties[property] === null) {
      delete customProperties[property]
    }
  })
}

/**
 * When a user wants to delete a custom property from a schema, the custom property is set to null.
 * This is in order for Okta to delete the property from the schema.
 * This filter removes the custom properties that are set to null in the onDeploy.
 */
const schemaFieldsRemovalFilter: FilterCreator = () => ({
  name: 'schemaFieldsRemovalFilter',
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .filter(change => Object.keys(SCHEMAS_TO_PATH).includes(getChangeData(change).elemID.typeName))
      .forEach(change => addNullToRemovedProperties(change))
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => Object.keys(SCHEMAS_TO_PATH).includes(instance.elemID.typeName))
      .forEach(instance => deletePropertiesWithNull(instance))
  },
})

export default schemaFieldsRemovalFilter
