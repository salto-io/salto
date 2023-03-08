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
        postFunctions: [
          {
            type: 'com.atlassian.jira.workflow.function.event.FireIssueEventFunction',
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
      to: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
      type: 'initial',
      rules: {
        validators: [
          {
            type: 'com.atlassian.jira.workflow.validator.PermissionValidator',
            configuration: {
              permissionKey: 'CREATE_ISSUES',
            },
          },
        ],
        postFunctions: [
          {
            type: 'com.atlassian.jira.workflow.function.event.FireIssueEventFunction',
            configuration: {
              event: {
                id: createReference(new ElemID(JIRA, 'IssueEvent', 'instance', 'Issue_Assigned@s'), allElements),
              },
            },
          },
          {
            type: 'com.atlassian.jira.workflow.function.issue.AssignToCurrentUserFunction',
            configuration: {
              'full.module.key': 'com.atlassian.jira.plugin.system.workflowassigntocurrentuser-function',
            },
          },
          {
            type: 'com.atlassian.jira.workflow.function.issue.AssignToLeadFunction',
            configuration: {
              'full.module.key': 'com.atlassian.jira.plugin.system.workflowassigntolead-function',
            },
          },
          {
            type: 'com.atlassian.jira.workflow.function.issue.AssignToReporterFunction',
            configuration: {
              'full.module.key': 'com.atlassian.jira.plugin.system.workflowassigntoreporter-function',
            },
          },
          {
            type: 'com.atlassian.jira.workflow.function.issue.UpdateIssueFieldFunction',
            configuration: {
              fieldId: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
              fieldValue: '',
            },
          },
          {
            type: 'com.atlassian.jira.workflow.function.issue.UpdateIssueStatusFunction',
          },
          {
            type: 'com.atlassian.jira.workflow.function.misc.CreateCommentFunction',
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
      type: 'common',
      rules: {
        validators: [
          {
            type: 'com.atlassian.jira.workflow.validator.PermissionValidator',
            configuration: {
              permissionKey: 'MODIFY_REPORTER',
            },
          },
          {
            type: 'com.atlassian.jira.workflow.validator.UserPermissionValidator',
            configuration: {
              nullallowed: 'true',
              permissionKey: 'ADMINISTER_PROJECTS',
              'vars.key': 'aaa',
            },
          },
        ],
        postFunctions: [
          {
            type: 'com.atlassian.jira.workflow.function.event.FireIssueEventFunction',
            configuration: {
              event: {
                id: createReference(new ElemID(JIRA, 'IssueEvent', 'instance', 'Issue_Assigned@s'), allElements),
              },
            },
          },
          {
            type: 'com.onresolve.jira.groovy.GroovyFunctionPlugin',
            configuration: {
              FIELD_SECURITY_LEVEL_ID: createReference(new ElemID(JIRA, 'SecurityLevel', 'instance', 'test__test'), allElements),
              FIELD_FUNCTION_ID: '8b6dfd6d-d46a-49ba-9dab-fe2ca70c2911',
              FIELD_NOTES: 'Post17',
              'full.module.key': 'com.onresolve.jira.groovy.groovyrunnerscriptrunner-workflow-function-com.onresolve.scriptrunner.canned.jira.workflow.postfunctions.SetIssueSecurity',
              'canned-script': 'com.onresolve.scriptrunner.canned.jira.workflow.postfunctions.SetIssueSecurity',
              FIELD_CONDITION: {
                script: 'issue.projectObject.key == XYZ17',
              },
            },
          },
        ],
        conditions: {
          operator: 'AND',
          conditions: [
            {
              type: 'com.atlassian.jira.workflow.condition.AllowOnlyAssignee',
            },
            {
              type: 'com.atlassian.jira.workflow.condition.AllowOnlyReporter',
            },
            {
              type: 'com.atlassian.jira.workflow.condition.AlwaysFalseCondition',
            },
            {
              type: 'com.atlassian.jira.workflow.condition.InProjectRoleCondition',
              configuration: {
                projectRole: {
                  id: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
                },
              },
            },
            {
              type: 'com.atlassian.jira.workflow.condition.PermissionCondition',
              configuration: {
                permissionKey: 'DELETE_ISSUES',
              },
            },
            {
              type: 'com.atlassian.jira.workflow.condition.SubTaskBlockingCondition',
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
              type: 'com.atlassian.servicedesk.plugins.approvals.internal.workflow.BlockInProgressApprovalCondition',
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
