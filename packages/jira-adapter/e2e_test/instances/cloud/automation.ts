/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, TemplateExpression, Values, Element, StaticFile } from '@salto-io/adapter-api'
import * as path from 'path'
import * as fs from 'fs'
import { createReference } from '../../utils'
import { AUTOMATION_TYPE, JIRA, PRIORITY_TYPE_NAME, PROJECT_TYPE } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

export const createAutomationValues = (name: string, allElements: Element[]): Values => ({
  name,
  state: 'ENABLED',
  authorAccountId: {
    id: '61d44bf59ee70a00685fa6b6',
    displayName: 'Testing salto',
  },
  actor: {
    type: 'ACCOUNT_ID',
    value: {
      id: '557058:f58131cb-b67d-43c7-b30d-6b58d40bd077',
      displayName: 'Automation for Jira',
    },
  },
  trigger: {
    component: 'TRIGGER',
    type: 'jira.manual.trigger.issue',
    value: {
      groups: [],
    },
  },
  components: [
    {
      component: 'BRANCH',
      type: 'jira.issue.related',
      value: {
        relatedType: 'parent',
        jql: '',
        onlyUpdatedIssues: false,
        similarityLimit: 40,
        compareValue: 0,
      },
      children: [
        {
          component: 'CONDITION',
          type: 'jira.issue.condition',
          value: {
            selectedField: {
              type: 'ID',
              value: 'status',
            },
            selectedFieldType: 'status',
            comparison: 'ONE_OF',
            compareFieldValue: {
              type: 'NAME',
              values: ['Approved'],
              multiValue: true,
            },
          },
        },
        {
          component: 'CONDITION',
          type: 'jira.jql.condition',
          rawValue: new TemplateExpression({
            parts: [
              createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Priority__priority'), allElements),
              ' = ',
              createReference(new ElemID(JIRA, PRIORITY_TYPE_NAME, 'instance', 'Medium'), allElements, ['name']),
            ],
          }),
        },
        {
          component: 'ACTION',
          type: 'jira.issue.create',
          value: {
            operations: [
              {
                field: {
                  type: 'ID',
                  value: 'summary',
                },
                fieldType: 'summary',
                type: 'SET',
                rawValue: 'value',
              },
              {
                field: {
                  type: 'ID',
                  value: 'description',
                },
                fieldType: 'description',
                type: 'SET',
                rawValue: 'descruotuib',
              },
              {
                field: {
                  type: 'ID',
                  value: 'project',
                },
                fieldType: 'project',
                type: 'SET',
                value: {
                  value: 'current',
                  type: 'COPY',
                },
              },
              {
                field: {
                  type: 'ID',
                  value: 'issuetype',
                },
                fieldType: 'issuetype',
                type: 'SET',
                value: {
                  type: 'COPY',
                  value: 'current',
                },
              },
            ],
            sendNotifications: false,
          },
        },
      ],
    },
    {
      component: 'ACTION',
      type: 'jira.issue.create',
      value: {
        operations: [
          {
            field: {
              type: 'ID',
              value: 'summary',
            },
            fieldType: 'summary',
            type: 'SET',
            rawValue: 'value',
          },
          {
            field: {
              type: 'ID',
              value: 'description',
            },
            fieldType: 'description',
            type: 'SET',
            rawValue: 'description',
          },
          {
            field: {
              type: 'ID',
              value: 'project',
            },
            fieldType: 'project',
            type: 'SET',
            value: {
              value: 'current',
              type: 'COPY',
            },
          },
          {
            field: {
              type: 'ID',
              value: 'issuetype',
            },
            fieldType: 'issuetype',
            type: 'SET',
            value: {
              type: 'COPY',
              value: 'current',
            },
          },
        ],
        sendNotifications: false,
      },
    },
    {
      component: 'ACTION',
      type: 'jira.lookup.issues',
      value: {
        name: {
          type: 'FREE',
          value: 'lookupIssues',
        },
        type: 'JQL',
        query: {
          type: 'SMART',
          value: new TemplateExpression({
            parts: [
              createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project'), allElements),
              ' = ',
              createReference(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'Test_Project@s'), allElements, ['key']),
              ' ORDER BY ',
              createReference(
                new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Rank__gh_lexo_rank__c@uubbuu'),
                allElements,
                ['name'],
              ),
              ' ASC',
            ],
          }),
        },
        lazy: false,
        id: '_customsmartvalue_id_166080756221912123',
      },
      children: [],
      conditions: [],
    },
    {
      component: 'CONDITION',
      type: 'jira.condition.container.block',
      children: [
        {
          component: 'CONDITION_BLOCK',
          type: 'jira.condition.if.block',
          value: {
            conditionMatchType: 'ALL',
          },
          children: [
            {
              component: 'ACTION',
              type: 'jira.issue.outgoing.email',
              value: {
                fromName: '',
                replyTo: '',
                to: [
                  {
                    type: 'COPY',
                    value: 'assignee',
                  },
                ],
                cc: [],
                bcc: [],
                subject: 'Test',
                body: new StaticFile({
                  filepath: `${JIRA}/${AUTOMATION_TYPE}/${name}.components.3.children.0.children.0.value.html`,
                  content: fs.readFileSync(
                    path.resolve(`${__dirname}/../../../e2e_test/stringStaticFiles/testRule1.html`),
                  ),
                  encoding: 'utf8',
                }),
                mimeType: 'text/html',
                convertLineBreaks: true,
              },
              children: [],
              conditions: [],
            },
          ],
          conditions: [
            {
              component: 'CONDITION',
              type: 'jira.user.condition',
              value: {
                conditions: [
                  {
                    field: 'reporter',
                    check: 'USER_IS',
                    criteria: [
                      {
                        type: 'ID',
                        value: {
                          id: '61d44bf59ee70a00685fa6b6',
                          displayName: 'Testing salto',
                        },
                      },
                    ],
                  },
                ],
                operator: 'OR',
              },
              children: [],
              conditions: [],
            },
          ],
        },
        {
          component: 'CONDITION_BLOCK',
          type: 'jira.condition.if.block',
          value: {
            conditionMatchType: 'ALL',
          },
          children: [
            {
              component: 'ACTION',
              type: 'jira.issue.outgoing.email',
              value: {
                fromName: '',
                replyTo: '',
                to: [
                  {
                    type: 'COPY',
                    value: 'reporter',
                  },
                ],
                cc: [],
                bcc: [],
                subject: 'Test1',
                body: new StaticFile({
                  filepath: `${JIRA}/${AUTOMATION_TYPE}/${name}.components.3.children.1.children.0.value.html`,
                  content: fs.readFileSync(
                    path.resolve(`${__dirname}/../../../e2e_test/stringStaticFiles/testRule2.html`),
                  ),
                  encoding: 'utf8',
                }),
                mimeType: 'text/html',
                convertLineBreaks: true,
              },
              children: [],
              conditions: [],
            },
          ],
          conditions: [],
        },
      ],
      conditions: [],
    },
    {
      component: 'ACTION',
      type: 'jira.issue.edit',
      value: {
        operations: [
          {
            field: {
              type: 'ID',
              value: createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Assignee__user'), allElements),
            },
            fieldType: 'assignee',
            type: 'SET',
            value: {
              type: 'CLEAR',
              value: 'clear',
            },
          },
        ],
        advancedFields: new TemplateExpression({
          parts: [
            '{\n"update": {\n"',
            createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Sprint__gh_sprint__c@uubuu'), allElements),
            '" : [\n{\n"remove": {\n"value":"Pre-ship containment"\n}\n}\n]\n}\n}',
          ],
        }),
      },
    },
  ],
  canOtherRuleTrigger: false,
  notifyOnError: 'FIRSTERROR',
  projects: [
    {
      projectTypeKey: 'business',
    },
  ],
  writeAccessType: 'UNRESTRICTED',
})
