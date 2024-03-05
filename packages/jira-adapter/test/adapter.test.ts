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
  AdapterOperations,
  ObjectType,
  ElemID,
  ProgressReporter,
  FetchResult,
  InstanceElement,
  toChange,
  isRemovalChange,
  getChangeData,
  BuiltinTypes,
  ReferenceExpression,
  ElemIdGetter,
  ServiceIds,
} from '@salto-io/adapter-api'
import { deployment, elements, client as clientUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements, safeJsonStringify } from '@salto-io/adapter-utils'
import MockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import { mockFunction } from '@salto-io/test-utils'
import JiraClient from '../src/client/client'
import { adapter as adapterCreator } from '../src/adapter_creator'
import { getDefaultConfig } from '../src/config/config'
import { OBJECT_TYPE_ATTRIBUTE_TYPE, ISSUE_TYPE_NAME, JIRA, PROJECT_TYPE, SERVICE_DESK } from '../src/constants'
import { createCredentialsInstance, createConfigInstance, mockClient, createEmptyType } from './utils'
import { jiraJSMAssetsEntriesFunc, jiraJSMEntriesFunc } from '../src/jsm_utils'
import { CLOUD_RESOURCE_FIELD } from '../src/filters/automation/cloud_id'

const { getAllElements, getEntriesResponseValues, addRemainingTypes } = elements.ducktype
const { generateTypes, getAllInstances, loadSwagger } = elements.swagger

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  // only including relevant functions
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      changeValidators: actual.deployment.changeValidators,
      deployChange: jest.fn().mockImplementation(actual.elements.swagger.deployChange),
    },
    elements: {
      ...actual.elements,
      swagger: {
        flattenAdditionalProperties: actual.elements.swagger.flattenAdditionalProperties,
        generateTypes: jest.fn().mockImplementation(() => {
          throw new Error('generateTypes called without a mock')
        }),
        getAllInstances: jest.fn().mockImplementation(() => {
          throw new Error('getAllInstances called without a mock')
        }),
        loadSwagger: jest.fn().mockImplementation(() => {
          throw new Error('loadSwagger called without a mock')
        }),
        addDeploymentAnnotations: jest.fn(),
      },
      ducktype: {
        ...actual.elements.ducktype,
        getAllElements: jest.fn().mockImplementation(() => {
          throw new Error('getAllElements called without a mock')
        }),
        getEntriesResponseValues: jest.fn().mockImplementation(() => {
          throw new Error('getEntriesResponseValues called without a mock')
        }),
        addRemainingTypes: jest.fn().mockImplementation(() => {
          throw new Error('addRemainingTypes called without a mock')
        }),
      },
    },
  }
})

