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
import { Values } from '@salto-io/adapter-api'

export const createAutomationValues = (name: string): Values => ({
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
  ],
  labels: [],
  tags: [],
})
