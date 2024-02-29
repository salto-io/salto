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

import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { InstanceElement, ReadOnlyElementsSource, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import {
  ISSUE_TYPE_NAME,
  ISSUE_TYPE_SCHEMA_NAME,
  WORKFLOW_CONFIGURATION_TYPE,
  PROJECT_TYPE,
  STATUS_TYPE_NAME,
} from '../../../src/constants'
import { createEmptyType } from '../../utils'
import { workflowStatusMappingsValidator } from '../../../src/change_validators/workflowsV2/status_mappings'

describe('status mappings', () => {
  let workflowInstance: InstanceElement
  let defaultWorkflowInstance: InstanceElement
  let workflowSchemeInstance: InstanceElement
  let projectInstance: InstanceElement
  let issueTypeSchemeInstance: InstanceElement
  let issueType1: InstanceElement
  let issueType2: InstanceElement
  let issueType3: InstanceElement
  let issueType4: InstanceElement
  let status1: InstanceElement
  let status2: InstanceElement
  let status3: InstanceElement
  let elementsSource: ReadOnlyElementsSource

  const ERROR_MESSAGE_PREFIX =
    'This workflow change requires a status migration, as some statuses do not exist in the new workflow. In order to resume you can add the following NACL code to this workflow’s code. Make sure to specific, for each project, issue type and status, what should its new status be. Learn more at https://help.salto.io/en/articles/8851200-migrating-issues-when-modifying-workflows.\n'

  const getStatusMigrationEntry = (statusName: string): string => `{
          oldStatusReference = jira.Status.instance.${statusName}
          newStatusReference = jira.Status.instance.<statusName>
        },`

  const getStatusMappingsErrorMessageBody = (issueTypeNames: string[], statusNames: string[]): string => {
    const body = issueTypeNames.map(
      issueTypeName =>
        `{
      issueTypeId = jira.IssueType.instance.${issueTypeName}
      projectId = jira.Project.instance.projectInstance
      statusMigrations = [
        ${statusNames.map(getStatusMigrationEntry).join(`
        `)}
      ]
    },`,
    )
    return `statusMappings = [
    ${body.join('\n    ')}\n]`
  }

  beforeEach(() => {
    jest.resetAllMocks()
    status1 = new InstanceElement('status1', createEmptyType(STATUS_TYPE_NAME), {
      name: 'status1',
    })
    status2 = new InstanceElement('status2', createEmptyType(STATUS_TYPE_NAME), {
      name: 'status2',
    })
    status3 = new InstanceElement('status3', createEmptyType(STATUS_TYPE_NAME), {
      name: 'status3',
    })
    issueType1 = new InstanceElement('issueType1', createEmptyType(ISSUE_TYPE_NAME))
    issueType2 = new InstanceElement('issueType2', createEmptyType(ISSUE_TYPE_NAME))
    issueType3 = new InstanceElement('issueType3', createEmptyType(ISSUE_TYPE_NAME))
    issueType4 = new InstanceElement('issueType4', createEmptyType(ISSUE_TYPE_NAME))
    workflowInstance = new InstanceElement('workflowInstance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
      name: 'workflowInstance',
      statuses: [
        {
          statusReference: new ReferenceExpression(status1.elemID, status1),
        },
        {
          statusReference: new ReferenceExpression(status2.elemID, status2),
        },
        {
          statusReference: new ReferenceExpression(status3.elemID, status3),
        },
      ],
    })
    defaultWorkflowInstance = new InstanceElement(
      'defaultWorkflowInstance',
      createEmptyType(WORKFLOW_CONFIGURATION_TYPE),
      {
        name: 'defaultWorkflowInstance',
        statuses: [
          {
            statusReference: new ReferenceExpression(status1.elemID, status1),
          },
          {
            statusReference: new ReferenceExpression(status3.elemID, status3),
          },
        ],
      },
    )
    workflowSchemeInstance = new InstanceElement(
      'workflowSchemeInstance',
      createEmptyType(WORKFLOW_CONFIGURATION_TYPE),
      {
        name: 'workflowSchemeInstance',
        defaultWorkflow: new ReferenceExpression(defaultWorkflowInstance.elemID, defaultWorkflowInstance),
        items: [
          {
            workflow: new ReferenceExpression(workflowInstance.elemID, workflowInstance),
            issueType: new ReferenceExpression(issueType1.elemID, issueType1),
          },
          {
            workflow: new ReferenceExpression(workflowInstance.elemID, workflowInstance),
            issueType: new ReferenceExpression(issueType2.elemID, issueType2),
          },
          {
            workflow: new ReferenceExpression(workflowInstance.elemID, workflowInstance),
            issueType: new ReferenceExpression(issueType4.elemID, issueType4),
          },
        ],
      },
    )
    issueTypeSchemeInstance = new InstanceElement('issueTypeSchemeInstance', createEmptyType(ISSUE_TYPE_SCHEMA_NAME), {
      issueTypeIds: [
        new ReferenceExpression(issueType1.elemID, issueType1),
        new ReferenceExpression(issueType2.elemID, issueType2),
        new ReferenceExpression(issueType3.elemID, issueType3),
      ],
    })
    projectInstance = new InstanceElement('projectInstance', createEmptyType(PROJECT_TYPE), {
      name: 'projectInstance',
      workflowScheme: new ReferenceExpression(workflowSchemeInstance.elemID, workflowSchemeInstance),
      issueTypeScheme: new ReferenceExpression(issueTypeSchemeInstance.elemID, issueTypeSchemeInstance),
    })
    elementsSource = buildElementsSourceFromElements([
      status1,
      status2,
      status3,
      issueType1,
      issueType2,
      issueType3,
      issueTypeSchemeInstance,
      workflowInstance,
      defaultWorkflowInstance,
      workflowSchemeInstance,
      projectInstance,
    ])
  })
  it('should not return an error when there is no removed status', async () => {
    const before = workflowInstance.clone()
    workflowInstance.value.description = 'test'
    expect(
      await workflowStatusMappingsValidator([toChange({ before, after: workflowInstance })], elementsSource),
    ).toEqual([])
  })
  it('should return an error when there is a removed status from an active workflow', async () => {
    const before = workflowInstance.clone()
    workflowInstance.value.statuses.pop()
    workflowInstance.value.statuses.pop()
    expect(
      await workflowStatusMappingsValidator([toChange({ before, after: workflowInstance })], elementsSource),
    ).toEqual([
      {
        elemID: workflowInstance.elemID,
        severity: 'Error',
        message: 'Workflow change requires status migration',
        detailedMessage:
          ERROR_MESSAGE_PREFIX +
          getStatusMappingsErrorMessageBody(['issueType1', 'issueType2'], ['status2', 'status3']),
      },
    ])
  })
  it('should return an error when the statusMappings is in an invalid format', async () => {
    const before = workflowInstance.clone()
    workflowInstance.value.statuses.pop()
    workflowInstance.value.statusMappings = [
      {
        issueTypeId: 'not a reference expression',
        projectId: new ReferenceExpression(projectInstance.elemID, projectInstance),
        statusMigrations: [
          {
            oldStatusReference: new ReferenceExpression(status3.elemID, status3),
            newStatusReference: new ReferenceExpression(status2.elemID, status1),
          },
        ],
      },
    ]
    expect(
      await workflowStatusMappingsValidator([toChange({ before, after: workflowInstance })], elementsSource),
    ).toEqual([
      {
        elemID: workflowInstance.elemID,
        severity: 'Error',
        message: 'Invalid workflow status mapping',
        detailedMessage:
          'Error while validating the user-provided status mapping: Expected issueTypeId to be ReferenceExpression. Learn more at https://help.salto.io/en/articles/8851200-migrating-issues-when-modifying-workflows',
      },
    ])
  })
  it('should not return an error when there is a removed status from an inactive workflow', async () => {
    const before = workflowInstance.clone()
    workflowInstance.value.statuses.pop()
    workflowSchemeInstance.value.items = undefined
    expect(
      await workflowStatusMappingsValidator([toChange({ before, after: workflowInstance })], elementsSource),
    ).toEqual([])
  })
  it('should return the correct error message when the workflow is the default workflow of the scheme', async () => {
    const before = defaultWorkflowInstance.clone()
    defaultWorkflowInstance.value.statuses.pop()
    expect(
      await workflowStatusMappingsValidator([toChange({ before, after: defaultWorkflowInstance })], elementsSource),
    ).toEqual([
      {
        elemID: defaultWorkflowInstance.elemID,
        severity: 'Error',
        message: 'Workflow change requires status migration',
        detailedMessage: ERROR_MESSAGE_PREFIX + getStatusMappingsErrorMessageBody(['issueType3'], ['status3']),
      },
    ])
  })
  it('should not return an error when the statusMappings is valid', async () => {
    const before = workflowInstance.clone()
    workflowInstance.value.statuses.pop()
    workflowInstance.value.statusMappings = [
      {
        issueTypeId: new ReferenceExpression(issueType1.elemID, issueType1),
        projectId: new ReferenceExpression(projectInstance.elemID, projectInstance),
        statusMigrations: [
          {
            oldStatusReference: new ReferenceExpression(status3.elemID, status3),
            newStatusReference: new ReferenceExpression(status2.elemID, status1),
          },
        ],
      },
      {
        issueTypeId: new ReferenceExpression(issueType2.elemID, issueType2),
        projectId: new ReferenceExpression(projectInstance.elemID, projectInstance),
        statusMigrations: [
          {
            oldStatusReference: new ReferenceExpression(status3.elemID, status3),
            newStatusReference: new ReferenceExpression(status2.elemID, status1),
          },
        ],
      },
    ]
    expect(
      await workflowStatusMappingsValidator([toChange({ before, after: workflowInstance })], elementsSource),
    ).toEqual([])
  })
  it('should return an error when the statusMappings is invalid', async () => {
    const before = workflowInstance.clone()
    workflowInstance.value.statuses.pop()
    workflowInstance.value.statusMappings = [
      {
        issueTypeId: new ReferenceExpression(issueType1.elemID, issueType1),
        projectId: new ReferenceExpression(projectInstance.elemID, projectInstance),
        statusMigrations: [
          {
            oldStatusReference: new ReferenceExpression(status3.elemID, status3),
            newStatusReference: new ReferenceExpression(status2.elemID, status1),
          },
        ],
      },
    ]
    expect(
      await workflowStatusMappingsValidator([toChange({ before, after: workflowInstance })], elementsSource),
    ).toEqual([
      {
        elemID: workflowInstance.elemID,
        severity: 'Error',
        message: 'Workflow change requires status migration',
        detailedMessage:
          ERROR_MESSAGE_PREFIX + getStatusMappingsErrorMessageBody(['issueType1', 'issueType2'], ['status3']),
      },
    ])
  })
})
