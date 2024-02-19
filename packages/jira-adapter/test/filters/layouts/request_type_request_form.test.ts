/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  filterUtils,
  client as clientUtils,
  elements as elementUtils,
  elements as adapterElements,
} from '@salto-io/adapter-components'
import {
  ObjectType,
  ElemID,
  InstanceElement,
  BuiltinTypes,
  ReferenceExpression,
  Element,
  isInstanceElement,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'
import JiraClient from '../../../src/client/client'
import requestTypeLayoutsFilter from '../../../src/filters/layouts/request_type_request_form'
import { getFilterParams, mockClient } from '../../utils'
import { JIRA, PROJECT_TYPE, REQUEST_FORM_TYPE, REQUEST_TYPE_NAME } from '../../../src/constants'

describe('requestTypeLayoutsFilter', () => {
  let connection: MockInterface<clientUtils.APIConnection>
  let fetchQuery: MockInterface<elementUtils.query.ElementQuery>
  let mockGet: jest.SpyInstance
  let client: JiraClient
  let config: JiraConfig
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType
  let elements: Element[]
  let projectType: ObjectType
  let projectInstance: InstanceElement
  let requestTypeType: ObjectType
  let requestTypeInstance: InstanceElement
  let fieldType: ObjectType
  let fieldInstance1: InstanceElement
  let fieldInstance2: InstanceElement
  const mockCli = mockClient()

  beforeEach(async () => {
    client = mockCli.client
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      client = mockCli.client
      connection = mockCli.connection
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      filter = requestTypeLayoutsFilter(getFilterParams({ client, config })) as typeof filter
      projectType = new ObjectType({
        elemID: new ElemID(JIRA, PROJECT_TYPE),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
        },
      })
      projectInstance = new InstanceElement(
        'project1',
        projectType,
        {
          id: 11111,
          name: 'project1',
          simplified: false,
          projectTypeKey: 'service_desk',
        },
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1'],
      )
      requestTypeType = new ObjectType({ elemID: new ElemID(JIRA, 'RequestType') })
      requestTypeInstance = new InstanceElement(
        'issueType1',
        requestTypeType,
        {
          id: '100',
          name: 'requestTypeTest',
        },
        [JIRA, adapterElements.RECORDS_PATH, REQUEST_TYPE_NAME, 'issueType1'],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      fieldType = new ObjectType({ elemID: new ElemID(JIRA, 'Field') })
      fieldInstance1 = new InstanceElement('testField1', fieldType, {
        id: 'testField1',
        name: 'TestField1',
        type: 'testField1',
      })
      fieldInstance2 = new InstanceElement('testField2', fieldType, {
        id: 'testField2',
        name: 'TestField2',
        schema: {
          system: 'testField2',
        },
      })

      mockGet = jest.spyOn(client, 'gqlPost')
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/gira/1') {
          return {
            data: {
              issueLayoutConfiguration: {
                issueLayoutResult: {
                  id: '2',
                  name: 'Default Request Form',
                  containers: [
                    {
                      containerType: 'PRIMARY',
                      items: {
                        nodes: [
                          {
                            fieldItemId: 'testField1',
                          },
                        ],
                      },
                    },
                    {
                      containerType: 'SECONDARY',
                      items: {
                        nodes: [
                          {
                            fieldItemId: 'testField2',
                          },
                        ],
                      },
                    },
                  ],
                },
                metadata: {
                  configuration: {
                    items: {
                      nodes: [
                        {
                          fieldItemId: 'testField1',
                          required: true,
                        },
                        {
                          fieldItemId: 'testField2',
                          required: false,
                        },
                      ],
                    },
                  },
                },
              },
            },
          }
        }
        throw new Error('Err')
      })
      elements = [
        projectType,
        projectInstance,
        requestTypeType,
        requestTypeInstance,
        fieldType,
        fieldInstance1,
        fieldInstance2,
      ]
    })
    it('should add layout to the elements', async () => {
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === REQUEST_FORM_TYPE)
      expect(issueLayoutInstance).toBeDefined()
    })
    it('should not add layout if requestType has no valid parent', async () => {
      const requestTypeInstanceNoParent = requestTypeInstance.clone()
      requestTypeInstanceNoParent.annotations[CORE_ANNOTATIONS.PARENT] = []
      elements = [
        projectType,
        projectInstance,
        requestTypeType,
        requestTypeInstanceNoParent,
        fieldType,
        fieldInstance1,
        fieldInstance2,
      ]
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === REQUEST_FORM_TYPE)
      expect(issueLayoutInstance).toBeUndefined()
    })
    it('should not add layout if it is a bad response', async () => {
      mockGet.mockImplementation(() => ({
        status: 200,
        data: {},
      }))
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === REQUEST_FORM_TYPE)
      expect(issueLayoutInstance).toBeUndefined()
    })
    it('should catch an error if gql post throws an error and return undefined', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('err')
      })
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === REQUEST_FORM_TYPE)
      expect(issueLayoutInstance).toBeUndefined()
    })
    it('should not add missing reference if enableMissingRef is false', async () => {
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/gira/1') {
          return {
            data: {
              issueLayoutConfiguration: {
                issueLayoutResult: {
                  id: '2',
                  name: 'Default Issue Layout',
                  containers: [
                    {
                      containerType: 'PRIMARY',
                      items: {
                        nodes: [
                          {
                            fieldItemId: 'testField4',
                          },
                        ],
                      },
                    },
                    {
                      containerType: 'SECONDARY',
                      items: {
                        nodes: [
                          {
                            fieldItemId: 'testField2',
                          },
                        ],
                      },
                    },
                  ],
                },
                metadata: {
                  configuration: {
                    items: {
                      nodes: [
                        {
                          fieldItemId: 'testField1',
                          required: true,
                        },
                        {
                          fieldItemId: 'testField2',
                          required: false,
                        },
                      ],
                    },
                  },
                },
              },
            },
          }
        }
        throw new Error('Err')
      })
      const configWithMissingRefs = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      configWithMissingRefs.fetch.enableMissingReferences = false
      configWithMissingRefs.fetch.enableJSM = true
      filter = requestTypeLayoutsFilter(getFilterParams({ config: configWithMissingRefs, client })) as FilterType
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === REQUEST_FORM_TYPE)
      expect(issueLayoutInstance?.value.issueLayoutConfig.items[0].key).toEqual('testField4')
    })
    it('should not fetch layouts if it was excluded', async () => {
      fetchQuery = elementUtils.query.createMockQuery()
      filter = requestTypeLayoutsFilter(
        getFilterParams({
          client,
          config,
          fetchQuery,
        }),
      ) as FilterType
      filter = requestTypeLayoutsFilter(getFilterParams({ config, client, fetchQuery })) as FilterType
      fetchQuery.isTypeMatch.mockReturnValue(false)
      await filter.onFetch(elements)
      expect(connection.post).not.toHaveBeenCalled()
    })
    it('should not fetch issue layouts if it is a data center instance', async () => {
      const configWithDataCenterTrue = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      configWithDataCenterTrue.fetch.enableJSM = true
      filter = requestTypeLayoutsFilter(
        getFilterParams({
          client,
          config: configWithDataCenterTrue,
        }),
      ) as FilterType

      filter = requestTypeLayoutsFilter(getFilterParams({ config: configWithDataCenterTrue, client })) as FilterType
      await filter.onFetch(elements)
      expect(connection.post).not.toHaveBeenCalled()
    })
    it('should use elemIdGetter', async () => {
      filter = requestTypeLayoutsFilter(
        getFilterParams({
          client,
          config,
          getElemIdFunc: () => new ElemID(JIRA, 'someName'),
        }),
      ) as FilterType
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === REQUEST_FORM_TYPE)
      expect(issueLayoutInstance?.elemID.getFullName()).toEqual('jira.RequestForm.instance.someName')
    })
    it('should add request form when metadata is null', async () => {
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/gira/1') {
          return {
            data: {
              issueLayoutConfiguration: {
                issueLayoutResult: {
                  id: '2',
                  name: 'Default Issue Layout',
                  containers: [
                    {
                      containerType: 'PRIMARY',
                      items: {
                        nodes: [
                          {
                            fieldItemId: 'testField1',
                          },
                        ],
                      },
                    },
                    {
                      containerType: 'SECONDARY',
                      items: {
                        nodes: [
                          {
                            fieldItemId: 'testField2',
                          },
                        ],
                      },
                    },
                  ],
                },
                metadata: null,
              },
            },
          }
        }
        throw new Error('Err')
      })
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === REQUEST_FORM_TYPE)
      expect(issueLayoutInstance).toBeDefined()
    })
  })
})
