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

import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, CORE_ANNOTATIONS, Value } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../src/config/config'
import requestTypeFilter from '../../src/filters/request_type'
import { createEmptyType, getFilterParams, mockClient } from '../utils'
import { PROJECT_TYPE, REQUEST_TYPE_NAME } from '../../src/constants'
import JiraClient from '../../src/client/client'

describe('requestType filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let connection: MockInterface<clientUtils.APIConnection>
  let client: JiraClient
  let mockGet: jest.SpyInstance
  let projectInstance: InstanceElement
  let requestTypeInstance: InstanceElement
  let workFlowStatusOne: Value
  let requestFormValue: Value
  let issueViewValue: Value
  const fieldInstanceOne = new InstanceElement('field1', createEmptyType('Field'), {
    id: 'testField1Id',
    name: 'field1',
    type: 'testField1Type',
  })
  const fieldInstanceTwo = new InstanceElement('field2', createEmptyType('Field'), {
    id: 'testField2Id',
    name: 'field2',
    type: 'testField2Type',
  })
  const statusInstanceOne = new InstanceElement('status1', createEmptyType('Status'), {
    id: '1000',
    name: 'status1',
  })
  describe('deploy', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      const { client: cli, connection: conn } = mockClient(false)
      connection = conn
      client = cli
      filter = requestTypeFilter(getFilterParams({ config, client })) as typeof filter
      projectInstance = new InstanceElement('project1', createEmptyType(PROJECT_TYPE), {
        id: 1,
        name: 'project1',
        projectTypeKey: 'service_desk',
        key: 'project1Key',
      })
      workFlowStatusOne = {
        id: new ReferenceExpression(statusInstanceOne.elemID, statusInstanceOne),
        custom: 'My custom status',
      }

      requestFormValue = {
        id: 4,
        issueLayoutConfig: {
          items: [
            {
              type: 'FIELD',
              sectionType: 'REQUEST',
              key: new ReferenceExpression(fieldInstanceOne.elemID, fieldInstanceOne),
            },
          ],
        },
      }

      issueViewValue = {
        if: 5,
        issueLayoutConfig: {
          items: [
            {
              type: 'FIELD',
              sectionType: 'REQUEST',
              key: new ReferenceExpression(fieldInstanceTwo.elemID, fieldInstanceTwo),
            },
          ],
        },
      }
      requestTypeInstance = new InstanceElement(
        'requestType1',
        createEmptyType(REQUEST_TYPE_NAME),
        {
          id: 10,
          name: 'requestType1',
          description: 'requestType1 description',
          workflowStatuses: [workFlowStatusOne],
          requestForm: requestFormValue,
          issueView: issueViewValue,
          avatarId: 'avatarId1',
          helpText: 'helpText1',
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      mockGet = jest.spyOn(client, 'gqlPost')
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
                metadata: {
                  configuration: {
                    items: {
                      nodes: [
                        {
                          fieldItemId: 'testField1',
                        },
                        {
                          fieldItemId: 'testField2',
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
    })
    it('should deploy addition of a request type', async () => {
      const res = await filter.deploy([{ action: 'add', data: { after: requestTypeInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      // One call to deploy requestType and one to deployy workflow statuses.
      expect(connection.post).toHaveBeenCalledTimes(2)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/servicedeskapi/servicedesk/projectId:1/requesttype',
        {
          id: 10,
          name: 'requestType1',
          description: 'requestType1 description',
          helpText: 'helpText1',
        },
        undefined,
      )
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/servicedesk/1/servicedesk-data/project1Key/request-type/10/workflow',
        [
          {
            custom: 'My custom status',
            id: '1000',
            original: 'status1',
          },
        ],
        undefined,
      )
      // one for requestForm and one for issueView
      expect(connection.put).toHaveBeenCalledTimes(2)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/internal/1.0/issueLayouts/2',
        {
          extraDefinerId: 10,
          projectId: 1,
          owners: [
            {
              type: 'REQUEST_TYPE',
              data: {
                id: 10,
                name: 'requestType1',
                description: 'requestType1 description',
                avatarId: 'avatarId1',
                instructions: 'helpText1',
              },
            },
          ],
          issueLayoutType: 'REQUEST_FORM',
          issueLayoutConfig: {
            items: [
              {
                key: 'testField1Id',
                sectionType: 'request',
                type: 'FIELD',
                data: {
                  name: 'field1',
                  type: 'testField1Type',
                },
              },
            ],
          },
        },
        undefined,
      )
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/internal/1.0/issueLayouts/2',
        {
          extraDefinerId: 10,
          projectId: 1,
          owners: [
            {
              type: 'REQUEST_TYPE',
              data: {
                id: 10,
                name: 'requestType1',
                description: 'requestType1 description',
                avatarId: 'avatarId1',
                instructions: 'helpText1',
              },
            },
          ],
          issueLayoutType: 'ISSUE_VIEW',
          issueLayoutConfig: {
            items: [
              {
                key: 'testField2Id',
                sectionType: 'request',
                type: 'FIELD',
                data: {
                  name: 'field2',
                  type: 'testField2Type',
                },
              },
            ],
          },
        },
        undefined,
      )
    })
    it('should deploy modification of a request type name', async () => {
      const requestTypeAfter = requestTypeInstance.clone()
      requestTypeAfter.value.name = 'requestType1Modified'
      const res = await filter.deploy([
        { action: 'modify', data: { before: requestTypeInstance, after: requestTypeAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(0)
      // one call to deploy requestForm
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/internal/1.0/issueLayouts/4',
        {
          extraDefinerId: 10,
          projectId: 1,
          owners: [
            {
              type: 'REQUEST_TYPE',
              data: {
                id: 10,
                name: 'requestType1Modified',
                description: 'requestType1 description',
                avatarId: 'avatarId1',
                instructions: 'helpText1',
              },
            },
          ],
          issueLayoutType: 'REQUEST_FORM',
          issueLayoutConfig: {
            items: [
              {
                key: 'testField1Id',
                sectionType: 'request',
                type: 'FIELD',
                data: {
                  name: 'field1',
                  type: 'testField1Type',
                },
              },
            ],
          },
        },
        undefined,
      )
    })
    it('should deploy modification of workflow statuses', async () => {
      const requestTypeAfter = requestTypeInstance.clone()
      requestTypeAfter.value.workflowStatuses = [
        {
          id: new ReferenceExpression(statusInstanceOne.elemID, statusInstanceOne),
          custom: 'My custom status modified',
        },
      ]
      const res = await filter.deploy([
        { action: 'modify', data: { before: requestTypeInstance, after: requestTypeAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.put).toHaveBeenCalledTimes(0)
      // one call to deploy workflow statuses
      expect(connection.post).toHaveBeenCalledTimes(1)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/servicedesk/1/servicedesk-data/project1Key/request-type/10/workflow',
        [
          {
            custom: 'My custom status modified',
            id: '1000',
            original: 'status1',
          },
        ],
        undefined,
      )
    })
    it('should deploy modification of request form', async () => {
      const requestTypeAfter = requestTypeInstance.clone()
      requestTypeAfter.value.requestForm = {
        id: 4,
        issueLayoutConfig: {
          items: [
            {
              type: 'FIELD',
              sectionType: 'REQUEST',
              key: new ReferenceExpression(fieldInstanceTwo.elemID, fieldInstanceTwo),
            },
          ],
        },
      }
      const res = await filter.deploy([
        { action: 'modify', data: { before: requestTypeInstance, after: requestTypeAfter } },
      ])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(0)
      // one call to deploy requestForm
      expect(connection.put).toHaveBeenCalledTimes(1)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/internal/1.0/issueLayouts/4',
        {
          extraDefinerId: 10,
          projectId: 1,
          owners: [
            {
              type: 'REQUEST_TYPE',
              data: {
                id: 10,
                name: 'requestType1',
                description: 'requestType1 description',
                avatarId: 'avatarId1',
                instructions: 'helpText1',
              },
            },
          ],
          issueLayoutType: 'REQUEST_FORM',
          issueLayoutConfig: {
            items: [
              {
                key: 'testField2Id',
                sectionType: 'request',
                type: 'FIELD',
                data: {
                  name: 'field2',
                  type: 'testField2Type',
                },
              },
            ],
          },
        },
        undefined,
      )
    })
    it('should deploy removal of a request type', async () => {
      const res = await filter.deploy([{ action: 'remove', data: { before: requestTypeInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(connection.post).toHaveBeenCalledTimes(0)
      expect(connection.put).toHaveBeenCalledTimes(0)
      expect(connection.delete).toHaveBeenCalledTimes(1)
    })
    it('should not deploy addition of bad workflow status', async () => {
      const requestTypeAfter = requestTypeInstance.clone()
      requestTypeAfter.value.workflowStatuses = [
        {
          id: 'not a reference',
          other: 'My custom status',
        },
      ]
      const res = await filter.deploy([{ action: 'add', data: { after: requestTypeAfter } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toContain(
        'Failed to deploy request type workflow statuses due to bad workflow statuses',
      )
    })
    it('should not deploy addition of bad request form', async () => {
      const requestTypeAfter = requestTypeInstance.clone()
      requestTypeAfter.value.requestForm.issueLayoutConfig.items[0].key = 'not a reference'
      const res = await filter.deploy([{ action: 'add', data: { after: requestTypeAfter } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toContain(
        'Error: Failed to deploy requestType requestForm due to a bad item key: not a reference',
      )
    })
    it('should not deploy requestType if bad issue Layout response', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('Err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: requestTypeInstance } }])
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toContain(
        "Error: Failed to deploy requestType's requestForm due to bad response from jira service",
      )
    })
  })
})
