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
  ReferenceExpression,
  Element,
  isInstanceElement,
  isObjectType,
  getChangeData,
  CORE_ANNOTATIONS,
  toChange,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'
import JiraClient, { graphQLResponseType } from '../../../src/client/client'
import issueLayoutFilter, { getLayoutRequestsAsync } from '../../../src/filters/layouts/issue_layout'
import asyncApiCallsFilter from '../../../src/filters/async_api_calls'
import { getFilterParams, mockClient, createEmptyType } from '../../utils'
import {
  ISSUE_LAYOUT_TYPE,
  ISSUE_TYPE_NAME,
  ISSUE_TYPE_SCHEMA_NAME,
  ISSUE_TYPE_SCREEN_SCHEME_TYPE,
  JIRA,
  PROJECT_TYPE,
  SCREEN_SCHEME_TYPE,
} from '../../../src/constants'
import { createLayoutType } from '../../../src/filters/layouts/layout_types'
import { generateLayoutId } from '../../../src/filters/layouts/layout_service_operations'

describe('issue layout filter', () => {
  let connection: MockInterface<clientUtils.APIConnection>
  let fetchQuery: MockInterface<elementUtils.query.ElementQuery>
  let mockGet: jest.SpyInstance
  let client: JiraClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let layoutFilter: FilterType
  let config: JiraConfig
  let asyncFilter: FilterType
  let elements: Element[]
  let screenType: ObjectType
  let screenInstance: InstanceElement
  let screenSchemeType: ObjectType
  let screenSchemeInstance1: InstanceElement
  let screenSchemeInstance2: InstanceElement
  let screenSchemeInstance3: InstanceElement
  let screenSchemeInstance: InstanceElement
  let issueTypeScreenSchemeItemType: ObjectType
  let issueTypeScreenSchemeType: ObjectType
  let issueTypeScreenSchemeInstance1: InstanceElement
  let issueTypeScreenSchemeInstance2: InstanceElement
  let issueTypeScreenSchemeInstance: InstanceElement
  let projectType: ObjectType
  let projectInstance1: InstanceElement
  let projectInstance2: InstanceElement
  let issueTypeType: ObjectType
  let issueTypeScheme: ObjectType
  let issueTypeSchemeInstance1: InstanceElement
  let issueTypeSchemeInstance2: InstanceElement
  let issueTypeInstance: InstanceElement
  let fieldType: ObjectType
  let fieldInstance1: InstanceElement
  let fieldInstance2: InstanceElement
  let requestReply: graphQLResponseType

  const adapterContext: Values = {}
  const mockCli = mockClient()

  beforeEach(async () => {
    client = mockCli.client
    connection = mockCli.connection
    fetchQuery = elementUtils.query.createMockQuery()
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableIssueLayouts = true
    layoutFilter = issueLayoutFilter(getFilterParams({ client, config, adapterContext })) as typeof layoutFilter
    asyncFilter = asyncApiCallsFilter(getFilterParams({ client, config })) as typeof asyncFilter
    screenType = createEmptyType('Screen')

    screenInstance = new InstanceElement('screen1', screenType, {
      id: 11,
    })
    fieldType = createEmptyType('Field')
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

    screenSchemeType = createEmptyType(SCREEN_SCHEME_TYPE)
    issueTypeScreenSchemeItemType = createEmptyType('IssueTypeScreenSchemeItem')
    issueTypeScreenSchemeType = createEmptyType(ISSUE_TYPE_SCREEN_SCHEME_TYPE)
    projectType = createEmptyType(PROJECT_TYPE)
    issueTypeType = createEmptyType(ISSUE_TYPE_NAME)
    issueTypeScheme = createEmptyType(ISSUE_TYPE_SCHEMA_NAME)

    screenSchemeInstance = new InstanceElement('screenScheme1', screenSchemeType, {
      id: 111,
      screens: { default: 11 },
    })
    issueTypeScreenSchemeInstance = new InstanceElement('issueTypeScreenScheme1', issueTypeScreenSchemeType, {
      id: 1111,
      issueTypeMappings: [
        {
          issueTypeId: 1,
          screenSchemeId: 111,
        },
      ],
    })
    projectInstance1 = new InstanceElement(
      'project1',
      projectType,
      {
        id: '11111',
        key: 'projKey',
        name: 'project1',
        simplified: false,
        projectTypeKey: 'software',
        issueTypeScreenScheme: { issueTypeScreenScheme: { id: 1111 } },
      },
      [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1'],
    )
    requestReply = {
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
  })
  describe('async get', () => {
    beforeEach(() => {
      client = mockCli.client

      projectInstance1 = new InstanceElement('project1', projectType, {
        id: '11111',
        projectTypeKey: 'software',
        issueTypeScreenScheme: { issueTypeScreenScheme: { id: 1111 } },
        issueTypeScheme: { issueTypeScheme: { id: 10 } },
      })
      projectInstance2 = new InstanceElement('project2', projectType, {
        id: '22222',
        projectTypeKey: 'software',
        issueTypeScreenScheme: { issueTypeScreenScheme: { id: 2222 } },
        issueTypeScheme: { issueTypeScheme: { id: 10 } },
      })
      issueTypeSchemeInstance1 = new InstanceElement('issueTypeScheme1', issueTypeScheme, {
        id: 10,
        issueTypeIds: [{ issueTypeId: 100 }],
      })
      issueTypeSchemeInstance2 = new InstanceElement('issueTypeScheme2', issueTypeScheme, {
        id: 20,
        issueTypeIds: [{ issueTypeId: 100 }, { issueTypeId: 200 }],
      })
      screenSchemeInstance1 = new InstanceElement('screenScheme1', screenSchemeType, {
        id: 111,
      })
      screenSchemeInstance2 = new InstanceElement('screenScheme2', screenSchemeType, {
        id: 222,
        screens: { default: 11 },
      })
      screenSchemeInstance3 = new InstanceElement('screenScheme3', screenSchemeType, {
        id: 333,
        screens: { default: 13, view: 12 },
      })
      issueTypeScreenSchemeInstance1 = new InstanceElement('issueTypeScreenScheme1', issueTypeScreenSchemeType, {
        id: 1111,
        issueTypeMappings: [
          {
            issueTypeId: 100,
            screenSchemeId: 222,
          },
        ],
      })
      issueTypeScreenSchemeInstance2 = new InstanceElement('issueTypeScreenScheme2', issueTypeScreenSchemeType, {
        id: 2222,
        issueTypeMappings: [
          {
            issueTypeId: 100,
            screenSchemeId: 333,
          },
          {
            issueTypeId: 200,
            screenSchemeId: 222,
          },
        ],
      })

      mockGet = jest.spyOn(client, 'gqlPost')
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/gira/1') {
          return requestReply
        }
        throw new Error('Err')
      })

      elements = [
        issueTypeScheme,
        issueTypeSchemeInstance1,
        issueTypeSchemeInstance2,
        screenSchemeInstance1,
        screenSchemeInstance2,
        screenSchemeInstance3,
        issueTypeScreenSchemeInstance1,
        issueTypeScreenSchemeInstance2,
        projectInstance1,
      ]
    })
    it('should return the correct request', async () => {
      const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(Object.entries(res)).toHaveLength(1)
      expect(res['11111'][11]).toBeDefined()
      const resolvedRes = await res['11111'][11]
      expect(resolvedRes.data).toBeDefined()
    })
    it('should return the correct request if there are multiple projects', async () => {
      elements.push(projectInstance2)
      const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(Object.entries(res)).toHaveLength(2)
      expect(res['11111'][11]).toBeDefined()
      expect(res['22222'][12]).toBeDefined()
    })
    it('should return the correct answer if there are multiple issueLayouts in the same project', async () => {
      projectInstance1.value.issueTypeScreenScheme = { issueTypeScreenScheme: { id: 2222 } }
      projectInstance1.value.issueTypeScheme = { issueTypeScheme: { id: 20 } }
      const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(Object.entries(res)).toHaveLength(1)
      expect(Object.entries(res['11111'])).toHaveLength(2)
      expect(res['11111'][11]).toBeDefined()
      expect(res['11111'][12]).toBeDefined()
    })
    it('should be empty answer if it is a bad response', async () => {
      mockGet.mockImplementation(() => ({
        status: 200,
        data: {},
      }))
      const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(Object.entries(res)).toHaveLength(1)
      expect(res['11111'][11]).toBeDefined()
      const resolvedRes = await res['11111'][11]
      expect(resolvedRes.data).toBeEmpty()
    })
    it('should catch an error if gql post throws an error and return empty', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('err')
      })
      const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(Object.entries(res)).toHaveLength(1)
      expect(res['11111'][11]).toBeDefined()
      const resolvedRes = await res['11111'][11]
      expect(resolvedRes.data).toBeUndefined()
    })
    it('should return empty if there are no issueTypeScreenScheme', async () => {
      projectInstance1.value.issueTypeScreenScheme = undefined
      const res = getLayoutRequestsAsync(client, config, fetchQuery, [projectInstance1])
      expect(res).toBeEmpty()
    })
    it('should not fail if the project does not have an issueTypeScheme', async () => {
      projectInstance1.value.issueTypeScheme = undefined
      const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(res).toEqual({ 11111: {} })
    })
    it('should not fail if issueTypeScheme does not have issueTypeIds', async () => {
      issueTypeSchemeInstance1.value.issueTypeIds = undefined
      const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(res).toEqual({ 11111: {} })
    })
    it('should not fetch issue layouts if it disabled', async () => {
      const configWithEnableFalse = getDefaultConfig({ isDataCenter: false })
      configWithEnableFalse.fetch.enableIssueLayouts = false
      const res = getLayoutRequestsAsync(client, configWithEnableFalse, fetchQuery, elements)
      expect(res).toBeEmpty()
    })
    it('should not fetch issue layouts if it was excluded', async () => {
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      fetchQuery.isTypeMatch.mockReturnValue(false)
      getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(connection.post).not.toHaveBeenCalled()
    })
    it('should not fetch issue layouts if it is a data center instance', async () => {
      const configWithDataCenterTrue = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      configWithDataCenterTrue.fetch.enableIssueLayouts = true
      layoutFilter = issueLayoutFilter(
        getFilterParams({
          client: mockClient(true).client,
          config: configWithDataCenterTrue,
          adapterContext,
        }),
      ) as FilterType
      getLayoutRequestsAsync(mockClient(true).client, configWithDataCenterTrue, fetchQuery, elements)
      expect(connection.post).not.toHaveBeenCalled()
    })

    describe('get the correct screens for the issue Layouts', () => {
      it('should return empty list if screen scheme does not have screens', async () => {
        issueTypeScreenSchemeInstance1.value.issueTypeMappings[0] = { issueTypeId: 100, screenSchemeId: 111 }
        projectInstance1.value.issueTypeScreenScheme = { issueTypeScreenScheme: { id: 1111 } }
        projectInstance1.value.issueTypeScheme = { issueTypeScheme: { id: 10 } }
        const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
        expect(Object.entries(res)).toHaveLength(1)
        expect(res['11111']).toEqual({
          undefined: Promise.resolve({ data: {} }),
        })
      })
      it('should return the view screen and not the default screen if there is', async () => {
        issueTypeScreenSchemeInstance1.value.issueTypeMappings = [{ issueTypeId: 100, screenSchemeId: 333 }]
        projectInstance1.value.issueTypeScreenScheme = { issueTypeScreenScheme: { id: 1111 } }
        projectInstance1.value.issueTypeScheme = { issueTypeScheme: { id: 10 } }

        const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
        expect(Object.entries(res)).toHaveLength(1)
        expect(Object.entries(res['11111'])).toHaveLength(1)
        expect(res['11111'][12]).toBeDefined()
      })
      it('should return the default screen if there is no view screen', async () => {
        issueTypeScreenSchemeInstance1.value.issueTypeMappings = [{ issueTypeId: 100, screenSchemeId: 222 }]
        projectInstance1.value.issueTypeScreenScheme = { issueTypeScreenScheme: { id: 1111 } }
        projectInstance1.value.issueTypeScheme = { issueTypeScheme: { id: 10 } }

        const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
        expect(Object.entries(res)).toHaveLength(1)
        expect(Object.entries(res['11111'])).toHaveLength(1)
        expect(res['11111'][11]).toBeDefined()
      })
      it('should return the default issueTypeScreenScheme for unhandled issueTypes in the projects scheme', async () => {
        issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
          { issueTypeId: 100, screenSchemeId: 222 },
          { issueTypeId: 'default', screenSchemeId: 333 },
        ]
        projectInstance1.value.issueTypeScheme = { issueTypeScheme: { id: 20 } }

        const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
        expect(Object.entries(res)).toHaveLength(1)
        expect(Object.entries(res['11111'])).toHaveLength(2)
        expect(res['11111'][11]).toBeDefined()
        expect(res['11111'][12]).toBeDefined()
      })
      it('If the issueTypeScreenScheme directly handles all project issueTypes, do not return its default', async () => {
        issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
          { issueTypeId: 100, screenSchemeId: 222 },
          { issueTypeId: 'default', screenSchemeId: 333 },
        ]
        projectInstance1.value.issueTypeScheme = { issueTypeScheme: { id: 10 } }

        const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
        expect(Object.entries(res)).toHaveLength(1)
        expect(Object.entries(res['11111'])).toHaveLength(1)
        expect(res['11111'][11]).toBeDefined()
        expect(res['11111'][12]).toBeUndefined()
      })
      it('do not return the screen of issueType that is in the issueTypeScreenScheme but not in the project issueTypeScheme', async () => {
        projectInstance1.value.issueTypeScreenScheme = { issueTypeScreenScheme: { id: 2222 } }
        projectInstance1.value.issueTypeScheme = { issueTypeScheme: { id: 10 } }

        const res = getLayoutRequestsAsync(client, config, fetchQuery, elements)
        expect(Object.entries(res)).toHaveLength(1)
        expect(Object.entries(res['11111'])).toHaveLength(1)
        expect(res['11111'][12]).toBeDefined()
        expect(res['11111'][11]).toBeUndefined()
      })
    })
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      client = mockCli.client
      issueTypeType = new ObjectType({ elemID: new ElemID(JIRA, 'IssueType') })
      issueTypeInstance = new InstanceElement('issueType1', issueTypeType, {
        id: '100',
        name: 'OwnerTest',
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
        projectInstance1,
        issueTypeType,
        issueTypeInstance,
        fieldType,
        fieldInstance1,
        fieldInstance2,
      ]
      adapterContext.layoutsPromise = {
        11111: {
          11: requestReply,
        },
      }
      screenSchemeInstance.value.screens = { default: new ReferenceExpression(screenInstance.elemID, screenInstance) }
      issueTypeScreenSchemeInstance.value.issueTypeMappings[0].screenSchemeId = new ReferenceExpression(
        screenSchemeInstance.elemID,
        screenSchemeInstance,
      )
      projectInstance1.value.issueTypeScreenScheme = new ReferenceExpression(
        issueTypeScreenSchemeInstance.elemID,
        issueTypeScreenSchemeInstance,
      )
    })
    it('should add all subTypes to the elements', async () => {
      await layoutFilter.onFetch(elements)
      expect(
        elements
          .filter(isObjectType)
          .map(e => e.elemID.getFullName())
          .sort(),
      ).toEqual([
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
      await layoutFilter.onFetch(elements)
      const issueLayout = elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
      expect(issueLayout).toBeDefined()
      expect(issueLayout?.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
        'https://ori-salto-test.atlassian.net/plugins/servlet/project-config/projKey/issuelayout?screenId=11',
      )
    })
    it('should not crash if the adapterContext.layoutsPromise is empty', async () => {
      adapterContext.layoutsPromise = {}
      await layoutFilter.onFetch(elements)
      expect(elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)).toBeUndefined()
    })
    it('should not add issue layout if it data in promise is empty', async () => {
      adapterContext.layoutsPromise = {
        11111: {
          11: { data: {} },
        },
      }
      await layoutFilter.onFetch(elements)
      expect(elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)).toBeUndefined()
    })
    it('should not fail if data is undefined', async () => {
      adapterContext.layoutsPromise = {
        11111: {
          11: {},
        },
      }
      await layoutFilter.onFetch(elements)
      expect(elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)).toBeUndefined()
    })
    it('should not fail if a project does not have any screens', async () => {
      adapterContext.layoutsPromise = {
        11111: {},
      }
      await layoutFilter.onFetch(elements)
      expect(elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)).toBeUndefined()
    })
    it('should not add missing reference if enableMissingRef is false', async () => {
      const missingReferenceReply = {
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
      adapterContext.layoutsPromise = {
        11111: {
          11: missingReferenceReply,
        },
      }
      const configWithMissingRefs = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      configWithMissingRefs.fetch.enableMissingReferences = false
      configWithMissingRefs.fetch.enableIssueLayouts = true
      layoutFilter = issueLayoutFilter(
        getFilterParams({ config: configWithMissingRefs, client, adapterContext }),
      ) as FilterType
      await layoutFilter.onFetch(elements)
      expect(
        elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)?.value.issueLayoutConfig
          .items[0].key,
      ).toEqual('testField4')
    })
    it('should use elemIdGetter', async () => {
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableIssueLayouts = true
      layoutFilter = issueLayoutFilter(
        getFilterParams({
          client,
          config,
          getElemIdFunc: () => new ElemID(JIRA, 'someName'),
          adapterContext,
        }),
      ) as FilterType
      await layoutFilter.onFetch(elements)
      expect(
        elements
          .filter(isInstanceElement)
          .find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
          ?.elemID.getFullName(),
      ).toEqual('jira.IssueLayout.instance.someName')
    })
    it('should not return issue layouts if disabled', async () => {
      const configDisabled = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      configDisabled.fetch.enableIssueLayouts = false
      layoutFilter = issueLayoutFilter(
        getFilterParams({
          client,
          config: configDisabled,
          getElemIdFunc: () => new ElemID(JIRA, 'someName'),
          adapterContext,
        }),
      ) as FilterType
      await layoutFilter.onFetch(elements)
      expect(
        elements
          .filter(isInstanceElement)
          .find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)
          ?.elemID.getFullName(),
      ).toBeUndefined()
    })
  })
  describe('deploy', () => {
    let issueLayoutInstance: InstanceElement
    let afterIssueLayoutInstance: InstanceElement
    const issueLayoutType = createLayoutType(ISSUE_LAYOUT_TYPE).layoutType
    beforeEach(() => {
      jest.clearAllMocks()
      client = mockCli.client
      connection = mockCli.connection
      issueLayoutInstance = new InstanceElement(
        'issueLayout',
        issueLayoutType,
        {
          id: generateLayoutId({ projectId: projectInstance1.value.id, extraDefinerId: screenInstance.value.id }),
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
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance1.elemID, projectInstance1)] },
      )
      afterIssueLayoutInstance = issueLayoutInstance.clone()
    })
    it('should add issue layout to the elements', async () => {
      const issueLayoutInstanceWithoutId = new InstanceElement(
        'issueLayout',
        issueLayoutType,
        {
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
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance1.elemID, projectInstance1)] },
      )
      const res = await layoutFilter.deploy([
        { action: 'add', data: { after: issueLayoutInstanceWithoutId } },
        { action: 'add', data: { after: projectInstance1 } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value).toEqual(projectInstance1.value)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual({ action: 'add', data: { after: issueLayoutInstance } })
    })
    it('should modify issue layout', async () => {
      const fieldInstance3 = new InstanceElement('testField3', fieldType, {
        id: 'testField3',
        name: 'TestField3',
        type: 'testField3',
      })
      afterIssueLayoutInstance.value.issueLayoutConfig.items[2] = {
        type: 'FIELD',
        sectionType: 'PRIMARY',
        key: new ReferenceExpression(fieldInstance3.elemID, fieldInstance3),
      }
      const res = await layoutFilter.deploy([
        { action: 'modify', data: { before: issueLayoutInstance, after: afterIssueLayoutInstance } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual({
        action: 'modify',
        data: { before: issueLayoutInstance, after: afterIssueLayoutInstance },
      })
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/internal/1.0/issueLayouts/2',
        {
          extraDefinerId: 11,
          projectId: '11111',
          owners: [],
          issueLayoutType: 'ISSUE_VIEW',
          issueLayoutConfig: {
            items: [
              {
                key: 'testField1',
                sectionType: 'primary',
                type: 'FIELD',
                data: {
                  name: 'TestField1',
                  type: 'testField1',
                },
              },
              {
                key: 'testField2',
                sectionType: 'secondary',
                type: 'FIELD',
                data: {
                  name: 'TestField2',
                  type: 'testField2',
                },
              },
              {
                key: 'testField3',
                sectionType: 'primary',
                type: 'FIELD',
                data: {
                  name: 'TestField3',
                  type: 'testField3',
                },
              },
            ],
          },
        },
        undefined,
      )
    })
    it('should not add item if its key is not a reference expression', async () => {
      afterIssueLayoutInstance.value.issueLayoutConfig.items[2] = {
        type: 'FIELD',
        sectionType: 'PRIMARY',
        key: 'testField3',
      }
      const res = await layoutFilter.deploy([
        { action: 'modify', data: { before: issueLayoutInstance, after: afterIssueLayoutInstance } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual({
        action: 'modify',
        data: { before: issueLayoutInstance, after: afterIssueLayoutInstance },
      })
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/internal/1.0/issueLayouts/2',
        {
          extraDefinerId: 11,
          projectId: '11111',
          owners: [],
          issueLayoutType: 'ISSUE_VIEW',
          issueLayoutConfig: {
            items: [
              {
                key: 'testField1',
                sectionType: 'primary',
                type: 'FIELD',
                data: {
                  name: 'TestField1',
                  type: 'testField1',
                },
              },
              {
                key: 'testField2',
                sectionType: 'secondary',
                type: 'FIELD',
                data: {
                  name: 'TestField2',
                  type: 'testField2',
                },
              },
            ],
          },
        },
        undefined,
      )
    })
    it('should return error if parent was not found', async () => {
      const issueLayoutInstanceWithoutProj = new InstanceElement('issueLayoutInstanceWithoutProj', issueLayoutType, {
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
      })
      const res = await layoutFilter.deploy([{ action: 'add', data: { after: issueLayoutInstanceWithoutProj } }])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual(
        'Error: Expected jira.IssueLayout.instance.issueLayoutInstanceWithoutProj to have exactly one parent, found 0',
      )
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)
    })
    it('should mark issue layout as removed if parent project was removed', async () => {
      const change = toChange({ before: issueLayoutInstance })
      connection.get.mockImplementation(async url => {
        if (url === '/rest/api/3/project/11111') {
          return {
            status: 404,
            data: {},
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      const { deployResult } = await layoutFilter.deploy([change])
      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(1)
    })
    it('should mark issue layout as removed if project was removed and API throws 404', async () => {
      const change = toChange({ before: issueLayoutInstance })
      const error = new clientUtils.HTTPError('message', {
        status: 404,
        data: { errorMessages: ['project does not exist.'] },
      })
      connection.get.mockRejectedValueOnce(error)
      const { deployResult } = await layoutFilter.deploy([change])
      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(1)
    })
    it('should return error if issue layout as removed but parent project still exits', async () => {
      const change = toChange({ before: issueLayoutInstance })
      connection.get.mockImplementation(async url => {
        if (url === '/rest/api/3/project/11111') {
          return {
            status: 200,
            data: {
              id: '11111',
            },
          }
        }
        throw new Error(`Unexpected url ${url}`)
      })
      const { deployResult } = await layoutFilter.deploy([change])
      expect(deployResult.errors).toHaveLength(1)
      expect(deployResult.errors[0].message).toEqual('Error: Could not remove IssueLayout')
      expect(deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
