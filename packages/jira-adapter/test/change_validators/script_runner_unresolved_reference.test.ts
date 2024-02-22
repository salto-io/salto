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
  ObjectType,
  ElemID,
  InstanceElement,
  toChange,
  UnresolvedReference,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { brokenReferenceValidator } from '../../src/change_validators/broken_references'
import {
  BEHAVIOR_TYPE,
  ISSUE_TYPE_NAME,
  JIRA,
  PROJECT_TYPE,
  SCRIPTED_FIELD_TYPE,
  SCRIPT_FRAGMENT_TYPE,
  SCRIPT_RUNNER_LISTENER_TYPE,
} from '../../src/constants'

describe('scriptRunnerUnresolvedReferenceValidator', () => {
  let scriptedFieldType: ObjectType
  let projectType: ObjectType
  let issueTypeType: ObjectType
  let scriptedFieldInstance: InstanceElement
  let listenerInstance: InstanceElement
  let behaviorInstance: InstanceElement
  let fragmentsInstance: InstanceElement
  let projectInstance: InstanceElement
  let issueTypeInstance: InstanceElement
  let unresolvedProjectElemId: ElemID
  let unresolvedIssueTypeElemId: ElemID

  beforeEach(() => {
    scriptedFieldType = new ObjectType({ elemID: new ElemID(JIRA, SCRIPTED_FIELD_TYPE) })
    projectType = new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) })
    issueTypeType = new ObjectType({ elemID: new ElemID(JIRA, ISSUE_TYPE_NAME) })
    const listenerType = new ObjectType({ elemID: new ElemID(JIRA, SCRIPT_RUNNER_LISTENER_TYPE) })
    const behaviorType = new ObjectType({ elemID: new ElemID(JIRA, BEHAVIOR_TYPE) })
    const fragmentType = new ObjectType({ elemID: new ElemID(JIRA, SCRIPT_FRAGMENT_TYPE) })
    projectInstance = new InstanceElement('ProjectInstance', projectType)
    issueTypeInstance = new InstanceElement('IssueTypeInstance', issueTypeType)
    unresolvedProjectElemId = new ElemID(JIRA, 'unresolvedProject')
    unresolvedIssueTypeElemId = new ElemID(JIRA, 'unresolvedIssueType')
    scriptedFieldInstance = new InstanceElement('scriptedFieldInstance', scriptedFieldType, {
      projectKeys: [
        new ReferenceExpression(projectInstance.elemID, projectInstance),
        new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),
      ],
      issueTypes: [
        new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance),
        new ReferenceExpression(unresolvedIssueTypeElemId, new UnresolvedReference(unresolvedIssueTypeElemId)),
      ],
    })
    behaviorInstance = new InstanceElement('behaviorInstance', behaviorType, {
      projects: [
        new ReferenceExpression(projectInstance.elemID, projectInstance),
        new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),
      ],
      issueTypes: [
        new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance),
        new ReferenceExpression(unresolvedIssueTypeElemId, new UnresolvedReference(unresolvedIssueTypeElemId)),
      ],
    })
    listenerInstance = new InstanceElement('listenerInstance', listenerType, {
      projects: [
        new ReferenceExpression(projectInstance.elemID, projectInstance),
        new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),
      ],
    })
    fragmentsInstance = new InstanceElement('fragmentsInstance', fragmentType, {
      entities: [
        new ReferenceExpression(projectInstance.elemID, projectInstance),
        new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),
      ],
    })
  })

  it('should return a warning when project reference is unresolved', async () => {
    expect(await brokenReferenceValidator([toChange({ after: scriptedFieldInstance })])).toEqual([
      {
        elemID: scriptedFieldInstance.elemID,
        severity: 'Warning',
        message: 'Scripted field won’t be attached to some issue types',
        detailedMessage:
          'The scripted field is attached to some issue types which do not exist in the target environment: unresolvedIssueType. If you continue, the scripted field will be deployed without them. Alternatively, you can go back and include these issue types in your deployment.',
      },
      {
        elemID: scriptedFieldInstance.elemID,
        severity: 'Warning',
        message: 'Scripted field won’t be attached to some projects',
        detailedMessage:
          'The scripted field is attached to some projects which do not exist in the target environment: unresolvedProject. If you continue, the scripted field will be deployed without them. Alternatively, you can go back and include these projects in your deployment.',
      },
    ])
    expect(await brokenReferenceValidator([toChange({ after: behaviorInstance })])).toEqual([
      {
        elemID: behaviorInstance.elemID,
        severity: 'Warning',
        message: 'Behavior won’t be attached to some issue types',
        detailedMessage:
          'The behavior is attached to some issue types which do not exist in the target environment: unresolvedIssueType. If you continue, the behavior will be deployed without them. Alternatively, you can go back and include these issue types in your deployment.',
      },
      {
        elemID: behaviorInstance.elemID,
        severity: 'Warning',
        message: 'Behavior won’t be attached to some projects',
        detailedMessage:
          'The behavior is attached to some projects which do not exist in the target environment: unresolvedProject. If you continue, the behavior will be deployed without them. Alternatively, you can go back and include these projects in your deployment.',
      },
    ])
    expect(await brokenReferenceValidator([toChange({ after: listenerInstance })])).toEqual([
      {
        elemID: listenerInstance.elemID,
        severity: 'Warning',
        message: 'Script runner listener won’t be attached to some projects',
        detailedMessage:
          'The script runner listener is attached to some projects which do not exist in the target environment: unresolvedProject. If you continue, the script runner listener will be deployed without them. Alternatively, you can go back and include these projects in your deployment.',
      },
    ])
    expect(await brokenReferenceValidator([toChange({ after: fragmentsInstance })])).toEqual([
      {
        elemID: fragmentsInstance.elemID,
        severity: 'Warning',
        message: 'Script fragment won’t be attached to some projects',
        detailedMessage:
          'The script fragment is attached to some projects which do not exist in the target environment: unresolvedProject. If you continue, the script fragment will be deployed without them. Alternatively, you can go back and include these projects in your deployment.',
      },
    ])
  })
  it('should not return a warning when there is not a project reference that is unresolved', async () => {
    scriptedFieldInstance.value.projectKeys = [new ReferenceExpression(projectType.elemID, projectInstance)]
    scriptedFieldInstance.value.issueTypes = [new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance)]
    behaviorInstance.value.projects = [new ReferenceExpression(projectType.elemID, projectInstance)]
    behaviorInstance.value.issueTypes = [new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance)]
    listenerInstance.value.projects = [new ReferenceExpression(projectType.elemID, projectInstance)]
    fragmentsInstance.value.entities = [new ReferenceExpression(projectType.elemID, projectInstance)]

    expect(
      await brokenReferenceValidator([
        toChange({ after: scriptedFieldInstance }),
        toChange({ after: listenerInstance }),
        toChange({ after: behaviorInstance }),
        toChange({ after: fragmentsInstance }),
      ]),
    ).toEqual([])
  })
  it('should return an error when all the projects references are unresolved', async () => {
    scriptedFieldInstance.value.projectKeys = [
      new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),
    ]
    scriptedFieldInstance.value.issueTypes = [
      new ReferenceExpression(unresolvedIssueTypeElemId, new UnresolvedReference(unresolvedIssueTypeElemId)),
    ]

    expect(await brokenReferenceValidator([toChange({ after: scriptedFieldInstance })])).toEqual([
      {
        elemID: scriptedFieldInstance.elemID,
        severity: 'Error',
        message: 'Scripted field isn’t attached to any existing issue type',
        detailedMessage:
          'All issue types attached to this scripted field do not exist in the target environment: unresolvedIssueType. The scripted field can’t be deployed. To solve this, go back and include at least one attached issue type in your deployment.',
      },
      {
        elemID: scriptedFieldInstance.elemID,
        severity: 'Error',
        message: 'Scripted field isn’t attached to any existing project',
        detailedMessage:
          'All projects attached to this scripted field do not exist in the target environment: unresolvedProject. The scripted field can’t be deployed. To solve this, go back and include at least one attached project in your deployment.',
      },
    ])
    behaviorInstance.value.projects = [
      new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),
    ]
    behaviorInstance.value.issueTypes = [
      new ReferenceExpression(unresolvedIssueTypeElemId, new UnresolvedReference(unresolvedIssueTypeElemId)),
    ]

    expect(await brokenReferenceValidator([toChange({ after: behaviorInstance })])).toEqual([
      {
        elemID: behaviorInstance.elemID,
        severity: 'Error',
        message: 'Behavior isn’t attached to any existing issue type',
        detailedMessage:
          'All issue types attached to this behavior do not exist in the target environment: unresolvedIssueType. The behavior can’t be deployed. To solve this, go back and include at least one attached issue type in your deployment.',
      },
      {
        elemID: behaviorInstance.elemID,
        severity: 'Error',
        message: 'Behavior isn’t attached to any existing project',
        detailedMessage:
          'All projects attached to this behavior do not exist in the target environment: unresolvedProject. The behavior can’t be deployed. To solve this, go back and include at least one attached project in your deployment.',
      },
    ])
    fragmentsInstance.value.entities = [
      new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),
    ]

    expect(await brokenReferenceValidator([toChange({ after: fragmentsInstance })])).toEqual([
      {
        elemID: fragmentsInstance.elemID,
        severity: 'Error',
        message: 'Script fragment isn’t attached to any existing project',
        detailedMessage:
          'All projects attached to this script fragment do not exist in the target environment: unresolvedProject. The script fragment can’t be deployed. To solve this, go back and include at least one attached project in your deployment.',
      },
    ])
  })
  it('should not return an error when all the projects references are unresolved in relevant types', async () => {
    listenerInstance.value.projects = [
      new ReferenceExpression(unresolvedProjectElemId, new UnresolvedReference(unresolvedProjectElemId)),
    ]

    const result = await brokenReferenceValidator([toChange({ after: listenerInstance })])

    expect(result).toHaveLength(1)
    expect(result[0].severity).toEqual('Warning')
  })
})
