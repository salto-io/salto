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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { mockClient } from '../../utils'
import jqlReferencesFilter from '../../../src/filters/jql/jql_references'
import { Filter } from '../../../src/filter'
import { DEFAULT_CONFIG } from '../../../src/config'
import { JIRA, STATUS_TYPE_NAME } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('jqlReferencesFilter', () => {
  let filter: Filter
  let type: ObjectType
  let instance: InstanceElement
  let connection: MockInterface<clientUtils.APIConnection>
  let fieldInstance: InstanceElement
  let doneInstance: InstanceElement
  let todoInstance: InstanceElement


  beforeEach(async () => {
    const { client, paginator, connection: conn } = mockClient()
    connection = conn

    filter = jqlReferencesFilter({
      client,
      paginator,
      config: DEFAULT_CONFIG,
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'Filter'),
      fields: {
        jql: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        jql: 'status = Done',
      }
    )

    fieldInstance = new InstanceElement(
      'field',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
      {
        name: 'Status',
      }
    )

    doneInstance = new InstanceElement(
      'done',
      new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) }),
      {
        name: 'Done',
      }
    )
    todoInstance = new InstanceElement(
      'todo',
      new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) }),
      {
        name: 'To Do',
      }
    )

    connection.post.mockResolvedValue({
      status: 200,
      data: {
        queries: [
          {
            query: 'status = Done',
            structure: {
              where: {
                field: {
                  name: 'status',
                },
                operator: '=',
                operand: {
                  value: 'Done',
                },
              },
            },
            errors: [],
          },
        ],
      },
    })
  })

  describe('onFetch', () => {
    it('should add the jql dependencies', async () => {
      await filter.onFetch?.([instance, fieldInstance, doneInstance, todoInstance])
      expect(instance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual([
        {
          reference: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
          occurrences: [
            {
              location: new ReferenceExpression(instance.elemID.createNestedID('jql'), 'status = Done'),
            },
          ],
        },
        {
          reference: new ReferenceExpression(doneInstance.elemID, doneInstance),
          occurrences: [
            {
              location: new ReferenceExpression(instance.elemID.createNestedID('jql'), 'status = Done'),
            },
          ],
        },
      ])

      expect(connection.post).toHaveBeenCalledWith(
        '/rest/api/3/jql/parse',
        {
          queries: ['status = Done'],
        },
        {
          params: {
            validation: 'none',
          },
        },
      )
    })

    it('should parse correctly jql with multiple values', async () => {
      const jql = 'status IN (Done, "To Do") AND otherfield = 2 AND issuetype = 3'
      connection.post.mockResolvedValue({
        status: 200,
        data: {
          queries: [
            {
              query: jql,
              structure: {
                otherField: 2,
                where: {
                  clauses: [
                    {
                      field: {
                        name: 'status',
                      },
                      operator: 'in',
                      operand: {
                        values: [
                          {
                            value: 'Done',
                          },
                          {
                            value: 'To Do',
                          },
                        ],
                      },
                    },
                    {
                      field: {
                        name: 'status',
                      },
                      operator: 'in',
                    },
                    {
                      field: {
                        name: 'otherfield',
                      },
                      operator: '=',
                    },
                    {
                      field: {
                        name: 'issuetype',
                      },
                      operator: '=',
                      operand: {
                        value: '3',
                      },
                    },
                  ],
                  operator: 'and',
                },
              },
              errors: [],
            },
          ],
        },
      })

      instance.value.jql = jql

      const issueTypeField = new InstanceElement(
        'issuetype',
        new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
        {
          name: 'Issue Type',
        }
      )

      await filter.onFetch?.([instance, fieldInstance, doneInstance, todoInstance, issueTypeField])
      expect(instance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toEqual([
        {
          reference: new ReferenceExpression(fieldInstance.elemID, fieldInstance),
          occurrences: [
            {
              location: new ReferenceExpression(instance.elemID.createNestedID('jql'), jql),
            },
          ],
        },
        {
          reference: new ReferenceExpression(issueTypeField.elemID, issueTypeField),
          occurrences: [
            {
              location: new ReferenceExpression(instance.elemID.createNestedID('jql'), jql),
            },
          ],
        },
        {
          reference: new ReferenceExpression(doneInstance.elemID, doneInstance),
          occurrences: [
            {
              location: new ReferenceExpression(instance.elemID.createNestedID('jql'), jql),
            },
          ],
        },
        {
          reference: new ReferenceExpression(todoInstance.elemID, todoInstance),
          occurrences: [
            {
              location: new ReferenceExpression(instance.elemID.createNestedID('jql'), jql),
            },
          ],
        },
      ])
    })

    it('should throw if jql pares response in invalid', async () => {
      connection.post.mockResolvedValue({
        status: 200,
        data: {},
      })
      await expect(filter.onFetch?.([instance, fieldInstance, doneInstance])).rejects.toThrow()
    })
  })
})
