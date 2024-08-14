/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { createReference } from '../../utils'
import { JIRA, STATUS_TYPE_NAME } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

export const createWorkflowValues = (name: string, allElements: Element[]): Values => ({
  scope: {
    type: 'GLOBAL',
  },
  name,
  description: name,
  isEditable: true,
  startPointLayout: {
    x: 784,
    y: 92.4,
  },
  transitions: {
    [naclCase('Build Broken::From: any status::Global')]: {
      name: 'Build Broken',
      description: '',
      to: {
        statusReference: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
        port: 7,
      },
      type: 'GLOBAL',
      triggers: [
        {
          ruleKey: 'system:development-triggers',
          parameters: {
            enabledTriggers: [
              'branch-created-trigger',
              'commit-created-trigger',
              'pull-request-created-trigger',
              'pull-request-declined-trigger',
              'pull-request-merged-trigger',
              'pull-request-reopened-trigger',
              'review-started-trigger',
              'review-approval-trigger',
              'review-rejected-trigger',
              'review-abandoned-trigger',
              'review-closed-trigger',
              'review-summarized-trigger',
            ],
          },
        },
      ],
      actions: [
        {
          ruleKey: 'connect:remote-workflow-function',
          parameters: {
            appKey: 'com.onresolve.jira.groovy.groovyrunner__script-postfunction',
            id: 'd1738503-2939-425e-9018-0532c0a62bac',
            disabled: 'false',
            scriptRunner: {
              className: 'com.adaptavist.sr.cloud.workflow.AssignToUserInGroup',
              uuid: '4238d79d-c63a-4e28-9ba7-27e0876bf2de',
              enabled: true,
              executionUser: 'ADD_ON',
              condition: 'issue.fields.assignee != null',
              description: 'Assign Issue',
              groupName: createReference(
                new ElemID(JIRA, 'Group', 'instance', 'system_administrators@b'),
                allElements,
                ['name'],
              ),
              roleId: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
            },
          },
        },
      ],
    },
    [naclCase('Create::From: none::Initial')]: {
      name: 'Create',
      description: '',
      to: {
        statusReference: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
        port: 7,
      },
      type: 'INITIAL',
      validators: [
        {
          ruleKey: 'system:check-permission-validator',
          parameters: {
            permissionKey: 'CREATE_ISSUES',
          },
        },
      ],
      actions: [
        {
          ruleKey: 'system:change-assignee',
          parameters: {
            type: 'to-unassigned',
          },
        },
        {
          ruleKey: 'system:update-field',
          parameters: {
            field: createReference(new ElemID(JIRA, 'Field', 'instance', 'Environment__string'), allElements),
            value: 'ww',
            mode: 'replace',
          },
        },
        {
          ruleKey: 'system:set-security-level-from-role',
          parameters: {
            roleId: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
          },
        },
        {
          ruleKey: 'system:copy-value-from-other-field',
          parameters: {
            sourceFieldKey: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
            targetFieldKey: createReference(new ElemID(JIRA, 'Field', 'instance', 'Creator__user'), allElements),
            issueSource: 'PARENT',
          },
        },
        {
          ruleKey: 'system:update-field',
          parameters: {
            field: createReference(new ElemID(JIRA, 'Field', 'instance', 'Environment__string'), allElements),
          },
        },
        {
          ruleKey: 'system:change-assignee',
          parameters: {
            type: 'to-current-user',
          },
        },
        {
          ruleKey: 'system:change-assignee',
          parameters: {
            type: 'to-lead',
          },
        },
        {
          ruleKey: 'system:change-assignee',
          parameters: {
            type: 'to-reporter',
          },
        },
      ],
    },
    [naclCase('TransitionToShared::From: Done::Directed')]: {
      name: 'TransitionToShared',
      description: '',
      from: [
        {
          statusReference: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
          port: 1,
        },
      ],
      to: {
        statusReference: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
        port: 7,
      },
      type: 'DIRECTED',
      validators: [
        {
          ruleKey: 'system:validate-field-value',
          parameters: {
            ruleType: 'dateFieldComparison',
            date1FieldKey: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created__datetime'), allElements),
            date2FieldKey: createReference(new ElemID(JIRA, 'Field', 'instance', 'Created__datetime'), allElements),
            includeTime: 'false',
            conditionSelected: '>',
          },
        },
        {
          ruleKey: 'system:validate-field-value',
          parameters: {
            ruleType: 'fieldRequired',
            fieldsRequired: [createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements)],
            ignoreContext: 'true',
            errorMessage: 'bla bla bla',
          },
        },
        {
          ruleKey: 'system:validate-field-value',
          parameters: {
            ruleType: 'fieldHasSingleValue',
            fieldKey: createReference(new ElemID(JIRA, 'Field', 'instance', 'Last_Viewed__datetime@suu'), allElements),
            excludeSubtasks: 'false',
          },
        },
        {
          ruleKey: 'system:validate-field-value',
          parameters: {
            ruleType: 'fieldHasSingleValue',
            fieldKey: createReference(
              new ElemID(JIRA, 'Field', 'instance', 'Remaining_Estimate__number@suu'),
              allElements,
            ),
            excludeSubtasks: 'true',
          },
        },
        {
          ruleKey: 'system:parent-or-child-blocking-validator',
          parameters: {
            blocker: 'PARENT',
            statusIds: [createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'in_progress@s'), allElements)],
          },
        },
        {
          ruleKey: 'system:check-permission-validator',
          parameters: {
            permissionKey: 'MODIFY_REPORTER',
          },
        },
        {
          ruleKey: 'system:previous-status-validator',
          parameters: {
            previousStatusIds: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
            mostRecentStatusOnly: 'false',
          },
        },
        {
          ruleKey: 'system:check-permission-validator',
          parameters: {
            permissionKey: 'MODIFY_REPORTER',
          },
        },
        {
          ruleKey: 'system:validate-field-value',
          parameters: {
            ruleType: 'windowDateComparison',
            date1FieldKey: createReference(
              new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Created__datetime'),
              allElements,
            ),
            date2FieldKey: createReference(
              new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Created__datetime'),
              allElements,
            ),
            numberOfDays: '2',
          },
        },
      ],
      conditions: {
        operation: 'ALL',
        conditions: [
          {
            ruleKey: 'system:restrict-issue-transition',
            parameters: {
              accountIds: 'allow-assignee',
            },
          },
          {
            ruleKey: 'system:restrict-issue-transition',
            parameters: {
              accountIds: 'allow-reporter',
            },
          },
          {
            ruleKey: 'system:restrict-from-all-users',
            parameters: {
              restrictMode: 'usersAndAPI',
            },
          },
          {
            ruleKey: 'system:block-in-progress-approval',
          },
          {
            ruleKey: 'system:restrict-issue-transition',
            parameters: {
              roleIds: [createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements)],
            },
          },
          {
            ruleKey: 'system:restrict-issue-transition',
            parameters: {
              permissionKeys: 'DELETE_ISSUES',
            },
          },
          {
            ruleKey: 'system:previous-status-condition',
            parameters: {
              previousStatusIds: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
              not: 'true',
              mostRecentStatusOnly: 'true',
              includeCurrentStatus: 'true',
              ignoreLoopTransitions: 'true',
            },
          },
          {
            ruleKey: 'system:separation-of-duties',
            parameters: {
              fromStatusId: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
              toStatusId: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
            },
          },
          {
            ruleKey: 'system:parent-or-child-blocking-condition',
            parameters: {
              blocker: 'CHILD',
              statusIds: [
                createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
                createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
              ],
            },
          },
          {
            ruleKey: 'system:restrict-issue-transition',
            parameters: {
              denyUserCustomFields: createReference(
                new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Created__datetime'),
                allElements,
              ),
            },
          },
          {
            ruleKey: 'system:check-field-value',
            parameters: {
              fieldId: createReference(
                new ElemID(JIRA, 'Field', 'instance', 'Remaining_Estimate__number@suu'),
                allElements,
              ),
              fieldValue: '["val"]',
              comparator: '>',
              comparisonType: 'STRING',
            },
          },
        ],
      },
    },
  },
  statuses: [
    {
      statusReference: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'backlog'), allElements),
      layout: {
        x: 12.34,
        y: 56.78,
      },
      deprecated: false,
      name: 'Backlog',
    },
    {
      statusReference: createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements),
      layout: {
        x: 67.89,
        y: 20.78,
      },
      deprecated: false,
      name: 'Done',
    },
  ],
})
