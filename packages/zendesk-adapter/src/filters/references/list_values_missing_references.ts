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
import _ from 'lodash'
import { Element, isInstanceElement, isReferenceExpression, ReferenceExpression } from '@salto-io/adapter-api'
import { FETCH_CONFIG } from '../../config'
import { FilterCreator } from '../../filter'
import { createMissingInstance, VALUES_TO_SKIP_BY_TYPE } from './missing_references'


type FieldMissingReferenceDefinition = {
  instanceType: string
  instancePath: string
  fieldNameToValueType: Record<string, string>
  valueIndexToRedefine: number
}

const isNumberStr = (str: string | undefined): boolean => (
  !_.isEmpty(str) && !Number.isNaN(Number(str))
)

const NON_NUMERIC_MISSING_VALUES_TYPES = ['webhook']

const potentiallyMissingListValues: FieldMissingReferenceDefinition[] = [
  {
    instanceType: 'automation',
    instancePath: 'actions',
    fieldNameToValueType: {
      notification_group: 'group',
      notification_target: 'target',
      notification_webhook: 'webhook',
    },
    valueIndexToRedefine: 0,
  },
  {
    instanceType: 'trigger',
    instancePath: 'actions',
    fieldNameToValueType: {
      notification_group: 'group',
      notification_sms_group: 'group',
      notification_target: 'target',
      notification_webhook: 'webhook',
    },
    valueIndexToRedefine: 0,
  },
]

/**
 * Convert field list values into references, based on predefined configuration.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'listValuesMissingReferencesFilter',
  onFetch: async (elements: Element[]) => {
    if (!config[FETCH_CONFIG].enableMissingReferences) {
      return
    }
    potentiallyMissingListValues.forEach(def => {
      const fieldRefTypes = Object.keys(def.fieldNameToValueType)
      const instances = elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === def.instanceType)
      instances.forEach(instance => {
        const valueObjects = _.get(instance.value, def.instancePath)
        if (!_.isArray(valueObjects)) {
          return
        }
        valueObjects.forEach(obj => {
          const valueToRedefine = obj.value[def.valueIndexToRedefine]
          const valueType = def.fieldNameToValueType[obj.field]
          if (fieldRefTypes.includes(obj.field)
            && !isReferenceExpression(valueToRedefine)
            && !VALUES_TO_SKIP_BY_TYPE[valueType]?.includes(valueToRedefine)
            && _.isArray(obj.value) // INCIDENT-3157, Handle cases when for some reason the value is a string
            && (isNumberStr(valueToRedefine)
              || NON_NUMERIC_MISSING_VALUES_TYPES.includes(valueType)
            )) {
            const missingInstance = createMissingInstance(
              instance.elemID.adapter,
              valueType,
              valueToRedefine
            )
            obj.value[def.valueIndexToRedefine] = new ReferenceExpression(
              missingInstance.elemID,
              missingInstance
            )
          }
        })
      })
    })
  },
})

export default filter
