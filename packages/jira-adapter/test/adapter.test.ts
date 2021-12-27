/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { AdapterOperations, ObjectType, ElemID, ProgressReporter, FetchResult, InstanceElement, toChange, isRemovalChange, getChangeElement, BuiltinTypes, ReferenceExpression } from '@salto-io/adapter-api'
import { deployment, elements, client } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockFunction } from '@salto-io/test-utils'
import JiraClient from '../src/client/client'
import { adapter as adapterCreator } from '../src/adapter_creator'
import { DEFAULT_INCLUDE_ENDPOINTS, DEFAULT_API_DEFINITIONS } from '../src/config'
import { JIRA } from '../src/constants'
import { createCredentialsInstance, createConfigInstance } from './utils'


const { generateTypes, getAllInstances } = elements.swagger

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn().mockImplementation(actual.elements.swagger.deployChange),
    },
    elements: {
      ...actual.elements,
      swagger: {
        ...actual.elements.swagger,
        generateTypes: jest.fn().mockImplementation(actual.elements.swagger.generateTypes),
        getAllInstances: jest.fn().mockImplementation(actual.elements.swagger.getAllInstances),
        addDeploymentAnnotations: jest.fn(),
      },
    },
  }
})

describe('adapter', () => {
  let adapter: AdapterOperations
  beforeEach(() => {
    const elementsSource = buildElementsSourceFromElements([])
    adapter = adapterCreator.operations({
      elementsSource,
      credentials: createCredentialsInstance({ baseUrl: 'http:/jira.net', user: 'u', token: 't' }),
      config: createConfigInstance({
        apiDefinitions: DEFAULT_API_DEFINITIONS,
        fetch: { includeTypes: DEFAULT_INCLUDE_ENDPOINTS },
      }),
    })
  })
  describe('deploy', () => {
    const issueTypeSchemeMappingType = new ObjectType({ elemID: new ElemID(JIRA, 'IssueTypeSchemeMapping'), fields: { issueTypeId: { refType: BuiltinTypes.STRING } } })
    let deployChangeMock: jest.MockedFunction<typeof deployment.deployChange>
    beforeEach(() => {
      deployChangeMock = deployment.deployChange as jest.MockedFunction<
       typeof deployment.deployChange
      >
      deployChangeMock.mockClear()
      deployChangeMock.mockImplementation(async change => {
        if (isRemovalChange(change)) {
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
            toChange({ before: new InstanceElement('inst1', issueTypeSchemeMappingType), after: new InstanceElement('inst1', issueTypeSchemeMappingType) }),
            toChange({ before: new InstanceElement('inst2', issueTypeSchemeMappingType) }),
          ],
        },
      })

      expect(deployRes.appliedChanges).toEqual([
        toChange({ before: new InstanceElement('inst1', issueTypeSchemeMappingType), after: new InstanceElement('inst1', issueTypeSchemeMappingType) }),
      ])
    })

    it('should call deployChange with the resolved elements', async () => {
      const referencedInstance = new InstanceElement(
        'referenced',
        new ObjectType({ elemID: new ElemID(JIRA, 'IssueTypeDetails'), fields: { id: { refType: BuiltinTypes.STRING } } }),
        { id: '3' }
      )
      await adapter.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({
              before: new InstanceElement('inst1', issueTypeSchemeMappingType),
              after: new InstanceElement('inst1', issueTypeSchemeMappingType, { issueTypeId: new ReferenceExpression(referencedInstance.elemID, referencedInstance) }),
            }),
          ],
        },
      })

      expect(deployChangeMock).toHaveBeenCalledWith(
        toChange({
          before: new InstanceElement('inst1', issueTypeSchemeMappingType),
          after: new InstanceElement('inst1', issueTypeSchemeMappingType, { issueTypeId: '3' }),
        }),
        expect.any(JiraClient),
        undefined,
      )
    })

    it('should return the errors', async () => {
      deployChangeMock.mockImplementation(async change => {
        if (isRemovalChange(change)) {
          throw new Error('some error')
        }
        throw new client.HTTPError('some error', { status: 400, data: { errorMessages: ['errorMessage'] } })
      })

      const deployRes = await adapter.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ after: new InstanceElement('inst1', issueTypeSchemeMappingType) }),
            toChange({ before: new InstanceElement('inst2', issueTypeSchemeMappingType) }),
          ],
        },
      })

      expect(deployRes.errors).toEqual([
        new Error('Deployment of jira.IssueTypeSchemeMapping.instance.inst1 failed: Error: some error. errorMessage'),
        new Error('Deployment of jira.IssueTypeSchemeMapping.instance.inst2 failed: Error: some error'),
      ])
    })

    it('should add the new id on addition', async () => {
      const instance = new InstanceElement('instance', new ObjectType({ elemID: new ElemID(JIRA, 'obj') }))
      const { appliedChanges } = await adapter.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [
            toChange({ after: instance }),
          ],
        },
      })

      expect((getChangeElement(appliedChanges[0]) as InstanceElement)?.value.id).toEqual(2)
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
    beforeEach(async () => {
      progressReporter = {
        reportProgress: mockFunction<ProgressReporter['reportProgress']>(),
      }
      const platformTestType = new ObjectType({
        elemID: new ElemID(JIRA, 'platform'),
      })
      const jiraTestType = new ObjectType({
        elemID: new ElemID(JIRA, 'jira'),
      })
      const testInstance = new InstanceElement('test', jiraTestType);

      (generateTypes as jest.MockedFunction<typeof generateTypes>)
        .mockResolvedValueOnce({
          allTypes: { PlatformTest: platformTestType },
          parsedConfigs: { PlatformTest: { request: { url: 'platform' } } },
        })
        .mockResolvedValueOnce({
          allTypes: { JiraTest: jiraTestType },
          parsedConfigs: { JiraTest: { request: { url: 'jira' } } },
        });

      (getAllInstances as jest.MockedFunction<typeof getAllInstances>)
        .mockResolvedValue([testInstance])

      result = await adapter.fetch({ progressReporter })
    })
    it('should generate types for the platform and the jira apis', () => {
      expect(generateTypes).toHaveBeenCalledWith(
        JIRA,
        expect.objectContaining({
          swagger: expect.objectContaining({
            url: 'https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json',
          }),
        }),
        undefined,
        expect.any(Object)
      )
      expect(generateTypes).toHaveBeenCalledWith(
        JIRA,
        expect.objectContaining({
          swagger: expect.objectContaining({
            url: 'https://developer.atlassian.com/cloud/jira/software/swagger.v3.json',
          }),
        }),
        undefined,
        expect.any(Object)
      )
    })
    it('should return all types and instances returned from the infrastructure', () => {
      expect(result.elements).toHaveLength(3)
    })
  })
})
