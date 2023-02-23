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
import { ObjectType, ElemID, InstanceElement, ReferenceExpression, ChangeValidator, toChange, ReadOnlyElementsSource, ChangeError } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockClient } from '../utils'
import { issueTypeSchemeMigrationValidator } from '../../src/change_validators/issue_type_scheme_migration'
import { ISSUE_TYPE_NAME, ISSUE_TYPE_SCHEMA_NAME, JIRA, PROJECT_TYPE } from '../../src/constants'

describe('issue type scheme migration validator', () => {
  const issueTypeObject = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_NAME) })
  const issueTypeInstance1 = new InstanceElement('issueType1', issueTypeObject, { name: 'issueType1' })
  const issueTypeInstance2 = new InstanceElement('issueType2', issueTypeObject, { name: 'issueType2' })
  const issueTypeInstance3 = new InstanceElement('issueType3', issueTypeObject, { name: 'issueType3' })
  const issueTypeInstance4 = new InstanceElement('issueType4', issueTypeObject, { name: 'issueType4' })
  const issueTypeReference1 = new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType1'), issueTypeInstance1)
  const issueTypeReference2 = new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType2'), issueTypeInstance2)
  const issueTypeReference3 = new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType3'), issueTypeInstance3)
  const issueTypeReference4 = new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType4'), issueTypeInstance4)
  const projectType = new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) })
  let projectInstance: InstanceElement
  let secondProjectInstance: InstanceElement
  let issueTypeScheme: InstanceElement
  let modifiedIssueTypeScheme: InstanceElement
  let validator: ChangeValidator
  let elementSource: ReadOnlyElementsSource
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let numberOfIssues: number
  const callValidator = async (): Promise<readonly ChangeError[]> => {
    const changes = [
      toChange({ before: issueTypeScheme, after: modifiedIssueTypeScheme }),
    ]
    return validator(changes, elementSource)
  }

  beforeEach(() => {
    jest.clearAllMocks()
    const { client, connection } = mockClient()
    mockConnection = connection
    numberOfIssues = 100
    const issueTypeSchemeType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_SCHEMA_NAME) })
    projectInstance = new InstanceElement(
      'instance',
      projectType,
      {
        name: 'instance',
        workflowScheme: new ReferenceExpression(new ElemID(JIRA, 'WorkflowScheme', 'instance', 'workflow')),
        issueTypeScheme: new ReferenceExpression(new ElemID(JIRA, 'IssueTypeScheme', 'instance', 'issueTypeScheme')),
      }
    )
    secondProjectInstance = new InstanceElement(
      'instance2',
      projectType,
      {
        name: 'instance',
        workflowScheme: new ReferenceExpression(new ElemID(JIRA, 'WorkflowScheme', 'instance', 'workflow')),
        issueTypeScheme: new ReferenceExpression(new ElemID(JIRA, 'IssueTypeScheme', 'instance', 'issueTypeScheme')),
      }
    )
    issueTypeScheme = new InstanceElement(
      'issueTypeScheme',
      issueTypeSchemeType,
      {
        defaultIssueTypeId: new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType1')),
        issueTypeIds: [
          issueTypeReference1,
          issueTypeReference2,
          issueTypeReference3,
        ],
      }
    )
    modifiedIssueTypeScheme = new InstanceElement(
      'issueTypeScheme',
      issueTypeSchemeType,
      {
        defaultIssueTypeId: new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType1')),
        issueTypeIds: [
          issueTypeReference1,
          issueTypeReference4,
        ],
      }
    )
    elementSource = buildElementsSourceFromElements([
      projectInstance,
      secondProjectInstance,
      issueTypeInstance1,
      issueTypeInstance2,
      issueTypeInstance3,
      issueTypeInstance4,
      issueTypeScheme,
      modifiedIssueTypeScheme,
    ])
    mockConnection.get.mockImplementation(async url => {
      if (url === '/rest/api/3/search') {
        return {
          status: 200,
          data: {
            total: numberOfIssues,
          },
        }
      }
      throw new Error(`Unexpected url ${url}`)
    })
    validator = issueTypeSchemeMigrationValidator(client)
  })

  it('should not return an error if no issue types were removed', async () => {
    modifiedIssueTypeScheme.value.issueTypeIds = [
      ...issueTypeScheme.value.issueTypeIds,
      issueTypeReference4,
    ]
    expect(await callValidator()).toEqual([])
  })

  it('should not throw on unresolved issue type reference', async () => {
    issueTypeScheme.value.issueTypeIds = [
      new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'issueType5')),
    ]
    modifiedIssueTypeScheme.value.issueTypeIds = [
    ]
    await expect(callValidator()).resolves.not.toThrow()
  })
  it('should not throw on missing issue type ids ', async () => {
    issueTypeScheme.value.issueTypeIds = undefined
    modifiedIssueTypeScheme.value.issueTypeIds = undefined
    await expect(callValidator()).resolves.not.toThrow()
  })

  it('should not return an error on removal/addition changes', async () => {
    expect(await validator([toChange({ before: issueTypeScheme })], elementSource)).toEqual([])
    expect(await validator([toChange({ after: issueTypeScheme })], elementSource)).toEqual([])
  })
  it('should not return an error if element source is undefined', async () => {
    expect(await validator([toChange({ before: issueTypeScheme, after: modifiedIssueTypeScheme })])).toEqual([])
  })
  it('should not return an error if there are no linked issues', async () => {
    numberOfIssues = 0
    expect(await callValidator()).toEqual([])
  })
  it('should not return an error if changed issue type scheme is not used by projects', async () => {
    elementSource = buildElementsSourceFromElements([])
    expect(await callValidator()).toEqual([])
  })
  it("should assume there aren't issues if error is returned from server", async () => {
    mockConnection.get.mockImplementation(async url => {
      if (url === '/rest/api/3/search') {
        throw new Error('error')
      }
      throw new Error(`Unexpected url ${url}`)
    })
    expect(await callValidator()).toHaveLength(0)
  })
  it("should assume there aren't issues bad response from server", async () => {
    mockConnection.get.mockResolvedValueOnce({
      status: 200,
      data: [],
    })
    mockConnection.get.mockResolvedValueOnce({
      status: 200,
      data: {
        something: 'else',
      },
    })
    const errors = await callValidator()
    expect(errors).toHaveLength(0)
  })
  it('should return a error if there are linked issues', async () => {
    const errors = await callValidator()
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toEqual('Cannot remove issue types from scheme')
    expect(errors[0].detailedMessage).toEqual('The issue types issueType2, issueType3 have assigned issues and cannot be removed from this issue type scheme')
  })
  it('should only include issue type with assigned issues in error', async () => {
    numberOfIssues = 0
    mockConnection.get.mockImplementationOnce(async url => {
      if (url === '/rest/api/3/search') {
        return {
          status: 200,
          data: {
            total: 100,
          },
        }
      }
      throw new Error(`Unexpected url ${url}`)
    })
    const errors = await callValidator()
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toEqual('Cannot remove issue type from scheme')
    expect(errors[0].detailedMessage).toEqual('The issue type issueType2 have assigned issues and cannot be removed from this issue type scheme')
  })
})
