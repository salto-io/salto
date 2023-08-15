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
import { filterUtils, client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { ObjectType, ElemID, InstanceElement, BuiltinTypes, ListType, ReferenceExpression, Element, isInstanceElement, isObjectType, getChangeData } from '@salto-io/adapter-api'
import _, { after } from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../../src/config/config'
import JiraClient from '../../../src/client/client'
import issueLayoutFilter from '../../../src/filters/issue_layout/issue_layout'
import { getFilterParams, mockClient } from '../../utils'
import { ISSUE_LAYOUT_TYPE, JIRA, PROJECT_TYPE, SCREEN_SCHEME_TYPE } from '../../../src/constants'
import { createIssueLayoutType } from '../../../src/filters/issue_layout/issue_layout_types'

describe('issue layout filter', () => {
  let connection: MockInterface<clientUtils.APIConnection>
  let fetchQuery: MockInterface<elementUtils.query.ElementQuery>
  let mockGet: jest.SpyInstance
  let client: JiraClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType
  let elements: Element[]
  let screenType: ObjectType
  let screenInstance: InstanceElement
  let screenSchemeType: ObjectType
  let screenSchemeInstance: InstanceElement
  let issueTypeScreenSchemeItemType: ObjectType
  let issueTypeScreenSchemeType: ObjectType
  let issueTypeScreenSchemeInstance: InstanceElement
  let projectType: ObjectType
  let projectInstance: InstanceElement
  let issueTypeType: ObjectType
  let issueTypeInstance: InstanceElement
  let fieldType: ObjectType
  let fieldInstance1: InstanceElement
  let fieldInstance2: InstanceElement
  const mockCli = mockClient()

  beforeEach(async () => {
    client = mockCli.client
    connection = mockCli.connection
    filter = issueLayoutFilter(getFilterParams({ client })) as typeof filter
    screenType = new ObjectType({ elemID: new ElemID(JIRA, 'Screen'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
      } })
    screenInstance = new InstanceElement(
      'screen1',
      screenType,
      {
        id: 11,
      }
    )

    screenSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, SCREEN_SCHEME_TYPE),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        screens: { refType: screenType },
      },
    })
    screenSchemeInstance = new InstanceElement(
      'screenScheme1',
      screenSchemeType,
      {
        id: 111,
        screens: { default: new ReferenceExpression(screenInstance.elemID, screenInstance) },
      }
    )

    issueTypeScreenSchemeItemType = new ObjectType({
      elemID: new ElemID(JIRA, 'IssueTypeScreenSchemeItem'),
      fields: {
        issueTypeId: { refType: BuiltinTypes.STRING },
        screenSchemeId: { refType: screenSchemeType },
      },
    })
    issueTypeScreenSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'IssueTypeScreenScheme'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        issueTypeMappings: { refType: new ListType(issueTypeScreenSchemeItemType) },
      },
    })
    issueTypeScreenSchemeInstance = new InstanceElement(
      'issueTypeScreenScheme1',
      issueTypeScreenSchemeType,
      {
        id: 1111,
        issueTypeMappings: [
          {
            issueTypeId: 1,
            screenSchemeId: new ReferenceExpression(screenSchemeInstance.elemID, screenSchemeInstance),
          },
        ],
      }
    )
    projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        issueTypeScreenScheme: { refType: issueTypeScreenSchemeType },
      },
    })
    projectInstance = new InstanceElement(
      'project1',
      projectType,
      {
        id: 11111,
        name: 'project1',
        issueTypeScreenScheme:
          new ReferenceExpression(issueTypeScreenSchemeInstance.elemID, issueTypeScreenSchemeInstance),
      }
    )
    issueTypeType = new ObjectType({ elemID: new ElemID(JIRA, 'IssueType') })
    issueTypeInstance = new InstanceElement(
      'issueType1',
      issueTypeType,
      {
        id: '100',
        name: 'OwnerTest',
      }
    )
    fieldType = new ObjectType({ elemID: new ElemID(JIRA, 'Field') })
    fieldInstance1 = new InstanceElement(
      'testField1',
      fieldType,
      {
        id: 'testField1',
        name: 'TestField1',
      }
    )
    fieldInstance2 = new InstanceElement(
      'testField2',
      fieldType,
      {
        id: 'testField2',
        name: 'TestField2',
      }
    )
    elements = [
      screenType,
      screenInstance,
      screenSchemeType,
      screenSchemeInstance,
      issueTypeScreenSchemeItemType,
      issueTypeScreenSchemeType,
      issueTypeScreenSchemeInstance,
      projectType,
      projectInstance,
      issueTypeType,
      issueTypeInstance,
      fieldType,
      fieldInstance1,
      fieldInstance2,
    ]
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      client = mockCli.client
      mockGet = jest.spyOn(client, 'gqlPost')
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/gira/1') {
          return {
            data: {
              issueLayoutConfiguration: {
                issueLayoutResult: {
                  id: '2',
                  name: 'Default Issue Layout',
                  usageInfo: {
                    edges: [{
                      node: {
                        layoutOwners: [{
                          avatarId: '3',
                          description: 'ownerTest',
                          iconUrl: 'www.icon.com',
                          id: '100',
                          name: 'ownerTest',
                        }],
                      },
                    }],
                  },
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
              },
            },
          }
        }
        throw new Error('Err')
      })
    })
    it('should add all subTypes to the elements', async () => {
      await filter.onFetch(elements)
      expect(elements.filter(isObjectType).map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'jira.Field',
          'jira.IssueLayout',
          'jira.IssueLayoutDataOwner',
          'jira.IssueLayoutOwner',
          'jira.IssueType',
          'jira.IssueTypeScreenScheme',
          'jira.IssueTypeScreenSchemeItem',
          'jira.Project',
          'jira.Screen',
          'jira.ScreenScheme',
          'jira.issueLayoutConfig',
          'jira.issueLayoutItem',

        ])
    })
    it('should add issue layout to the elements', async () => {
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
      expect(issueLayoutInstance).toBeDefined()
      expect(issueLayoutInstance?.value).toEqual({
        id: '2',
        projectId: new ReferenceExpression(projectInstance.elemID, projectInstance),
        extraDefinerId: new ReferenceExpression(screenInstance.elemID, screenInstance),
        owners: [
          new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance),
        ],
        issueLayoutConfig: {
          items: [
            {
              type: 'FIELD',
              sectionType: 'PRIMARY',
              key: new ReferenceExpression(fieldInstance1.elemID, fieldInstance1),
            },
            {
              type: 'FIELD',
              sectionType: 'SECONDARY',
              key: new ReferenceExpression(fieldInstance2.elemID, fieldInstance2),
            },
          ],
        },
      })
    })
    it('should not add issue layout if there is no issueTypeScreenScheme', async () => {
      projectInstance.value.issueTypeScreenScheme = undefined
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
      expect(issueLayoutInstance).toBeUndefined()
    })
    it('should not add issue layout if it is a bad response', async () => {
      mockGet.mockImplementation(() => ({
        status: 200,
        data: {
        },
      }))
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
      expect(issueLayoutInstance).toBeUndefined()
    })
    it('should catch an error if gql post throws an error and return undefined', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('err')
      })
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
      expect(issueLayoutInstance).toBeUndefined()
    })
    it('should add key as missing ref if there is no field', async () => {
      fieldInstance1.value.id = 'testField3'
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
      expect(issueLayoutInstance?.value.issueLayoutConfig.items[0].key).toBeInstanceOf(ReferenceExpression)
      expect(issueLayoutInstance?.value.issueLayoutConfig.items[0].key.elemID.getFullName()).toEqual('jira.Field.instance.missing_testField1')
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
                  usageInfo: {
                    edges: [{
                      node: {
                        layoutOwners: [{
                          avatarId: '3',
                          description: 'ownerTest',
                          iconUrl: 'www.icon.com',
                          id: '100',
                          name: 'ownerTest',
                        }],
                      },
                    }],
                  },
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
              },
            },
          }
        }
        throw new Error('Err')
      })
      const configWithMissingRefs = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      configWithMissingRefs.fetch.enableMissingReferences = false
      filter = issueLayoutFilter(getFilterParams({ config: configWithMissingRefs, client })) as FilterType
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const issueLayoutInstance = instances.find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
      expect(issueLayoutInstance?.value.issueLayoutConfig.items[0].key).toEqual('testField4')
    })
    it('should not fetch issue layouts if it was excluded', async () => {
      fetchQuery = elementUtils.query.createMockQuery()
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      filter = issueLayoutFilter(getFilterParams({
        client,
        config,
        fetchQuery,
      })) as FilterType
      filter = issueLayoutFilter(getFilterParams({ config, client, fetchQuery })) as FilterType
      fetchQuery.isTypeMatch.mockReturnValue(false)
      await filter.onFetch(elements)
      expect(connection.post).not.toHaveBeenCalled()
    })
  })
  it('should not fetch issue layouts if it is a data center instance', async () => {
    const configWithDataCenterTrue = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    filter = issueLayoutFilter(getFilterParams({
      client,
      config: configWithDataCenterTrue,
    })) as FilterType
    filter = issueLayoutFilter(getFilterParams({ config: configWithDataCenterTrue, client })) as FilterType
    await filter.onFetch(elements)
    expect(connection.post).not.toHaveBeenCalled()
  })
  describe('deploy', () => {
    let issueLayoutInstance: InstanceElement
    let afterIssueLayoutInstance: InstanceElement
    const { issueLayoutType } = createIssueLayoutType()
    beforeEach(() => {
      client = mockCli.client
      connection = mockCli.connection
      issueLayoutInstance = new InstanceElement(
        'issueLayout',
        issueLayoutType,
        {
          id: '2',
          projectId: new ReferenceExpression(projectInstance.elemID, projectInstance),
          extraDefinerId: new ReferenceExpression(screenInstance.elemID, screenInstance),
          owners: [
            new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance),
          ],
          issueLayoutConfig: {
            items: [
              {
                type: 'FIELD',
                sectionType: 'PRIMARY',
                key: new ReferenceExpression(fieldInstance1.elemID, fieldInstance1),
              },
              {
                type: 'FIELD',
                sectionType: 'SECONDARY',
                key: new ReferenceExpression(fieldInstance2.elemID, fieldInstance2),
              },
            ],
          },
        }
      )
      afterIssueLayoutInstance = issueLayoutInstance.clone()
    })
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should add issue layout to the elements', async () => {
      const res = await filter.deploy([
        { action: 'add', data: { after: issueLayoutInstance } },
        { action: 'add', data: { after: projectInstance } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value)
        .toEqual(projectInstance.value)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'add', data: { after: issueLayoutInstance } }
      )
    })
    it('should modify issue layout', async () => {
      const fieldInstance3 = new InstanceElement(
        'testField3',
        fieldType,
        {
          id: 'testField3',
          name: 'TestField3',
        }
      )
      afterIssueLayoutInstance.value.issueLayoutConfig.items[2] = {
        type: 'FIELD',
        sectionType: 'PRIMARY',
        key: new ReferenceExpression(fieldInstance3.elemID, fieldInstance3),
      }
      const res = await filter.deploy([
        { action: 'modify', data: { before: issueLayoutInstance, after: afterIssueLayoutInstance } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'modify', data: { before: issueLayoutInstance, after: afterIssueLayoutInstance } }
      )
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/internal/1.0/issueLayouts/2',
        { extraDefinerId: 11,
          projectId: 11111,
          owners: [],
          issueLayoutType: 'ISSUE_VIEW',
          issueLayoutConfig: {
            items: [
              { key: 'testField1',
                sectionType: 'primary',
                type: 'FIELD',
                data: {
                  name: 'TestField1',
                  type: 'testField1',
                } },
              { key: 'testField2',
                sectionType: 'secondary',
                type: 'FIELD',
                data: {
                  name: 'TestField2',
                  type: 'testField2',
                } },
              { key: 'testField3',
                sectionType: 'primary',
                type: 'FIELD',
                data: {
                  name: 'TestField3',
                  type: 'testField3',
                } },
            ],
          } },
        undefined
      )
    })
    it('should not add item if its key is not a reference expression', async () => {
      afterIssueLayoutInstance.value.issueLayoutConfig.items[2] = {
        type: 'FIELD',
        sectionType: 'PRIMARY',
        key: 'testField3',
      }
      const res = await filter.deploy([
        { action: 'modify', data: { before: issueLayoutInstance, after: afterIssueLayoutInstance } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(
        { action: 'modify', data: { before: issueLayoutInstance, after: afterIssueLayoutInstance } }
      )
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/internal/1.0/issueLayouts/2',
        { extraDefinerId: 11,
          projectId: 11111,
          owners: [],
          issueLayoutType: 'ISSUE_VIEW',
          issueLayoutConfig: {
            items: [
              { key: 'testField1',
                sectionType: 'primary',
                type: 'FIELD',
                data: {
                  name: 'TestField1',
                  type: 'testField1',
                } },
              { key: 'testField2',
                sectionType: 'secondary',
                type: 'FIELD',
                data: {
                  name: 'TestField2',
                  type: 'testField2',
                } }],
          } },
        undefined
      )
    })
    it('should not add item if its project is not a reference expression', async () => {
      issueLayoutInstance.value.projectId = 6565
      await filter.deploy([
        { action: 'add', data: { after: issueLayoutInstance } },
      ])
      expect(connection.put).not.toHaveBeenCalled()
    })
  })
})