describe('adapter', () => {
  let adapter: AdapterOperations
  let getElemIdFunc: ElemIdGetter

  const nullProgressReporter: ProgressReporter = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    reportProgress: () => {},
  }

  beforeEach(() => {
    const elementsSource = buildElementsSourceFromElements([])
    getElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string): ElemID =>
      new ElemID(adapterName, name)

    const config = createConfigInstance(getDefaultConfig({ isDataCenter: false }))
    config.value.client.usePrivateAPI = false
    config.value.fetch.convertUsersIds = false

    adapter = adapterCreator.operations({
      elementsSource,
      credentials: createCredentialsInstance({ baseUrl: 'http:/jira.net', user: 'u', token: 't' }),
      config,
      getElemIdFunc,
    })
  })
  describe('deploy', () => {
    const fieldConfigurationIssueTypeItemType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfigurationIssueTypeItem'),
      fields: { issueTypeId: { refType: BuiltinTypes.STRING } },
    })
    let deployChangeMock: jest.MockedFunction<typeof deployment.deployChange>
    beforeEach(() => {
      deployChangeMock = deployment.deployChange as jest.MockedFunction<typeof deployment.deployChange>
      deployChangeMock.mockClear()
      deployChangeMock.mockImplementation(async params => {
        if (isRemovalChange(params.change)) {
          throw new Error('some error')
        }
        return { id: 2 }
      })
    })

    it('should return the applied changes', async () => {
      const deployRes = await adapter.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({
              before: new InstanceElement('inst1', fieldConfigurationIssueTypeItemType),
              after: new InstanceElement('inst1', fieldConfigurationIssueTypeItemType),
            }),
            toChange({ before: new InstanceElement('inst2', fieldConfigurationIssueTypeItemType) }),
          ],
        },
        progressReporter: nullProgressReporter,
      })

      expect(deployRes.appliedChanges).toEqual([
        toChange({
          before: new InstanceElement('inst1', fieldConfigurationIssueTypeItemType),
          after: new InstanceElement('inst1', fieldConfigurationIssueTypeItemType),
        }),
      ])
    })

    it('should call deployChange with the resolved elements', async () => {
      const referencedInstance = new InstanceElement(
        'referenced',
        new ObjectType({
          elemID: new ElemID(JIRA, ISSUE_TYPE_NAME),
          fields: { id: { refType: BuiltinTypes.STRING } },
        }),
        { id: '3' },
      )
      await adapter.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({
              before: new InstanceElement('inst1', fieldConfigurationIssueTypeItemType),
              after: new InstanceElement('inst1', fieldConfigurationIssueTypeItemType, {
                issueTypeId: new ReferenceExpression(referencedInstance.elemID, referencedInstance),
              }),
            }),
          ],
        },
        progressReporter: nullProgressReporter,
      })

      expect(deployChangeMock).toHaveBeenCalledWith({
        change: toChange({
          before: new InstanceElement('inst1', fieldConfigurationIssueTypeItemType),
          after: new InstanceElement('inst1', fieldConfigurationIssueTypeItemType, { issueTypeId: '3' }),
        }),
        client: expect.any(JiraClient),
        fieldsToIgnore: [],
      })
    })

    it('should return the errors', async () => {
      deployChangeMock.mockImplementation(async _params => {
        throw new Error('some error')
      })

      const deployRes = await adapter.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ after: new InstanceElement('inst1', fieldConfigurationIssueTypeItemType) }),
            toChange({ before: new InstanceElement('inst2', fieldConfigurationIssueTypeItemType) }),
          ],
        },
        progressReporter: nullProgressReporter,
      })
      expect(deployRes.errors).toEqual([
        {
          message: 'Error: some error',
          severity: 'Error',
          elemID: ElemID.fromFullName('jira.FieldConfigurationIssueTypeItem.instance.inst1'),
        },
        {
          message: 'Error: some error',
          severity: 'Error',
          elemID: ElemID.fromFullName('jira.FieldConfigurationIssueTypeItem.instance.inst2'),
        },
      ])
    })

    it('should add the new id on addition', async () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID(JIRA, 'obj') }))
      const { appliedChanges } = await adapter.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [toChange({ after: instance })],
        },
        progressReporter: nullProgressReporter,
      })

      expect((getChangeData(appliedChanges[0]) as InstanceElement)?.value.id).toEqual(2)
    })
    it('should not add the new id on addition if received an invalid response', async () => {
      deployChangeMock.mockResolvedValue([])
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID(JIRA, 'obj') }))
      const { appliedChanges } = await adapter.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [toChange({ after: instance })],
        },
        progressReporter: nullProgressReporter,
      })

      expect((getChangeData(appliedChanges[0]) as InstanceElement)?.value.id).toBeUndefined()
    })
  })
  describe('deployModifiers', () => {
    it('should have change validator', () => {
      expect(adapter.deployModifiers?.changeValidator).toBeDefined()
    })
  })

  describe('fetch', () => {
    let progressReporter: ProgressReporter
    let result: FetchResult
    let platformTestType: ObjectType
    let jiraTestType: ObjectType
    let testInstance: InstanceElement
    let testInstance2: InstanceElement
    let mockAxiosAdapter: MockAdapter
    beforeEach(async () => {
      progressReporter = {
        reportProgress: mockFunction<ProgressReporter['reportProgress']>(),
      }
      platformTestType = new ObjectType({
        elemID: new ElemID(JIRA, 'platform'),
      })
      jiraTestType = new ObjectType({
        elemID: new ElemID(JIRA, 'jira'),
      })
      testInstance = new InstanceElement('test', jiraTestType)
      testInstance2 = new InstanceElement('test2', jiraTestType)
      ;(generateTypes as jest.MockedFunction<typeof generateTypes>)
        .mockResolvedValueOnce({
          allTypes: { PlatformTest: platformTestType },
          parsedConfigs: { PlatformTest: { request: { url: 'platform' } } },
        })
        .mockResolvedValueOnce({
          allTypes: { JiraTest: jiraTestType },
          parsedConfigs: { JiraTest: { request: { url: 'jira' } } },
        })
      ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValue({ elements: [testInstance2] })
      ;(getAllInstances as jest.MockedFunction<typeof getAllInstances>).mockResolvedValue({ elements: [testInstance] })
      ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>)
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        .mockImplementation(() => {})
      ;(loadSwagger as jest.MockedFunction<typeof loadSwagger>).mockResolvedValue({
        document: {},
        parser: {},
      } as elements.swagger.LoadedSwagger)
      mockAxiosAdapter = new MockAdapter(axios)
      // mock as there are gets of license during fetch
      mockAxiosAdapter.onGet().reply(200, {})
      result = await adapter.fetch({ progressReporter })
    })
    afterEach(() => {
      mockAxiosAdapter.restore()
      ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockClear()
      ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>).mockClear()
    })
    it('should generate types for the platform and the jira apis', () => {
      expect(loadSwagger).toHaveBeenCalledTimes(2)
      expect(loadSwagger).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/jira/platform-swagger.v3.json',
      )
      expect(loadSwagger).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/jira/software-swagger.v3.json',
      )
      expect(generateTypes).toHaveBeenCalledWith(
        JIRA,
        expect.objectContaining({
          swagger: expect.objectContaining({
            url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/jira/platform-swagger.v3.json',
          }),
        }),
        undefined,
        expect.any(Object),
      )
      expect(generateTypes).toHaveBeenCalledWith(
        JIRA,
        expect.objectContaining({
          swagger: expect.objectContaining({
            url: 'https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/jira/software-swagger.v3.json',
          }),
        }),
        undefined,
        expect.any(Object),
      )
    })

    it('should pass elem id getter to getAllInstances', () => {
      expect(getAllInstances).toHaveBeenCalledWith(
        expect.objectContaining({
          getElemIdFunc: expect.any(Function),
        }),
      )
    })
    it('should return all types and instances returned from the infrastructure', () => {
      expect(result.elements).toContain(platformTestType)
      expect(result.elements).toContain(jiraTestType)
      expect(result.elements).toContain(testInstance)
      expect(result.elements).not.toContain(testInstance2)
    })
  })
  describe('scriptRunner', () => {
    let srAdapter: AdapterOperations
    beforeEach(() => {
      const elementsSource = buildElementsSourceFromElements([])
      const config = createConfigInstance(getDefaultConfig({ isDataCenter: false }))
      config.value.client.usePrivateAPI = false
      config.value.fetch.convertUsersIds = false
      config.value.fetch.enableScriptRunnerAddon = true

      srAdapter = adapterCreator.operations({
        elementsSource,
        credentials: createCredentialsInstance({ baseUrl: 'http:/jira.net', user: 'u', token: 't' }),
        config,
        getElemIdFunc,
      })
    })
    describe('fetch', () => {
      let progressReporter: ProgressReporter
      let result: FetchResult
      let platformTestType: ObjectType
      let jiraTestType: ObjectType
      let testInstance: InstanceElement
      let testInstance2: InstanceElement
      let mockAxiosAdapter: MockAdapter
      beforeEach(async () => {
        progressReporter = {
          reportProgress: mockFunction<ProgressReporter['reportProgress']>(),
        }
        platformTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'platform'),
        })
        jiraTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'jira'),
        })
        testInstance = new InstanceElement('test', jiraTestType)
        testInstance2 = new InstanceElement('test2', jiraTestType)
        ;(generateTypes as jest.MockedFunction<typeof generateTypes>)
          .mockResolvedValueOnce({
            allTypes: { PlatformTest: platformTestType },
            parsedConfigs: { PlatformTest: { request: { url: 'platform' } } },
          })
          .mockResolvedValueOnce({
            allTypes: { JiraTest: jiraTestType },
            parsedConfigs: { JiraTest: { request: { url: 'jira' } } },
          })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValue({ elements: [testInstance2] })
        ;(getAllInstances as jest.MockedFunction<typeof getAllInstances>).mockResolvedValue({
          elements: [testInstance],
        })
        ;(loadSwagger as jest.MockedFunction<typeof loadSwagger>).mockResolvedValue({
          document: {},
          parser: {},
        } as elements.swagger.LoadedSwagger)

        mockAxiosAdapter = new MockAdapter(axios)
        // mock as there are gets of license during fetch
        mockAxiosAdapter.onGet().reply(200, {})
        result = await srAdapter.fetch({ progressReporter })
      })
      afterEach(() => {
        mockAxiosAdapter.restore()
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockClear()
      })
      it('should return all types and instances returned from the infrastructure', () => {
        expect(result.elements).toContain(platformTestType)
        expect(result.elements).toContain(jiraTestType)
        expect(result.elements).toContain(testInstance)
        expect(result.elements).toContain(testInstance2)
      })
      it('should call getAllElements', () => {
        expect(getAllElements).toHaveBeenCalledTimes(1)
      })
    })
  })
  describe('JSM FREE PLAN', () => {
    let srAdapter: AdapterOperations
    let projectTestType: ObjectType
    let serviceDeskProjectInstance: InstanceElement
    beforeEach(() => {
      const elementsSource = buildElementsSourceFromElements([])
      const config = createConfigInstance(getDefaultConfig({ isDataCenter: false }))
      config.value.client.usePrivateAPI = false
      config.value.fetch.convertUsersIds = false
      config.value.fetch.enableScriptRunnerAddon = true
      config.value.fetch.enableJSM = true

      srAdapter = adapterCreator.operations({
        elementsSource,
        credentials: createCredentialsInstance({ baseUrl: 'http:/jira.net', user: 'u', token: 't' }),
        config,
        getElemIdFunc,
      })
      projectTestType = createEmptyType(PROJECT_TYPE)
      serviceDeskProjectInstance = new InstanceElement('serviceDeskProject', projectTestType, {
        id: '10000',
        key: 'SD',
        name: 'Service Desk',
        projectTypeKey: SERVICE_DESK,
      })
    })
    describe('fetch', () => {
      let progressReporter: ProgressReporter
      let result: FetchResult
      let platformTestType: ObjectType
      let jiraTestType: ObjectType
      let testInstance2: InstanceElement
      let mockAxiosAdapter: MockAdapter
      beforeEach(async () => {
        progressReporter = {
          reportProgress: mockFunction<ProgressReporter['reportProgress']>(),
        }
        platformTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'platform'),
        })
        jiraTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'jira'),
        })
        testInstance2 = new InstanceElement('test2', jiraTestType)
        ;(generateTypes as jest.MockedFunction<typeof generateTypes>)
          .mockResolvedValueOnce({
            allTypes: { PlatformTest: platformTestType },
            parsedConfigs: { PlatformTest: { request: { url: 'platform' } } },
          })
          .mockResolvedValueOnce({
            allTypes: { projectTest: projectTestType },
            parsedConfigs: { projectTest: { request: { url: 'project' } } },
          })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValueOnce({
          elements: [],
          errors: [{ message: 'scriptRunnerError', severity: 'Error' }],
        })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValueOnce({
          elements: [testInstance2],
          errors: [{ message: 'jsmError', severity: 'Error' }],
        })
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>).mockImplementation(() => {})
        ;(getAllInstances as jest.MockedFunction<typeof getAllInstances>).mockResolvedValue({
          elements: [serviceDeskProjectInstance],
          errors: [{ message: 'some error', severity: 'Error' }],
        })
        ;(loadSwagger as jest.MockedFunction<typeof loadSwagger>).mockResolvedValue({
          document: {},
          parser: {},
        } as elements.swagger.LoadedSwagger)
        mockAxiosAdapter = new MockAdapter(axios)
        mockAxiosAdapter
          // first three requests are for login assertion
          .onGet('/rest/api/3/configuration')
          .replyOnce(200)
          .onGet('/rest/api/3/serverInfo')
          .replyOnce(200, { baseUrl: 'a' })
          .onGet('/rest/api/3/instance/license')
          .reply(200, { applications: [{ id: 'jira-servicedesk', plan: 'FREE' }] })
          .onGet('/rest/servicedeskapi/servicedesk')
          .replyOnce(200, {
            size: 1,
            start: 0,
            limit: 50,
            isLastPage: true,
            _links: {},
            values: [
              {
                id: '10',
                projectId: '10000',
                projectKey: 'SD',
                projectName: 'Service Desk',
              },
            ],
          })
        // mock as we call getCloudId in the forms filter.
        mockAxiosAdapter.onPost().reply(200, {
          unparsedData: {
            [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
              tenantId: 'cloudId',
            }),
          },
        })
        result = await srAdapter.fetch({ progressReporter })
      })
      afterEach(() => {
        mockAxiosAdapter.restore()
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockClear()
        ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>).mockClear()
      })
      it('should return all types and instances returned from the infrastructure', () => {
        expect(result.elements).toContain(platformTestType)
        expect(result.elements).toContain(projectTestType)
        expect(result.elements).toContain(serviceDeskProjectInstance)
      })
      it('should call getAllElements', () => {
        expect(getAllElements).toHaveBeenCalledTimes(2)
      })
      it('should call addRemainingTypes', () => {
        expect(addRemainingTypes).toHaveBeenCalledTimes(1)
      })
      it('should return error', async () => {
        expect(result.errors).toEqual([
          {
            message: 'some error',
            severity: 'Error',
          },
          {
            message: 'scriptRunnerError',
            severity: 'Error',
          },
          {
            message: 'jsmError',
            severity: 'Error',
          },
        ])
      })
    })
    describe('fetch with no jsm in service', () => {
      let progressReporter: ProgressReporter
      let result: FetchResult
      let platformTestType: ObjectType
      let jiraTestType: ObjectType
      let testInstance2: InstanceElement
      let mockAxiosAdapter: MockAdapter
      beforeEach(async () => {
        progressReporter = {
          reportProgress: mockFunction<ProgressReporter['reportProgress']>(),
        }
        platformTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'platform'),
        })
        jiraTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'jira'),
        })
        testInstance2 = new InstanceElement('test2', jiraTestType)
        ;(generateTypes as jest.MockedFunction<typeof generateTypes>)
          .mockResolvedValueOnce({
            allTypes: { PlatformTest: platformTestType },
            parsedConfigs: { PlatformTest: { request: { url: 'platform' } } },
          })
          .mockResolvedValueOnce({
            allTypes: { projectTest: projectTestType },
            parsedConfigs: { projectTest: { request: { url: 'project' } } },
          })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValueOnce({
          elements: [],
          errors: [{ message: 'scriptRunnerError', severity: 'Error' }],
        })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValueOnce({
          elements: [testInstance2],
          errors: [{ message: 'jsmError', severity: 'Error' }],
        })
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>).mockImplementation(() => {})
        ;(getAllInstances as jest.MockedFunction<typeof getAllInstances>).mockResolvedValue({
          elements: [serviceDeskProjectInstance],
          errors: [{ message: 'some error', severity: 'Error' }],
        })
        ;(loadSwagger as jest.MockedFunction<typeof loadSwagger>).mockResolvedValue({
          document: {},
          parser: {},
        } as elements.swagger.LoadedSwagger)
        mockAxiosAdapter = new MockAdapter(axios)
        mockAxiosAdapter
          // first three requests are for login assertion
          .onGet('/rest/api/3/configuration')
          .replyOnce(200)
          .onGet('/rest/api/3/serverInfo')
          .replyOnce(200, { baseUrl: 'a' })
          .onGet('/rest/api/3/instance/license')
          .reply(200, { applications: [{ id: 'jira-software', plan: 'FREE' }] })
          .onGet('/rest/servicedeskapi/servicedesk')
          .replyOnce(200, {
            size: 1,
            start: 0,
            limit: 50,
            isLastPage: true,
            _links: {},
            values: [
              {
                id: '10',
                projectId: '10000',
                projectKey: 'SD',
                projectName: 'Service Desk',
              },
            ],
          })
        // mock as we call getCloudId in the forms filter.
        mockAxiosAdapter.onPost().reply(200, {
          unparsedData: {
            [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
              tenantId: 'cloudId',
            }),
          },
        })
        result = await srAdapter.fetch({ progressReporter })
      })
      afterEach(() => {
        mockAxiosAdapter.restore()
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockClear()
        ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>).mockClear()
      })
      it('should call getAllElements only for scriptRunner', () => {
        expect(getAllElements).toHaveBeenCalledTimes(1)
      })
      it('should call addRemainingTypes', () => {
        expect(addRemainingTypes).toHaveBeenCalledTimes(1)
      })
      it('should return error', async () => {
        expect(result.errors).toEqual([
          {
            message: 'some error',
            severity: 'Error',
          },
          {
            message: 'scriptRunnerError',
            severity: 'Error',
          },
          {
            message: 'Jira Service Management is not enabled in this Jira instance. Skipping fetch of JSM elements.',
            severity: 'Warning',
          },
        ])
      })
    })
    describe('jiraJSMEntriesFunc', () => {
      let paginator: clientUtils.Paginator
      let responseValue: clientUtils.ResponseValue[]
      let EntriesRequesterFunc: elements.ducktype.EntriesRequester
      beforeEach(() => {
        const { paginator: cliPaginator } = mockClient()
        paginator = cliPaginator
        responseValue = [
          {
            id: '1',
          },
        ]
        ;(getEntriesResponseValues as jest.MockedFunction<typeof getEntriesResponseValues>).mockResolvedValue(
          responseValue,
        )
        EntriesRequesterFunc = jiraJSMEntriesFunc(serviceDeskProjectInstance)
      })
      it('should add projectKey to the response with all dataField', async () => {
        const result = await EntriesRequesterFunc({
          paginator,
          args: { url: '/rest/servicedeskapi/servicedesk/2/requesttype' },
          typeName: 'RequestType',
          typesConfig: { RequestType: { transformation: { dataField: '.' } } },
        })
        expect(result[0]).toEqual({
          id: '1',
          projectKey: 'SD',
        })
      })
      it('should add projectKey to the response with specific dataField', async () => {
        responseValue = [
          {
            values: {
              id: '1',
            },
          },
        ]
        ;(getEntriesResponseValues as jest.MockedFunction<typeof getEntriesResponseValues>).mockResolvedValue(
          responseValue,
        )
        const result = await EntriesRequesterFunc({
          paginator,
          args: { url: '/rest/servicedeskapi/servicedesk/2/requesttype' },
          typesConfig: { RequestType: { transformation: { dataField: 'values' } } },
          typeName: 'RequestType',
        })
        expect(result[0]).toEqual({
          values: [
            {
              id: '1',
              projectKey: 'SD',
            },
          ],
        })
      })
      it('should not add projectKey to the response when no dataField was given', async () => {
        const result = await EntriesRequesterFunc({
          paginator,
          args: { url: '/rest/servicedeskapi/servicedesk/2/requesttype' },
          typeName: 'RequestType',
          typesConfig: { RequestType: {} },
        })
        expect(result[0]).toEqual({
          id: '1',
        })
      })
    })
  })
  describe('JSM PAID PLAN', () => {
    let srAdapter: AdapterOperations
    let projectTestType: ObjectType
    let serviceDeskProjectInstance: InstanceElement
    beforeEach(() => {
      const elementsSource = buildElementsSourceFromElements([])
      const config = createConfigInstance(getDefaultConfig({ isDataCenter: false }))
      config.value.client.usePrivateAPI = false
      config.value.fetch.convertUsersIds = false
      config.value.fetch.enableScriptRunnerAddon = true
      config.value.fetch.enableJSM = true
      config.value.fetch.enableJSMPremium = true

      srAdapter = adapterCreator.operations({
        elementsSource,
        credentials: createCredentialsInstance({ baseUrl: 'http:/jira.net', user: 'u', token: 't' }),
        config,
        getElemIdFunc,
      })
      projectTestType = createEmptyType(PROJECT_TYPE)
      serviceDeskProjectInstance = new InstanceElement('serviceDeskProject', projectTestType, {
        id: '10000',
        key: 'SD',
        name: 'Service Desk',
        projectTypeKey: SERVICE_DESK,
      })
    })
    describe('fetch', () => {
      let progressReporter: ProgressReporter
      let result: FetchResult
      let platformTestType: ObjectType
      let jiraTestType: ObjectType
      let testInstance2: InstanceElement
      let mockAxiosAdapter: MockAdapter
      beforeEach(async () => {
        progressReporter = {
          reportProgress: mockFunction<ProgressReporter['reportProgress']>(),
        }
        platformTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'platform'),
        })
        jiraTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'jira'),
        })
        testInstance2 = new InstanceElement('test2', jiraTestType)
        ;(generateTypes as jest.MockedFunction<typeof generateTypes>)
          .mockResolvedValueOnce({
            allTypes: { PlatformTest: platformTestType },
            parsedConfigs: { PlatformTest: { request: { url: 'platform' } } },
          })
          .mockResolvedValueOnce({
            allTypes: { projectTest: projectTestType },
            parsedConfigs: { projectTest: { request: { url: 'project' } } },
          })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValueOnce({
          elements: [],
          errors: [{ message: 'scriptRunnerError', severity: 'Error' }],
        })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValueOnce({
          elements: [testInstance2],
          errors: [{ message: 'jsmError', severity: 'Error' }],
        })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValueOnce({
          elements: [],
          errors: [{ message: 'jsmAssetsError', severity: 'Error' }],
        })
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>).mockImplementation(() => {})
        ;(getAllInstances as jest.MockedFunction<typeof getAllInstances>).mockResolvedValue({
          elements: [serviceDeskProjectInstance],
          errors: [{ message: 'some error', severity: 'Error' }],
        })
        ;(loadSwagger as jest.MockedFunction<typeof loadSwagger>).mockResolvedValue({
          document: {},
          parser: {},
        } as elements.swagger.LoadedSwagger)
        mockAxiosAdapter = new MockAdapter(axios)
        mockAxiosAdapter
          // first three requests are for login assertion
          .onGet('/rest/api/3/configuration')
          .replyOnce(200)
          .onGet('/rest/api/3/serverInfo')
          .replyOnce(200, { baseUrl: 'a' })
          .onGet('/rest/api/3/instance/license')
          .reply(200, { applications: [{ id: 'jira-servicedesk', plan: 'PAID' }] })
          .onGet('/rest/servicedeskapi/assets/workspace')
          .replyOnce(200, {
            values: [
              {
                workspaceId: 'workspaceId',
              },
            ],
          })
          .onGet('/rest/servicedeskapi/servicedesk')
          .replyOnce(200, {
            size: 1,
            start: 0,
            limit: 50,
            isLastPage: true,
            _links: {},
            values: [
              {
                id: '10',
                projectId: '10000',
                projectKey: 'SD',
                projectName: 'Service Desk',
              },
            ],
          })
        // mock as we call getCloudId in the forms filter.
        mockAxiosAdapter.onPost().reply(200, {
          unparsedData: {
            [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
              tenantId: 'cloudId',
            }),
          },
        })
        result = await srAdapter.fetch({ progressReporter })
      })
      afterEach(() => {
        mockAxiosAdapter.restore()
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockClear()
        ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>).mockClear()
      })
      it('should call getAllElements', () => {
        expect(getAllElements).toHaveBeenCalledTimes(3)
      })
      it('should call addRemainingTypes', () => {
        expect(addRemainingTypes).toHaveBeenCalledTimes(1)
      })
      it('should return error', async () => {
        expect(result.errors).toEqual([
          {
            message: 'some error',
            severity: 'Error',
          },
          {
            message: 'scriptRunnerError',
            severity: 'Error',
          },
          {
            message: 'jsmError',
            severity: 'Error',
          },
          {
            message: 'jsmAssetsError',
            severity: 'Error',
          },
        ])
      })
    })
    describe('fetch with no workspaceId', () => {
      let progressReporter: ProgressReporter
      let result: FetchResult
      let platformTestType: ObjectType
      let jiraTestType: ObjectType
      let testInstance2: InstanceElement
      let mockAxiosAdapter: MockAdapter
      beforeEach(async () => {
        progressReporter = {
          reportProgress: mockFunction<ProgressReporter['reportProgress']>(),
        }
        platformTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'platform'),
        })
        jiraTestType = new ObjectType({
          elemID: new ElemID(JIRA, 'jira'),
        })
        testInstance2 = new InstanceElement('test2', jiraTestType)
        ;(generateTypes as jest.MockedFunction<typeof generateTypes>)
          .mockResolvedValueOnce({
            allTypes: { PlatformTest: platformTestType },
            parsedConfigs: { PlatformTest: { request: { url: 'platform' } } },
          })
          .mockResolvedValueOnce({
            allTypes: { projectTest: projectTestType },
            parsedConfigs: { projectTest: { request: { url: 'project' } } },
          })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValueOnce({
          elements: [],
          errors: [{ message: 'scriptRunnerError', severity: 'Error' }],
        })
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockResolvedValueOnce({
          elements: [testInstance2],
          errors: [{ message: 'jsmError', severity: 'Error' }],
        })
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>).mockImplementation(() => {})
        ;(getAllInstances as jest.MockedFunction<typeof getAllInstances>).mockResolvedValue({
          elements: [serviceDeskProjectInstance],
          errors: [{ message: 'some error', severity: 'Error' }],
        })
        ;(loadSwagger as jest.MockedFunction<typeof loadSwagger>).mockResolvedValue({
          document: {},
          parser: {},
        } as elements.swagger.LoadedSwagger)
        mockAxiosAdapter = new MockAdapter(axios)
        mockAxiosAdapter
          // first three requests are for login assertion
          .onGet('/rest/api/3/configuration')
          .replyOnce(200)
          .onGet('/rest/api/3/serverInfo')
          .replyOnce(200, { baseUrl: 'a' })
          .onGet('/rest/api/3/instance/license')
          .reply(200, { applications: [{ id: 'jira-servicedesk', plan: 'PAID' }] })
          .onGet('/rest/servicedeskapi/assets/workspace')
          .replyOnce(200, {
            values: [
              {
                someKey: 'someValue',
              },
            ],
          })
          .onGet('/rest/servicedeskapi/servicedesk')
          .replyOnce(200, {
            size: 1,
            start: 0,
            limit: 50,
            isLastPage: true,
            _links: {},
            values: [
              {
                id: '10',
                projectId: '10000',
                projectKey: 'SD',
                projectName: 'Service Desk',
              },
            ],
          })
        // mock as we call getCloudId in the forms filter.
        mockAxiosAdapter.onPost().reply(200, {
          unparsedData: {
            [CLOUD_RESOURCE_FIELD]: safeJsonStringify({
              tenantId: 'cloudId',
            }),
          },
        })
        result = await srAdapter.fetch({ progressReporter })
      })
      afterEach(() => {
        mockAxiosAdapter.restore()
        ;(getAllElements as jest.MockedFunction<typeof getAllElements>).mockClear()
        ;(addRemainingTypes as jest.MockedFunction<typeof addRemainingTypes>).mockClear()
      })
      it('should call getAllElements', () => {
        expect(getAllElements).toHaveBeenCalledTimes(2)
      })
      it('should call addRemainingTypes', () => {
        expect(addRemainingTypes).toHaveBeenCalledTimes(1)
      })
      it('should return error', async () => {
        expect(result.errors).toEqual([
          {
            message: 'some error',
            severity: 'Error',
          },
          {
            message: 'jsmError',
            severity: 'Error',
          },
          {
            message: 'scriptRunnerError',
            severity: 'Error',
          },
        ])
      })
    })
    describe('jiraJSMAssetsEntriesFunc', () => {
      let paginator: clientUtils.Paginator
      let responseValue: clientUtils.ResponseValue[]
      let EntriesRequesterFunc: elements.ducktype.EntriesRequester
      beforeEach(() => {
        const { paginator: cliPaginator } = mockClient()
        paginator = cliPaginator
        responseValue = [
          {
            objectType: {
              id: '1',
            },
          },
        ]
        ;(getEntriesResponseValues as jest.MockedFunction<typeof getEntriesResponseValues>).mockResolvedValue(
          responseValue,
        )
        EntriesRequesterFunc = jiraJSMAssetsEntriesFunc()
      })
      it('should change the objectType object struct to id', async () => {
        const result = await EntriesRequesterFunc({
          paginator,
          args: { url: '/gateway/api/jsm/assets/workspace/defaultWorkSpaceId/v1/objectschema/2/attributes' },
          typeName: OBJECT_TYPE_ATTRIBUTE_TYPE,
          typesConfig: { ObjectTypeAttribute: { transformation: { dataField: '.' } } },
        })
        expect(result[0]).toEqual({
          objectType: '1',
        })
      })
      it('should not change the objectType object struct if no id was found', async () => {
        responseValue = [
          {
            objectType: {
              id: undefined,
            },
          },
        ]
        ;(getEntriesResponseValues as jest.MockedFunction<typeof getEntriesResponseValues>).mockResolvedValue(
          responseValue,
        )
        const result = await EntriesRequesterFunc({
          paginator,
          args: { url: '/gateway/api/jsm/assets/workspace/defaultWorkSpaceId/v1/objectschema/2/attributes' },
          typeName: OBJECT_TYPE_ATTRIBUTE_TYPE,
          typesConfig: { ObjectTypeAttribute: { transformation: { dataField: '.' } } },
        })
        expect(result[0]).toEqual({
          objectType: {
            id: undefined,
          },
        })
      })
    })
  })
})
