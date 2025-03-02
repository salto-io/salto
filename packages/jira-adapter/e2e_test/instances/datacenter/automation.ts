/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ReferenceExpression, StaticFile, TemplateExpression, Values, Element } from '@salto-io/adapter-api'
import * as path from 'path'
import * as fs from 'fs'
import { AUTOMATION_TYPE, JIRA } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { createReference } from '../../utils'

export const createAutomationValues = (name: string, allElements: Element[]): Values => ({
  name,
  state: 'ENABLED',
  canOtherRuleTrigger: false,
  notifyOnError: 'FIRSTERROR',
  authorAccountId: {
    id: 'salto',
  },
  actorAccountId: {
    id: 'salto',
  },
  trigger: {
    component: 'TRIGGER',
    type: 'jira.manual.trigger.issue',
    value: {
      groups: [],
    },
    children: [],
    conditions: [],
    optimisedIds: [],
    newComponent: false,
  },
  components: [
    {
      component: 'ACTION',
      type: 'jira.issue.create',
      value: {
        operations: [
          {
            fieldId: 'summary',
            fieldType: 'summary',
            type: 'SET',
            rawValue: 'asd',
          },
          {
            fieldId: 'description',
            fieldType: 'description',
            type: 'SET',
            rawValue: '',
          },
          {
            fieldId: 'project',
            fieldType: 'project',
            type: 'SET',
            value: {
              value: 'current',
              type: 'COPY',
            },
          },
          {
            fieldId: 'issuetype',
            fieldType: 'issuetype',
            type: 'SET',
            value: {
              value: 'current',
              type: 'COPY',
            },
          },
        ],
        sendNotifications: false,
        useLegacyRendering: false,
      },
      children: [],
      conditions: [],
      optimisedIds: [],
      newComponent: false,
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
                from: '',
                fromName: '',
                replyTo: '',
                to: [
                  {
                    type: 'REFERENCE',
                    value: 'jira.Group.instance.test_deploy@b',
                    additional: 'GROUP',
                  },
                ],
                cc: [],
                bcc: [],
                subject: 'test1',
                body: new StaticFile({
                  filepath: `${JIRA}/${AUTOMATION_TYPE}/${name}.components.1.children.0.children.0.value.html`,
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
              optimisedIds: [],
              newComponent: false,
            },
          ],
          conditions: [
            {
              component: 'CONDITION',
              type: 'jira.user.condition',
              value: {
                conditions: [
                  {
                    field: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Reporter__user')),
                    check: 'USER_IS',
                    criteria: [
                      {
                        type: 'SMART',
                        value: '{{issue.assignee}}',
                      },
                    ],
                  },
                ],
                operator: 'AND',
              },
              children: [],
              conditions: [],
              optimisedIds: [],
              newComponent: false,
            },
          ],
          optimisedIds: [],
          newComponent: false,
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
                from: '',
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
                subject: 'test2',
                body: new StaticFile({
                  filepath: `${JIRA}/${AUTOMATION_TYPE}/${name}.components.1.children.1.children.0.value.html`,
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
              optimisedIds: [],
              newComponent: false,
            },
          ],
          conditions: [
            {
              component: 'CONDITION',
              type: 'jira.user.condition',
              value: {
                conditions: [
                  {
                    field: new ReferenceExpression(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Assignee__user')),
                    check: 'USER_IS',
                    criteria: [
                      {
                        type: 'SMART',
                        value: '{{issue.assignee}}',
                      },
                    ],
                  },
                ],
                operator: 'AND',
              },
              children: [],
              conditions: [],
              optimisedIds: [],
              newComponent: false,
            },
          ],
          optimisedIds: [],
          newComponent: false,
        },
      ],
      conditions: [],
      optimisedIds: [],
      newComponent: false,
    },
    {
      component: 'ACTION',
      type: 'jira.issue.edit',
      value: {
        operations: [
          {
            fieldId: 'assignee',
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
        sendNotifications: true,
        useLegacyRendering: false,
      },
      children: [],
      conditions: [],
      optimisedIds: [],
      newComponent: false,
    },
  ],
  labels: [],
})
