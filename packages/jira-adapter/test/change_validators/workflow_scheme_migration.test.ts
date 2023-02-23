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


const ERROR_MESSAGE = `This workflow scheme change requires an issue migration, as some issue statuses do not exist in the new workflow. If you continue with the deployment, the changes will be pushed as a workflow scheme draft but will not be published. You will have to publish them manually from Jira. Alternatively, you can add the following NACL code to this workflow’s scheme code. Make sure to specific, for each issue type and status, what should its new status be. Learn more at https://help.salto.io/en/articles/6948228-migrating-issues-when-modifying-workflow-schemes .
statusMigrations = [
  {
    issueTypeId = jira.IssueType.instance.issueType1
    statusId = jira.Status.instance.status3
    newStatusId = jira.Status.instance.<NEW_STATUS>
  },
  {
    issueTypeId = jira.IssueType.instance.issueType2
    statusId = jira.Status.instance.status1
    newStatusId = jira.Status.instance.<NEW_STATUS>
  },
  {
    issueTypeId = jira.IssueType.instance.issueType2
    statusId = jira.Status.instance.status2
    newStatusId = jira.Status.instance.<NEW_STATUS>
  },
  {
    issueTypeId = jira.IssueType.instance.issueType3
    statusId = jira.Status.instance.status4
    newStatusId = jira.Status.instance.<NEW_STATUS>
  },
]`

const WITH_PARTIAL_MIGRATION_ERROR = `This workflow scheme change requires an issue migration, as some issue statuses do not exist in the new workflow. If you continue with the deployment, the changes will be pushed as a workflow scheme draft but will not be published. You will have to publish them manually from Jira. Alternatively, you can add the following NACL code to this workflow’s scheme code. Make sure to specific, for each issue type and status, what should its new status be. Learn more at https://help.salto.io/en/articles/6948228-migrating-issues-when-modifying-workflow-schemes .
statusMigrations = [
  {
    issueTypeId = jira.IssueType.instance.issueType1
    statusId = jira.Status.instance.status3
    newStatusId = jira.Status.instance.status4
  },
  {
    issueTypeId = jira.IssueType.instance.issueType2
    statusId = jira.Status.instance.status1
    newStatusId = jira.Status.instance.status4
  },
  {
    issueTypeId = jira.IssueType.instance.issueType2
    statusId = jira.Status.instance.status2
    newStatusId = jira.Status.instance.status4
  },
  {
    issueTypeId = jira.IssueType.instance.issueType3
    statusId = jira.Status.instance.status4
    newStatusId = jira.Status.instance.<NEW_STATUS>
  },
]`

