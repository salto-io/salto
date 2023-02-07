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
import { toChange, ObjectType, ElemID, InstanceElement, ReferenceExpression, ChangeValidator, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import _ from 'lodash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockClient } from '../utils'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { workflowSchemeMigrationValidator } from '../../src/change_validators/workflow_scheme_migration'
import { JIRA } from '../../src/constants'

jest.setTimeout(10000000)
describe('workflow scheme migration', () => {
  let workflowSchemeType: ObjectType
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let projectType: ObjectType
  let issueTypeSchemeType: ObjectType
  let issueTypeSchemeInstance: InstanceElement
  let projectInstance: InstanceElement
  let workflowInstance: InstanceElement
  let modifiedInstance: InstanceElement
  let validator: ChangeValidator
  let config: JiraConfig
  let elementSource: ReadOnlyElementsSource
  let numberOfIssues: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateSchemaIdResponse: any

  beforeEach(() => {
    jest.clearAllMocks()
    const { client, paginator, connection } = mockClient()
    mockConnection = connection
    numberOfIssues = 100
    updateSchemaIdResponse = {
      status: 200,
      data: {
        name: 'instance',
      },
    }
    workflowSchemeType = new ObjectType({ elemID: new ElemID(JIRA, 'WorkflowScheme') })
    issueTypeSchemeType = new ObjectType({ elemID: new ElemID(JIRA, 'IssueTypeScheme') })
    issueTypeSchemeInstance = new InstanceElement(
      'issueTypeScheme',
      issueTypeSchemeType,
      {
        issueTypeIds: [
          new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType1')),
          new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType2')),
        ],
      }
    )
    projectType = new ObjectType({ elemID: new ElemID(JIRA, 'Project') })
    projectInstance = new InstanceElement(
      'instance',
      projectType,
      {
        name: 'instance',
        workflowScheme: new ReferenceExpression(new ElemID(JIRA, 'WorkflowScheme', 'instance', 'workflow')),
        issueTypeScheme: new ReferenceExpression(new ElemID(JIRA, 'IssueTypeScheme', 'instance', 'issueTypeScheme')),
      }
    )
    workflowInstance = new InstanceElement(
      'workflow',
      workflowSchemeType,
      {
        id: 'workflowid',
        name: 'instance',
        defaultWorkflow: new ReferenceExpression(new ElemID(JIRA, 'Workflow', 'instance', 'default')),
        items: [
          {
            workflow: new ReferenceExpression(new ElemID(JIRA, 'Workflow', 'instance', 'workflow1')),
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType1')),
          },
          {
            workflow: new ReferenceExpression(new ElemID(JIRA, 'Workflow', 'instance', 'workflow2')),
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType2')),
          },
          {
            workflow: new ReferenceExpression(new ElemID(JIRA, 'Workflow', 'instance', 'workflow3')),
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType3')),
          },
        ],
      }
    )
    modifiedInstance = new InstanceElement(
      'workflow',
      workflowSchemeType,
      {
        id: 'workflowid',
        name: 'instance',
        defaultWorkflow: new ReferenceExpression(new ElemID(JIRA, 'Workflow', 'instance', 'default')),
        items: [
          {
            workflow: new ReferenceExpression(new ElemID(JIRA, 'Workflow', 'instance', 'workflow2')),
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType1')),
          },
          {
            workflow: new ReferenceExpression(new ElemID(JIRA, 'Workflow', 'instance', 'workflow3')),
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType2')),
          },
          {
            workflow: new ReferenceExpression(new ElemID(JIRA, 'Workflow', 'instance', 'workflow1')),
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType3')),
          },
        ],
      }
    )
    mockConnection.get.mockImplementation(async url => {
      if (url === '/rest/api/3/search') {
        return {
          status: 200,
          data: {
            total: numberOfIssues,
          },
        }
      }
      if (url === '/rest/api/3/workflowscheme/workflowid') {
        return updateSchemaIdResponse
      }
      if (url === '/rest/api/3/workflowscheme') {
        return {
          status: 200,
          data: [{
            name: 'instance',
            id: 'workflowid2',
          }],
        }
      }
      throw new Error(`Unexpected url ${url}`)
    })
    elementSource = buildElementsSourceFromElements([workflowInstance, issueTypeSchemeInstance, projectInstance])
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    validator = workflowSchemeMigrationValidator(client, config, paginator)
  })
  it('should not return error for addition/removal changes', async () => {
    const deletionErrors = await validator([toChange({ before: workflowInstance })], elementSource)
    expect(deletionErrors).toHaveLength(0)
    const additionErrors = await validator([toChange({ after: workflowInstance })], elementSource)
    expect(additionErrors).toHaveLength(0)
  })
  it('should not return error for inactive workflow scheme', async () => {
    projectInstance.value.workflowScheme = new ReferenceExpression(new ElemID(JIRA, 'WorkflowScheme', 'instance', 'workflow2'))
    const errors = await validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should not return an error for active workflow scheme with no issues in assigned projects', async () => {
    numberOfIssues = 0
    const errors = await validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should update internal id and service url for workflow scheme', async () => {
    updateSchemaIdResponse = {
      status: 400,
    }
    const errors = await validator([toChange({ before: workflowInstance, after: workflowInstance })], elementSource)
    expect(errors).toHaveLength(0)
    expect(workflowInstance.value.id).toEqual('workflowid')
    expect(workflowInstance.value.serviceUrl).toEqual('https://jira.atlassian.net')
  })
//   it('should not return an error if the change of workflows did not require migration')
//   it('should not return an error if the change was on an issue type that is not in issue type schemes')
//   it('should not return an error if all status migrations are already in the workflow scheme')
//   it('should return an error one of the items changed')
//   it('should return an error if default workflow changed')
})
