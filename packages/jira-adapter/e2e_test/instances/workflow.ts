/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../utils'
import { JIRA } from '../../src/constants'

export const createWorkflowValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  transitions: [
    {
      name: 'Create',
      description: '',
      to: createReference(new ElemID(JIRA, 'Status', 'instance', 'Backlog'), allElements),
      type: 'initial',
      rules: {
        validators: [
          {
            type: 'PermissionValidator',
            configuration: {
              permissionKey: 'CREATE_ISSUES',
            },
          },
        ],
        postFunctions: [
          {
            type: 'UpdateIssueFieldFunction',
            configuration: {
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee'), allElements),
              fieldValue: '',
            },
          },
          {
            type: 'UpdateIssueCustomFieldPostFunction',
            configuration: {
              mode: 'replace',
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created'), allElements),
              fieldValue: 'ww',
            },
          },
          {
            type: 'SetIssueSecurityFromRoleFunction',
            configuration: {
              projectRole: {
                id: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
              },
            },
          },
          {
            type: 'CopyValueFromOtherFieldPostFunction',
            configuration: {
              sourceFieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee'), allElements),
              destinationFieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Creator'), allElements),
              copyType: 'parent',
            },
          },
          {
            type: 'ClearFieldValuePostFunction',
            configuration: {
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Environment'), allElements),
            },
          },
          {
            type: 'UpdateIssueStatusFunction',
          },
          {
            type: 'AssignToCurrentUserFunction',
          },
          {
            type: 'AssignToLeadFunction',
          },
          {
            type: 'AssignToReporterFunction',
          },
          {
            type: 'CreateCommentFunction',
          },
          {
            type: 'IssueStoreFunction',
          },
          {
            type: 'FireIssueEventFunction',
            configuration: {
              event: {
                id: '1',
              },
            },
          },
        ],
      },
    },
    {
      name: 'Build Broken',
      description: '',
      to: createReference(new ElemID(JIRA, 'Status', 'instance', 'Backlog'), allElements),
      type: 'global',
      rules: {
        postFunctions: [
          {
            type: 'FireIssueEventFunction',
            configuration: {
              event: {
                id: '13',
              },
            },
          },
        ],
      },
    },
    {
      name: 'TransitionToShared',
      description: '',
      from: [
        createReference(new ElemID(JIRA, 'Status', 'instance', 'Done'), allElements),
      ],
      to: createReference(new ElemID(JIRA, 'Status', 'instance', 'Backlog'), allElements),
      type: 'directed',
      rules: {
        validators: [
          {
            type: 'DateFieldValidator',
            configuration: {
              comparator: '>',
              date1: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created'), allElements),
              date2: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created'), allElements),
              includeTime: false,
            },
          },
          {
            type: 'WindowsDateValidator',
            configuration: {
              date1: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created'), allElements),
              date2: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created'), allElements),
              windowsDays: 2,
            },
          },
          {
            type: 'FieldHasSingleValueValidator',
            configuration: {
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Last_Viewed@s'), allElements),
              excludeSubtasks: false,
            },
          },
          {
            type: 'ParentStatusValidator',
            configuration: {
              parentStatuses: [
                {
                  id: createReference(new ElemID(JIRA, 'Status', 'instance', 'In_Progress@s'), allElements),
                },
              ],
            },
          },
          {
            type: 'PermissionValidator',
            configuration: {
              permissionKey: 'MODIFY_REPORTER',
            },
          },
          {
            type: 'PreviousStatusValidator',
            configuration: {
              mostRecentStatusOnly: false,
              previousStatus: {
                id: createReference(new ElemID(JIRA, 'Status', 'instance', 'Done'), allElements),
              },
            },
          },
          {
            type: 'UserPermissionValidator',
            configuration: {
              permissionKey: 'VIEW_DEV_TOOLS',
              nullAllowed: true,
              username: 'aaa',
            },
          },
          {
            type: 'FieldRequiredValidator',
            configuration: {
              ignoreContext: true,
              errorMessage: 'wwww',
              fieldIds: [
                createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee'), allElements),
              ],
            },
          },
          {
            type: 'FieldHasSingleValueValidator',
            configuration: {
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Creator'), allElements),
              excludeSubtasks: true,
            },
          },
        ],
        postFunctions: [
          {
            type: 'FireIssueEventFunction',
            configuration: {
              event: {
                id: '13',
              },
            },
          },
        ],
        conditions: {
          type: 'AlwaysFalseCondition',
        },
      },
    },
  ],
  statuses: [
    {
      id: createReference(new ElemID(JIRA, 'Status', 'instance', 'Backlog'), allElements),
      properties: {
        'jira.issue.editable': 'true',
      },
    },
    {
      id: createReference(new ElemID(JIRA, 'Status', 'instance', 'Done'), allElements),
      properties: {
        'jira.issue.editable': 'true',
      },
    },
  ],
})
