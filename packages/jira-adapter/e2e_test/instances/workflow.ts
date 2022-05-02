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
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'

export const createWorkflowValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  transitions: [
    {
      name: 'Build Broken',
      description: '',
      to: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Backlog'), allElements),
      type: 'global',
      rules: {
        triggers: [
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:commit-created-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-closed-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:pull-request-declined-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:pull-request-created-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:pull-request-merged-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:pull-request-reopened-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:branch-created-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-started-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-abandoned-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-approval-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-rejected-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-summarized-trigger',
          },
        ],
        postFunctions: [
          {
            type: 'FireIssueEventFunction',
            configuration: {
              event: {
                id: createReference(new ElemID(JIRA, 'IssueEvent', 'instance', 'Issue_Assigned@s'), allElements),
              },
            },
          },
        ],
      },
    },
    {
      name: 'Create',
      description: '',
      to: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Backlog'), allElements),
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
                id: createReference(new ElemID(JIRA, 'IssueEvent', 'instance', 'Issue_Assigned@s'), allElements),
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
        createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Done'), allElements),
      ],
      to: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Backlog'), allElements),
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
                  id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'In_Progress@s'), allElements),
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
                id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Done'), allElements),
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
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Remaining_Estimate@s'), allElements),
              excludeSubtasks: true,
            },
          },
        ],
        postFunctions: [
          {
            type: 'FireIssueEventFunction',
            configuration: {
              event: {
                id: createReference(new ElemID(JIRA, 'IssueEvent', 'instance', 'Issue_Assigned@s'), allElements),
              },
            },
          },
        ],
        conditions: {
          operator: 'AND',
          conditions: [
            {
              type: 'AlwaysFalseCondition',
            },
            {
              type: 'AlwaysFalseCondition',
            },
            {
              type: 'BlockInProgressApprovalCondition',
            },
            {
              type: 'RemoteOnlyCondition',
            },
            {
              type: 'AllowOnlyAssignee',
            },
            {
              type: 'OnlyBambooNotificationsCondition',
            },
            {
              type: 'AllowOnlyReporter',
            },
            {
              type: 'PermissionCondition',
              configuration: {
                permissionKey: 'DELETE_ISSUES',
              },
            },
            {
              type: 'PreviousStatusCondition',
              configuration: {
                ignoreLoopTransitions: true,
                includeCurrentStatus: true,
                mostRecentStatusOnly: true,
                reverseCondition: true,
                previousStatus: {
                  id: createReference(new ElemID(JIRA, 'Status', 'instance', 'Done'), allElements),
                },
              },
            },
            {
              type: 'SeparationOfDutiesCondition',
              configuration: {
                toStatus: {
                  id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Backlog'), allElements),
                },
                fromStatus: {
                  id: createReference(new ElemID(JIRA, 'Status', 'instance', 'Done'), allElements),
                },
              },
            },
            {
              type: 'SubTaskBlockingCondition',
              configuration: {
                statuses: [
                  {
                    id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Backlog'), allElements),
                  },
                  {
                    id: createReference(new ElemID(JIRA, 'Status', 'instance', 'Done'), allElements),
                  },
                ],
              },
            },
            {
              type: 'UserInAnyGroupCondition',
              configuration: {
                groups: [
                  'system-administrators',
                ],
              },
            },
            {
              type: 'InAnyProjectRoleCondition',
              configuration: {
                projectRoles: [
                  {
                    id: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
                  },
                ],
              },
            },
            {
              type: 'UserIsInCustomFieldCondition',
              configuration: {
                allowUserInField: false,
                fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee'), allElements),
              },
            },
            {
              type: 'InProjectRoleCondition',
              configuration: {
                projectRole: {
                  id: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
                },
              },
            },
            {
              type: 'ValueFieldCondition',
              configuration: {
                fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Remaining_Estimate@s'), allElements),
                fieldValue: 'val',
                comparisonType: 'STRING',
                comparator: '>',
              },
            },
          ],
        },
      },
    },
  ],
  statuses: [
    {
      id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'Backlog'), allElements),
      name: 'CustomBacklog',
      properties: [{
        key: 'jira.issue.editable',
        value: 'true',
      }],
    },
    {
      id: createReference(new ElemID(JIRA, 'Status', 'instance', 'Done'), allElements),
      name: 'Done',
      properties: [{
        key: 'jira.issue.editable',
        value: 'true',
      }],
    },
  ],
})
