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
import { ObjectType, ElemID, InstanceElement, toChange, UnresolvedReference, ReferenceExpression } from '@salto-io/adapter-api'
import { brokenReferenceValidator } from '../../src/change_validators/broken_references'
import { ISSUE_TYPE_NAME, JIRA, PROJECT_TYPE, SCRIPTED_FIELD_TYPE } from '../../src/constants'

describe('automationProjectUnresolvedReferenceValidator', () => {
  let scriptedFieldType: ObjectType
  let projectType: ObjectType
  let issueTypeType: ObjectType
  let scriptedFieldInstance: InstanceElement
  let projectInstance: InstanceElement
  let issueTypeInstance: InstanceElement
  let unresolvedProjectElemId: ElemID
  let unresolvedIssueTypeElemId: ElemID

  beforeEach(() => {
    scriptedFieldType = new ObjectType({ elemID: new ElemID(JIRA, SCRIPTED_FIELD_TYPE) })
    projectType = new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) })
    issueTypeType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_NAME) })
    projectInstance = new InstanceElement(
      'ProjectInstance',
      projectType,
    )
    issueTypeInstance = new InstanceElement(
      'IssueTypeInstance',
      issueTypeType,
    )
    unresolvedProjectElemId = new ElemID(JIRA, 'unresolvedProject')
    unresolvedIssueTypeElemId = new ElemID(JIRA, 'unresolvedIssueType')
    scriptedFieldInstance = new InstanceElement(
      'scriptedFieldInstance',
      scriptedFieldType,
      {
        projectKeys: [
          new ReferenceExpression(projectInstance.elemID, projectInstance),
          new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),

        ],
        issueTypes: [
          new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance),
          new ReferenceExpression(unresolvedIssueTypeElemId, new UnresolvedReference(unresolvedIssueTypeElemId)),
        ],
      },
    )
  })

  it('should return a warning when project reference is unresolved', async () => {
    expect(await brokenReferenceValidator(
      [toChange({ after: scriptedFieldInstance })]
    )).toEqual([
      {
        elemID: scriptedFieldInstance.elemID,
        severity: 'Warning',
        message: 'Scripted field won’t be attached to some issue types',
        detailedMessage: 'The scripted field is attached to some issue types which do not exist in the target environment: unresolvedIssueType. If you continue, the scripted field will be deployed without them. Alternatively, you can go back and include these issue types in your deployment.',
      },
      {
        elemID: scriptedFieldInstance.elemID,
        severity: 'Warning',
        message: 'Scripted field won’t be attached to some projects',
        detailedMessage: 'The scripted field is attached to some projects which do not exist in the target environment: unresolvedProject. If you continue, the scripted field will be deployed without them. Alternatively, you can go back and include these projects in your deployment.',
      },
    ])
  })
  it('should not return a warning when there is not a project reference that is unresolved', async () => {
    scriptedFieldInstance.value.projectKeys = [
      new ReferenceExpression(projectType.elemID, projectInstance),
    ]
    scriptedFieldInstance.value.issueTypes = [
      new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance),
    ]

    expect(await brokenReferenceValidator(
      [toChange({ after: scriptedFieldInstance })]
    )).toEqual([])
  })
  it('should return an error when all the projects references are unresolved', async () => {
    scriptedFieldInstance.value.projectKeys = [
      new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),
    ]
    scriptedFieldInstance.value.issueTypes = [
      new ReferenceExpression(unresolvedIssueTypeElemId, new UnresolvedReference(unresolvedIssueTypeElemId)),
    ]

    expect(await brokenReferenceValidator(
      [toChange({ after: scriptedFieldInstance })]
    )).toEqual([
      {
        elemID: scriptedFieldInstance.elemID,
        severity: 'Error',
        message: 'Scripted field isn’t attached to any existing issue type',
        detailedMessage: 'All issue types attached to this scripted field do not exist in the target environment: unresolvedIssueType. The scripted field can’t be deployed. To solve this, go back and include at least one attached issue type in your deployment.',
      },
      {
        elemID: scriptedFieldInstance.elemID,
        severity: 'Error',
        message: 'Scripted field isn’t attached to any existing project',
        detailedMessage: 'All projects attached to this scripted field do not exist in the target environment: unresolvedProject. The scripted field can’t be deployed. To solve this, go back and include at least one attached project in your deployment.',
      },
    ])
  })
})
