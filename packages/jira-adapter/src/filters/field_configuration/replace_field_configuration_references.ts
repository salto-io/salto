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

import { CORE_ANNOTATIONS, ElemID, Field, getChangeData, InstanceElement, isInstanceElement, isReferenceExpression, MapType, ReadOnlyElementsSource, ReferenceExpression, Value, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { FIELD_CONFIGURATION_TYPE_NAME, JIRA } from '../../constants'
import { FIELD_TYPE_NAME } from '../fields/constants'

const log = logger(module)

const { awu } = collections.asynciterable

const replaceToMap = (instance: InstanceElement): void => {
  instance.value.fields = Object.fromEntries(instance.value.fields
    .filter((field: Values) => isReferenceExpression(field.id))
    .map((field: Values) => [
      field.id.elemID.name,
      _.omit(field, 'id'),
    ]))
}

const replaceFromMap = async (
  instance: InstanceElement,
  elementSource: ReadOnlyElementsSource,
): Promise<void> => {
  instance.value.fields = await awu(Object.entries(instance.value.fields))
    .map(async ([id, config]: [string, Value]) => {
      const elemId = new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', id)
      const fieldInstance = await elementSource.get(elemId)
      if (fieldInstance === undefined) {
        log.debug(`Omitting element id ${elemId.getFullName()} from ${instance.elemID.getFullName()} since it does not exist in the account`)
        return undefined
      }
      return {
        id: new ReferenceExpression(elemId, fieldInstance),
        ...config,
      }
    })
    .filter(values.isDefined)
    .toArray()
}


const filter: FilterCreator = ({ config, elementsSource }) => {
  const instanceToFields: Record<string, Values> = {}
  return {
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

    preDeploy: async changes => {
      if (config.fetch.splitFieldConfiguration) {
        return
      }

      await awu(changes)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
        .filter(instance => instance.value.fields !== undefined)
        .forEach(async instance => {
          instanceToFields[instance.elemID.getFullName()] = instance.value.fields
          await replaceFromMap(instance, elementsSource)
        })
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
        .forEach(instance => {
          instance.value.fields = instanceToFields[instance.elemID.getFullName()]
        })
    },
  }
}

export default filter
