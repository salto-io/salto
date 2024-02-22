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
  ListType,
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
import { getFilterParams, mockClient } from '../../utils'
import { ISSUE_LAYOUT_TYPE, JIRA, PROJECT_TYPE, SCREEN_SCHEME_TYPE } from '../../../src/constants'
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
    screenType = new ObjectType({
      elemID: new ElemID(JIRA, 'Screen'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
      },
    })
    screenInstance = new InstanceElement('screen1', screenType, {
      id: 11,
    })
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
    screenSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, SCREEN_SCHEME_TYPE),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        screens: { refType: screenType },
      },
    })
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
    projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        simplified: { refType: BuiltinTypes.BOOLEAN },
        issueTypeScreenScheme: { refType: issueTypeScreenSchemeType },
        key: { refType: BuiltinTypes.STRING },
      },
    })
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
    projectInstance = new InstanceElement(
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
      issueTypeType = new ObjectType({ elemID: new ElemID(JIRA, 'IssueType') })
      issueTypeInstance = new InstanceElement('issueType1', issueTypeType, {
        id: '100',
        name: 'OwnerTest',
      })
      mockGet = jest.spyOn(client, 'gqlPost')
      mockGet.mockImplementation(params => {
        if (params.url === '/rest/gira/1') {
          return requestReply
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
    it('should return the correct request', async () => {
      const res = await getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(Object.entries(res)).toHaveLength(1)
      expect(res[11111][11]).toBeDefined()
      const resolvedRes = await res[11111][11]
      expect(resolvedRes.data).toBeDefined()
    })
    it('should return empty if there are no issueTypeScreenScheme', async () => {
      projectInstance.value.issueTypeScreenScheme = undefined
      const res = await getLayoutRequestsAsync(client, config, fetchQuery, [projectInstance])
      expect(res).toBeEmpty()
    })
    it('should not fetch issue layouts if it disabled', async () => {
      const configWithEnableFalse = getDefaultConfig({ isDataCenter: false })
      configWithEnableFalse.fetch.enableIssueLayouts = false
      const res = await getLayoutRequestsAsync(client, configWithEnableFalse, fetchQuery, elements)
      expect(res).toBeEmpty()
    })
    it('should be empty answer if it is a bad response', async () => {
      mockGet.mockImplementation(() => ({
        status: 200,
        data: {},
      }))
      const res = await getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(Object.entries(res)).toHaveLength(1)
      expect(res[11111][11]).toBeDefined()
      const resolvedRes = await res[11111][11]
      expect(resolvedRes.data).toBeEmpty()
    })
    it('should catch an error if gql post throws an error and return empty', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('err')
      })
      const res = await getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(Object.entries(res)).toHaveLength(1)
      expect(res[11111][11]).toBeDefined()
      const resolvedRes = await res[11111][11]
      expect(resolvedRes.data).toBeUndefined()
    })
    it('should not fetch issue layouts if it was excluded', async () => {
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      fetchQuery.isTypeMatch.mockReturnValue(false)
      await getLayoutRequestsAsync(client, config, fetchQuery, elements)
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
      await getLayoutRequestsAsync(mockClient(true).client, configWithDataCenterTrue, fetchQuery, elements)
      expect(connection.post).not.toHaveBeenCalled()
    })
    it('should return empty list if screen scheme does not have screens', async () => {
      delete screenSchemeInstance.value.screens
      const res = await getLayoutRequestsAsync(client, config, fetchQuery, elements)
      expect(Object.entries(res)).toHaveLength(1)
      expect(res[11111]).toEqual({
        undefined: Promise.resolve({ data: {} }),
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
        projectInstance,
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
      projectInstance.value.issueTypeScreenScheme = new ReferenceExpression(
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
    it('should not add issue layout if there is no issueTypeScreenScheme', async () => {
      projectInstance.value.issueTypeScreenScheme = undefined
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
    it('should filter out issue layout if screen is not a resolved reference', async () => {
      screenSchemeInstance.value.screens.default = 'unresolved'
      await layoutFilter.onFetch(elements)
      expect(elements.filter(isInstanceElement).find(e => e.elemID.typeName === ISSUE_LAYOUT_TYPE)).toBeUndefined()
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
          id: generateLayoutId({ projectId: projectInstance.value.id, extraDefinerId: screenInstance.value.id }),
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
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)] },
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
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)] },
      )
      const res = await layoutFilter.deploy([
        { action: 'add', data: { after: issueLayoutInstanceWithoutId } },
        { action: 'add', data: { after: projectInstance } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value).toEqual(projectInstance.value)
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
