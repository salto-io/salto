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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, BuiltinTypes } from '@salto-io/adapter-api'
import { STATUS_TYPE_NAME, JIRA } from '../src/constants'
import { getAutomationValuesLookupFunc } from '../src/reference_mapping'
import { createAutomationTypes } from '../src/filters/automation/types'

describe('reference mapping', () => {
  describe('serialization methods', () => {
    let type: ObjectType
    let automationInstance: InstanceElement
    let referenceType: ObjectType
    let referenceInstance: InstanceElement

    beforeEach(() => {
      type = createAutomationTypes().automationType

      referenceType = new ObjectType({
        elemID: new ElemID(JIRA, STATUS_TYPE_NAME, 'type'),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
          name: { refType: BuiltinTypes.STRING },
          description: { refType: BuiltinTypes.STRING },
        },
      })

      referenceInstance = new InstanceElement(
        'newStatus',
        referenceType,
        {
          id: 3,
          name: 'newStatus',
          description: 'a new status',
        }
      )

      automationInstance = new InstanceElement(
        'instance',
        type,
        {
          id: '111',
          trigger: {
            component: 'TRIGGER',
            type: 'jira.issue.event.trigger:created',
          },
          components: [
            {
              id: '0',
              component: 'CONDITION',
              value: {
                selectedField: {
                  type: 'NAME',
                  value: new ReferenceExpression(referenceInstance.elemID, referenceInstance),
                },
              },
            },
            {
              id: '1',
              component: 'CONDITION',
              value: {
                operations: [
                  {
                    field: {
                      type: 'ID',
                      value: new ReferenceExpression(referenceInstance.elemID, referenceInstance),
                    },
                  },
                  {
                    field: {
                      type: 'field',
                      value: new ReferenceExpression(referenceInstance.elemID, referenceInstance),
                    },
                  },
                ],
                value: '123',
              },
              updated: 1111,
            },
          ],
        }
      )
    })

    it('should return the correct serialization method', () => {
      const nameSerialization = getAutomationValuesLookupFunc({
        ref: automationInstance.value.components[0].value.selectedField.value,
        path: automationInstance.elemID.createNestedID(...['components', '0', 'value', 'selectedField', 'value']),
        element: automationInstance,
      })
      const idSerialization = getAutomationValuesLookupFunc({
        ref: automationInstance.value.components[1].value.operations[0].field.value,
        path: automationInstance.elemID.createNestedID(...['components', '1', 'value', 'operations', '0', 'field', 'value']),
        element: automationInstance,
      })
      const defaultSerialization = getAutomationValuesLookupFunc({
        ref: automationInstance.value.components[1].value.operations[0].field.value,
        path: automationInstance.elemID.createNestedID(...['components', '1', 'value', 'operations', '1', 'field', 'value']),
        element: automationInstance,
      })
      expect(nameSerialization).toEqual('newStatus')
      expect(idSerialization).toEqual(3)
      expect(defaultSerialization).toBeInstanceOf(ReferenceExpression)
    })
  })
})
