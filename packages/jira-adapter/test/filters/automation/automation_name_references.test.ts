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
import { InstanceElement, ObjectType, ReferenceExpression, ElemID } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { mockClient } from '../../utils'
import automationNameReferencesFilter from '../../../src/filters/automation/automation_name_references'
import { getDefaultConfig } from '../../../src/config'
import { createAutomationTypes } from '../../../src/filters/automation/types'
import { JIRA } from '../../../src/constants'


describe('automationNameReferencesTest', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let type: ObjectType
  let instance: InstanceElement
  let fieldInstance: InstanceElement

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = automationNameReferencesFilter({
      client,
      paginator,
      config: getDefaultConfig({ isDataCenter: false }),
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as typeof filter

    type = createAutomationTypes().automationType

    fieldInstance = new InstanceElement(
      'fieldInstance',
      new ObjectType({
        elemID: new ElemID(JIRA, 'FieldType'),
      }),
      {
        id: '10003',
        name: 'field',
      }
    )

    instance = new InstanceElement(
      'instance',
      type,
      {
        id: '1',
        trigger: {
          component: 'TRIGGER',
          type: 'jira.issue.event.trigger:created',
          value: {
            fromStatus: [
              {
                type: 'NAME',
                value: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
              },
            ],
            toStatus: [
              {
                type: 'ID',
                value: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
              },
            ],
          },
        },
        components: [
          {
            id: '2',
            component: 'ACTION',
            value: {
              selectedField: {
                type: 'NAME',
                value: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
              },
            },
            updated: 1234,
          },
          {
            id: '1',
            component: 'CONDITION',
            value: {
              operations: [
                {
                  field: {
                    type: 'NAME',
                    value: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
                  },
                  fieldType: 'summary',
                },
                {
                  field: {
                    type: 'ID',
                    value: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
                  },
                },
              ],
            },
            updated: 1111,
          },
        ],
      }
    )
  })

  describe('onFetch', () => {
    it('should replace field of type name to type id', async () => {
      await filter.onFetch([instance])
      expect(instance.value.trigger.value.fromStatus[0].type).toEqual('ID')
      expect(instance.value.components[0].value.selectedField.type).toEqual('ID')
      expect(instance.value.components[1].value.operations[0].field.type).toEqual('ID')
    })

    it('should do nothin for field of type id', async () => {
      await filter.onFetch([instance])
      expect(instance.value.trigger.value.toStatus[0].type).toEqual('ID')
      expect(instance.value.components[1].value.operations[1].field.type).toEqual('ID')
    })
  })
})
