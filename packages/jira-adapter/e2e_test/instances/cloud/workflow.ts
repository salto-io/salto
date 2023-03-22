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
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { JIRA, STATUS_TYPE_NAME } from '../../../src/constants'

export const createWorkflowValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  transitions: [
    {
      name: 'Build Broken',
      description: '',
      to: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
      type: 'global',
      rules: {
        triggers: [
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:branch-created-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:commit-created-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:pull-request-created-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:pull-request-declined-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:pull-request-merged-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:pull-request-reopened-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-abandoned-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-approval-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-closed-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-rejected-trigger',
          },
          {
            key: 'com.atlassian.jira.plugins.jira-development-integration-plugin:review-started-trigger',
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
          {
            type: 'com.onresolve.jira.groovy.groovyrunner__script-postfunction',
            configuration: {
              scriptRunner: {
                className: 'com.adaptavist.sr.cloud.workflow.AssignToUserInGroup',
                uuid: 'e9c3d0ec-0d9d-4b1f-b010-3c0e3a18111a',
                enabled: true,
                executionUser: 'ADD_ON',
                condition: 'issue.fields.assignee != null',
                description: 'Assign Issue',
                groupName: createReference(new ElemID(JIRA, 'Group', 'instance', 'system_administrators@b'), allElements, ['name']),
                roleId: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
              },
            },
          },
        ],
      },
    },
    {
      name: 'Create',
      description: '',
      to: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
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
            type: 'AssignToCurrentUserFunction',
          },
          {
            type: 'AssignToLeadFunction',
          },
          {
            type: 'AssignToReporterFunction',
          },
          {
            type: 'ClearFieldValuePostFunction',
            configuration: {
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Environment__string'), allElements),
            },
          },
          {
            type: 'CopyValueFromOtherFieldPostFunction',
            configuration: {
              sourceFieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
              destinationFieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Creator__user'), allElements),
              copyType: 'parent',
            },
          },
          {
            type: 'CreateCommentFunction',
          },
          {
            type: 'FireIssueEventFunction',
            configuration: {
              event: {
                id: createReference(new ElemID(JIRA, 'IssueEvent', 'instance', 'Issue_Assigned@s'), allElements),
              },
            },
          },
          {
            type: 'IssueStoreFunction',
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
            type: 'UpdateIssueCustomFieldPostFunction',
            configuration: {
              mode: 'replace',
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created__datetime'), allElements),
              fieldValue: 'ww',
            },
          },
          {
            type: 'UpdateIssueFieldFunction',
            configuration: {
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
              fieldValue: '',
            },
          },
          {
            type: 'UpdateIssueStatusFunction',
          },
        ],
      },
    },
    {
      name: 'TransitionToShared',
      description: '',
      from: [
        createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
      ],
      to: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
      type: 'directed',
      rules: {
        validators: [
          {
            type: 'DateFieldValidator',
            configuration: {
              comparator: '>',
              date1: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created__datetime'), allElements),
              date2: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created__datetime'), allElements),
              includeTime: false,
            },
          },
          {
            type: 'FieldHasSingleValueValidator',
            configuration: {
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Last_Viewed__datetime@suu'), allElements),
              excludeSubtasks: false,
            },
          },
          {
            type: 'FieldHasSingleValueValidator',
            configuration: {
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Remaining_Estimate__number@suu'), allElements),
              excludeSubtasks: true,
            },
          },
          {
            type: 'FieldRequiredValidator',
            configuration: {
              ignoreContext: true,
              errorMessage: 'wwww',
              fieldIds: [
                createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
              ],
            },
          },
          {
            type: 'ParentStatusValidator',
            configuration: {
              parentStatuses: [
                {
                  id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'in_progress@s'), allElements),
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
                id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
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
            type: 'WindowsDateValidator',
            configuration: {
              date1: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created__datetime'), allElements),
              date2: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created__datetime'), allElements),
              windowsDays: 2,
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
              type: 'AllowOnlyAssignee',
            },
            {
              type: 'AllowOnlyReporter',
            },
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
              type: 'InProjectRoleCondition',
              configuration: {
                projectRole: {
                  id: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
                },
              },
            },
            {
              type: 'OnlyBambooNotificationsCondition',
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
                  id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
                },
              },
            },
            {
              type: 'RemoteOnlyCondition',
            },
            {
              type: 'SeparationOfDutiesCondition',
              configuration: {
                toStatus: {
                  id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
                },
                fromStatus: {
                  id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
                },
              },
            },
            {
              type: 'SubTaskBlockingCondition',
              configuration: {
                statuses: [
                  {
                    id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
                  },
                  {
                    id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
                  },
                ],
              },
            },
            {
              type: 'UserInAnyGroupCondition',
              configuration: {
                groups: [
                  createReference(new ElemID(JIRA, 'Group', 'instance', 'system_administrators@b'), allElements, ['name']),
                ],
              },
            },
            {
              type: 'UserIsInCustomFieldCondition',
              configuration: {
                allowUserInField: false,
                fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
              },
            },
            {
              type: 'ValueFieldCondition',
              configuration: {
                fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Remaining_Estimate__number@suu'), allElements),
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
      id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
      name: 'CustomBacklog',
      properties: [{
        key: 'jira.issue.editable',
        value: 'true',
      }],
    },
    {
      id: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
      name: 'Done',
      properties: [{
        key: 'jira.issue.editable',
        value: 'true',
      }],
    },
  ],
})
