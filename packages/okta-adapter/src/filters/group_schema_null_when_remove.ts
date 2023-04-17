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

import { Change, InstanceElement, ModificationChange, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { GROUP_SCHEMA_TYPE_NAME } from '../constants'

const CUSTOM_ADDITONAL_PROPERTIES_PATH = ['definitions', 'custom', 'properties', 'additionalProperties']

const addNullToRemovedFields = (change: ModificationChange<InstanceElement>): void => {
  const { before, after } = change.data
  const customAdditionalPropertiesPath = before.elemID.createNestedID(...CUSTOM_ADDITONAL_PROPERTIES_PATH)
  const beforeCustomFields = resolvePath(before, customAdditionalPropertiesPath)
  const afterCustomFields = resolvePath(after, customAdditionalPropertiesPath)
  const fieldsToRemove = Object.keys(beforeCustomFields)
    .filter(key => !(Object.keys(afterCustomFields).includes(key)))

  fieldsToRemove.forEach(field => {
    resolvePath(after, customAdditionalPropertiesPath)[field] = null
  })
}

const deleteFieldsWithNull = (instance: InstanceElement): void => {
  const customAdditionalPropertiesPath = instance.elemID.createNestedID(...CUSTOM_ADDITONAL_PROPERTIES_PATH)
  const customFields = resolvePath(instance, customAdditionalPropertiesPath)

  Object.keys(customFields).forEach(field => {
    if (customFields[field] === null) {
      delete customFields[field]
    }
  })
}

const groupSchemaAddNullFilter: FilterCreator = () => ({
  name: 'groupSchemaAddNullFilter',
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === GROUP_SCHEMA_TYPE_NAME)
      .map(change => addNullToRemovedFields(change))
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .filter(isModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === GROUP_SCHEMA_TYPE_NAME)
      .map(instance => deleteFieldsWithNull(instance))
  },
}
)

export default groupSchemaAddNullFilter
