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
  const removedFieldsPath = before.elemID.createNestedID(...CUSTOM_ADDITONAL_PROPERTIES_PATH)
  const removedFields = Object.keys(resolvePath(before, removedFieldsPath))
    .filter(key => !(Object.keys(resolvePath(after, removedFieldsPath)).includes(key)))
  removedFields.forEach(field => {
    resolvePath(after, removedFieldsPath)[field] = null
  })
}

const deleteFieldsWithNull = (instance: InstanceElement): void => {
  const customFieldsPath = instance.elemID.createNestedID(...CUSTOM_ADDITONAL_PROPERTIES_PATH)
  const customFields = Object.keys(resolvePath(instance, customFieldsPath))
  customFields.forEach(field => {
    if (resolvePath(instance, customFieldsPath)[field] === null) {
      delete resolvePath(instance, customFieldsPath)[field]
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
