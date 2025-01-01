/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
})
