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
import _, { keys } from 'lodash'
import { Element, isInstanceElement, isReferenceExpression, ReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { createMissingInstance } from './missing_references'

const log = logger(module)

type FieldMissingReferenceDefinition = {
  instanceType: string
  instancePath: string
  fieldNameToValueType: Record<string, string>
}

const potentiallyMissingListValues: FieldMissingReferenceDefinition[] = [
  {
    instanceType: 'trigger',
    instancePath: 'actions',
    fieldNameToValueType: {
      notification_sms_group: 'group',
      notification_group: 'group',
    },
  },
  {
    instanceType: 'trigger',
    instancePath: 'actions',
    fieldNameToValueType: { notification_sms_group: 'group' },
  },
]

const isNumberStr = (str: string | undefined): boolean => (
  !_.isEmpty(str) && !Number.isNaN(_.toNumber(str))
)

/**
 * Convert field list values into references, based on predefined configuration.
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => log.time(async () => {
    potentiallyMissingListValues.forEach(def => {
      const fieldRefTypes = keys(def.fieldNameToValueType)
      const instances = elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === def.instanceType)
      instances.forEach(instance => {
        const valueObjects = _.get(instance.value, def.instancePath)
        if (!_.isArray(valueObjects)) {
          return
        }
        valueObjects.forEach(obj => {
          if (fieldRefTypes.includes(obj.field)
            && !isReferenceExpression(obj.value[0])
            && isNumberStr(obj.value[0])) {
            const missingInstance = createMissingInstance(
              instance.elemID.adapter,
              def.fieldNameToValueType[obj.field],
              obj.value[0]
            )
            obj.value[0] = new ReferenceExpression(missingInstance.elemID, missingInstance)
          }
        })
      })
    })
  }, 'List values missing references filter'),
})

export default filter
