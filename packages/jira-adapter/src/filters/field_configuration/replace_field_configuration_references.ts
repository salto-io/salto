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


import { CORE_ANNOTATIONS, Field, getChangeData, InstanceElement, isInstanceElement, MapType, Values } from '@salto-io/adapter-api'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { FIELD_CONFIGURATION_TYPE_NAME } from '../../constants'

const replaceToMap = (instance: InstanceElement): void => {
  instance.value.fields = Object.fromEntries(instance.value.fields
    .filter((field: Values) => isResolvedReferenceExpression(field.id))
    .map((field: Values) => [
      field.id.elemID.name,
      field,
    ]))
}

const filter: FilterCreator = ({ config }) => ({
  name: 'replaceFieldConfigurationReferences',
  onFetch: async elements => {
    if (config.fetch.splitFieldConfiguration) {
      return
    }

    const fieldConfigType = findObject(elements, FIELD_CONFIGURATION_TYPE_NAME)
    if (fieldConfigType === undefined) {
      return
    }

    fieldConfigType.fields.fields = new Field(
      fieldConfigType,
      'fields',
      new MapType(fieldConfigType.fields.fields.refType),
      {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      }
    )

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .filter(instance => Array.isArray(instance.value.fields))
      .forEach(replaceToMap)
  },

  onDeploy: async changes => {
    if (config.fetch.splitFieldConfiguration) {
      return
    }

    changes
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .filter(instance => instance.value.fields !== undefined)
      .forEach(replaceToMap)
  },
})

export default filter
