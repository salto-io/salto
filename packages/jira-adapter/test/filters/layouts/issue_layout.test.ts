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
import { filterUtils, client as clientUtils, elements as elementUtils, elements as adapterElements } from '@salto-io/adapter-components'
import { ObjectType, ElemID, InstanceElement, BuiltinTypes, ListType, ReferenceExpression, Element, isInstanceElement, isObjectType, getChangeData, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { getDefaultConfig } from '../../../src/config/config'
import JiraClient from '../../../src/client/client'
import issueLayoutFilter from '../../../src/filters/layouts/issue_layout'
import { getFilterParams, mockClient } from '../../utils'
import { ISSUE_LAYOUT_TYPE, JIRA, PROJECT_TYPE, SCREEN_SCHEME_TYPE } from '../../../src/constants'
import { createLayoutType } from '../../../src/filters/layouts/layout_types'

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
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableIssueLayouts = true
    filter = issueLayoutFilter(getFilterParams({ client, config })) as typeof filter
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      client = mockCli.client
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
          simplified: { refType: BuiltinTypes.BOOLEAN },
          issueTypeScreenScheme: { refType: issueTypeScreenSchemeType },
          key: { refType: BuiltinTypes.STRING },
        },
      })
      projectInstance = new InstanceElement(
        'project1',
        projectType,
        {
          id: 11111,
          key: 'projKey',
          name: 'project1',
          simplified: false,
          projectTypeKey: 'software',
          issueTypeScreenScheme:
          new ReferenceExpression(issueTypeScreenSchemeInstance.elemID, issueTypeScreenSchemeInstance),
        },
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1']
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
          type: 'testField1',
        }
      )
      fieldInstance2 = new InstanceElement(
        'testField2',
        fieldType,
        {
          id: 'testField2',
          name: 'TestField2',
          schema: {
            system: 'testField2',
          },
        }
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
    it('should add all subTypes to the elements', async () => {
      await filter.onFetch(elements)
      expect(elements.filter(isObjectType).map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'jira.Field',
          'jira.IssueLayout',
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
      const issueLayout = elements
        .filter(isInstanceElement)
        .find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
      expect(issueLayout)
        .toBeDefined()
      expect(issueLayout?.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual('https://ori-salto-test.atlassian.net/plugins/servlet/project-config/projKey/issuelayout?screenId=11')
    })
    it('should not add issue layout if there is no issueTypeScreenScheme', async () => {
      projectInstance.value.issueTypeScreenScheme = undefined
      await filter.onFetch(elements)
      expect(elements
        .filter(isInstanceElement)
        .find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE))
        .toBeUndefined()
    })
    it('should not add issue layout if it is a bad response', async () => {
      mockGet.mockImplementation(() => ({
        status: 200,
        data: {
        },
      }))
      await filter.onFetch(elements)
      expect(elements
        .filter(isInstanceElement)
        .find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE))
        .toBeUndefined()
    })
    it('should catch an error if gql post throws an error and return undefined', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('err')
      })
      await filter.onFetch(elements)
      expect(elements
        .filter(isInstanceElement)
        .find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE))
        .toBeUndefined()
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
      const configWithMissingRefs = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      configWithMissingRefs.fetch.enableMissingReferences = false
      configWithMissingRefs.fetch.enableIssueLayouts = true
      filter = issueLayoutFilter(getFilterParams({ config: configWithMissingRefs, client })) as FilterType
      await filter.onFetch(elements)
      expect(elements
        .filter(isInstanceElement)
        .find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)?.value.issueLayoutConfig.items[0].key)
        .toEqual('testField4')
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
    it('should not fetch issue layouts if it is a data center instance', async () => {
      const configWithDataCenterTrue = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      configWithDataCenterTrue.fetch.enableIssueLayouts = true
      filter = issueLayoutFilter(getFilterParams({
        client,
        config: configWithDataCenterTrue,
      })) as FilterType

      filter = issueLayoutFilter(getFilterParams({ config: configWithDataCenterTrue, client })) as FilterType
      await filter.onFetch(elements)
      expect(connection.post).not.toHaveBeenCalled()
    })
    it('should use elemIdGetter', async () => {
      filter = issueLayoutFilter(getFilterParams({
        client,
        getElemIdFunc: () => new ElemID(JIRA, 'someName'),
      })) as FilterType
      await filter.onFetch(elements)
      expect(elements
        .filter(isInstanceElement)
        .find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)?.elemID.getFullName())
        .toEqual('jira.IssueLayout.instance.someName')
    })
    it('should filter out issue layout if screen is not a resolved reference', async () => {
      screenSchemeInstance.value.screens.default = 'unresolved'
      await filter.onFetch(elements)
      expect(elements
        .filter(isInstanceElement)
        .find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE))
        .toBeUndefined()
    })
  })
  describe('deploy', () => {
    let issueLayoutInstance: InstanceElement
    let afterIssueLayoutInstance: InstanceElement
    const issueLayoutType = createLayoutType(ISSUE_LAYOUT_TYPE).layoutType
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
      const issueLayoutInstanceWithoutId = new InstanceElement(
        'issueLayout',
        issueLayoutType,
        {
          projectId: new ReferenceExpression(projectInstance.elemID, projectInstance),
          extraDefinerId: new ReferenceExpression(screenInstance.elemID, screenInstance),
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
      const res = await filter.deploy([
        { action: 'add', data: { after: issueLayoutInstanceWithoutId } },
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
          type: 'testField3',
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
    it('should return error if project is not reference expression', async () => {
      const issueLayoutInstanceWithoutProj = new InstanceElement(
        'issueLayoutInstanceWithoutProj',
        issueLayoutType,
        {
          projectId: 11111,
          extraDefinerId: new ReferenceExpression(screenInstance.elemID, screenInstance),
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
      const res = await filter.deploy([
        { action: 'add', data: { after: issueLayoutInstanceWithoutProj } },
      ])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        'Error: Failed to deploy issue layout changes due to missing references'
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)
    })
  })
})