describe('workflow scheme migration', () => {
  const statusID = new ElemID(JIRA, 'status')
  const status1Id = new ElemID(JIRA, 'Status', 'instance', 'status1')
  const status2Id = new ElemID(JIRA, 'Status', 'instance', 'status2')
  const status3Id = new ElemID(JIRA, 'Status', 'instance', 'status3')
  const status4Id = new ElemID(JIRA, 'Status', 'instance', 'status4')
  const status1 = new ReferenceExpression(status1Id, new InstanceElement('status1', new ObjectType({ elemID: statusID }), { id: '1' }))
  const status2 = new ReferenceExpression(status2Id, new InstanceElement('status2', new ObjectType({ elemID: statusID }), { id: '2' }))
  const status3 = new ReferenceExpression(status3Id, new InstanceElement('status3', new ObjectType({ elemID: statusID }), { id: '3' }))
  const status4 = new ReferenceExpression(status4Id, new InstanceElement('status4', new ObjectType({ elemID: statusID }), { id: '4' }))
  const issueType1Id = new ElemID(JIRA, 'IssueType', 'instance', 'issueType1')
  const issueType2Id = new ElemID(JIRA, 'IssueType', 'instance', 'issueType2')
  const issueType3Id = new ElemID(JIRA, 'IssueType', 'instance', 'issueType3')
  const issueType4Id = new ElemID(JIRA, 'IssueType', 'instance', 'issueType4')
  const issueType5Id = new ElemID(JIRA, 'IssueType', 'instance', 'issueType5')
  let workflow1: ReferenceExpression
  let workflow2: ReferenceExpression
  let workflow3: ReferenceExpression
  let workflow4: ReferenceExpression
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

  beforeEach(() => {
    jest.clearAllMocks()
    const { client, paginator, connection } = mockClient()
    mockConnection = connection
    numberOfIssues = 100
    workflowSchemeType = new ObjectType({ elemID: new ElemID(JIRA, 'WorkflowScheme') })
    issueTypeSchemeType = new ObjectType({ elemID: new ElemID(JIRA, 'IssueTypeScheme') })
    workflow1 = new ReferenceExpression(new ElemID(JIRA, 'workflow1'), new InstanceElement('workflow1', new ObjectType({ elemID: new ElemID(JIRA, 'workflow') }), { id: '1', statuses: [{ id: status1 }, { id: status2 }] }))
    workflow2 = new ReferenceExpression(new ElemID(JIRA, 'workflow2'), new InstanceElement('workflow2', new ObjectType({ elemID: new ElemID(JIRA, 'workflow') }), { id: '2', statuses: [{ id: status3 }, { id: status4 }] }))
    workflow3 = new ReferenceExpression(new ElemID(JIRA, 'workflow3'), new InstanceElement('workflow3', new ObjectType({ elemID: new ElemID(JIRA, 'workflow') }), { id: '3', statuses: [{ id: status1 }, { id: status2 }] }))
    workflow4 = new ReferenceExpression(new ElemID(JIRA, 'workflow4'), new InstanceElement('workflow4', new ObjectType({ elemID: new ElemID(JIRA, 'workflow') }), { id: '4', statuses: [{ id: status1 }, { id: status4 }] }))
    issueTypeSchemeInstance = new InstanceElement(
      'issueTypeScheme',
      issueTypeSchemeType,
      {
        issueTypeIds: [
          new ReferenceExpression(issueType1Id),
          new ReferenceExpression(issueType2Id),
          new ReferenceExpression(issueType3Id),
          new ReferenceExpression(issueType4Id),
          new ReferenceExpression(issueType5Id),
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
        defaultWorkflow: workflow1,
        items: [
          {
            workflow: workflow2,
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType1')),
          },
          {
            workflow: workflow3,
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType2')),
          },
          {
            workflow: workflow4,
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
        defaultWorkflow: workflow1,
        items: [
          {
            workflow: workflow4,
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType1')),
          },
          {
            workflow: workflow2,
            issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType2')),
          },
          {
            workflow: workflow3,
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
        return {
          status: 200,
          data: {
            name: 'instance',
          },
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
  it('should not throw on unresolved reference', async () => {
    modifiedInstance.value.items.push(
      {
        workflow: new ReferenceExpression(new ElemID(JIRA, 'Workflow', 'instance', 'workflow5')),
        issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType5')),
      },
    )
    const errorsPromise = validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    await expect(errorsPromise).resolves.not.toThrow()
  })
  it('should not throw if there are no items at all', async () => {
    workflowInstance.value.items = undefined
    modifiedInstance.value.items = undefined
    const errorsPromise = validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    await expect(errorsPromise).resolves.not.toThrow()
  })
  it('should not throw if workflow has no statuses', async () => {
    workflow1.value.value.statuses = undefined
    workflow2.value.value.statuses = undefined
    workflow3.value.value.statuses = undefined
    workflow4.value.value.statuses = undefined
    const errorsPromise = validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    await expect(errorsPromise).resolves.not.toThrow()
  })
  it('should not return an error for active workflow scheme with no issues in assigned projects', async () => {
    numberOfIssues = 0
    const errors = await validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if the change of workflows did not require migration', async () => {
    modifiedInstance.value.items = [
      {
        workflow: workflow2,
        issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType1')),
      },
      {
        workflow: workflow4,
        issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType3')),
      },
    ]
    const errors = await validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should return status migrations with users current one on partial status migration', async () => {
    modifiedInstance.value.statusMigrations = [
      {
        issueTypeId: new ReferenceExpression(issueType1Id),
        statusId: new ReferenceExpression(status3Id),
        newStatusId: new ReferenceExpression(status4Id),
      },
      {
        issueTypeId: new ReferenceExpression(issueType2Id),
        statusId: new ReferenceExpression(status1Id),
        newStatusId: new ReferenceExpression(status4Id),
      },
      {
        issueTypeId: new ReferenceExpression(issueType2Id),
        statusId: new ReferenceExpression(status2Id),
        newStatusId: new ReferenceExpression(status4Id),
      },
    ]
    const errors = await validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    expect(errors).toHaveLength(1)
    expect(errors[0].deployActions?.postAction).toBeDefined()
    expect(errors[0].detailedMessage).toEqual(WITH_PARTIAL_MIGRATION_ERROR)
  })
  it('should not return an error if the change was on an issue type that is not in issue type schemes', async () => {
    modifiedInstance.value.items = [
      {
        workflow: workflow2,
        issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType1')),
      },
      {
        workflow: workflow3,
        issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType2')),
      },
      {
        workflow: workflow4,
        issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType3')),
      },
      {
        workflow: workflow4,
        issueType: new ReferenceExpression(new ElemID(JIRA, 'IssueType', 'instance', 'issueType6')),
      },
    ]
    const errors = await validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if all status migrations are already in the workflow scheme', async () => {
    modifiedInstance.value.statusMigrations = [
      {
        issueTypeId: new ReferenceExpression(issueType1Id),
        statusId: new ReferenceExpression(status3Id),
        newStatusId: new ReferenceExpression(status4Id),
      },
      {
        issueTypeId: new ReferenceExpression(issueType2Id),
        statusId: new ReferenceExpression(status1Id),
        newStatusId: new ReferenceExpression(status4Id),
      },
      {
        issueTypeId: new ReferenceExpression(issueType2Id),
        statusId: new ReferenceExpression(status2Id),
        newStatusId: new ReferenceExpression(status4Id),
      },
      {
        issueTypeId: new ReferenceExpression(issueType3Id),
        statusId: new ReferenceExpression(status4Id),
        newStatusId: new ReferenceExpression(status2Id),
      },
    ]
    const errors = await validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    expect(errors).toHaveLength(0)
  })
  it('should return an error one of the items changed', async () => {
    const errors = await validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    expect(errors).toHaveLength(1)
    expect(errors[0].deployActions?.postAction).toBeDefined()
    expect(errors[0].detailedMessage).toEqual(ERROR_MESSAGE)
  })
  it('should return an error if default workflow changed', async () => {
    modifiedInstance.value.defaultWorkflow = workflow2
    const errors = await validator([toChange({ before: workflowInstance, after: modifiedInstance })], elementSource)
    expect(errors).toHaveLength(1)
  })
})
