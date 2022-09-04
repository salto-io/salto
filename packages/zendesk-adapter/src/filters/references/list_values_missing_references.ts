/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { FETCH_CONFIG } from '../../config'
import { FilterCreator } from '../../filter'
import { createMissingInstance } from './missing_references'

const log = logger(module)

type FieldMissingReferenceDefinition = {
  instanceType: string
  instancePath: string
  fieldNameToValueType: Record<string, string>
  valueIndexToRedefine: number
}

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

const isNumberStr = (str: string | undefined): boolean => (
  !_.isEmpty(str) && !Number.isNaN(Number(str))
)

/**
 * Convert field list values into references, based on predefined configuration.
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => log.time(async () => {
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
          if (fieldRefTypes.includes(obj.field)
            && !isReferenceExpression(valueToRedefine)
            && isNumberStr(valueToRedefine)) {
            const missingInstance = createMissingInstance(
              instance.elemID.adapter,
              def.fieldNameToValueType[obj.field],
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
  }, 'List values missing references filter'),
})

export default filter
