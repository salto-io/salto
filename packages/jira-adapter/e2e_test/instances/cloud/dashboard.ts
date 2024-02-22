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

export const createDashboardValues = (name: string): Values => ({
  name,
  description: 'desc!',
  layout: 'AAA',
  sharePermissions: [{ type: 'authenticated' }],
})

export const createGadget1Values = (name: string): Values => ({
  moduleKey: 'com.atlassian.jira.gadgets:bubble-chart-dashboard-item',
  color: 'blue',
  position: {
    row: 0,
    column: 2,
  },
  title: `${name}-1`,
  properties: [
    {
      key: 'bubbleType',
      value: 'participants',
    },
    {
      key: 'id',
      value: 10024,
    },
    {
      key: 'isConfigured',
      value: true,
    },
    {
      key: 'name',
      value: 'AlonCompanyProject',
    },
    {
      key: 'recentCommentsPeriod',
      value: 7,
    },
    {
      key: 'refresh',
      value: 15,
    },
    {
      key: 'type',
      value: 'project',
    },
    {
      key: 'useLogarithmicScale',
      value: false,
    },
    {
      key: 'useRelativeColoring',
      value: true,
    },
  ],
})

export const createGadget2Values = (name: string): Values => ({
  moduleKey: 'com.atlassian.jira.gadgets:bubble-chart-dashboard-item',
  color: 'blue',
  position: {
    row: 1,
    column: 2,
  },
  title: `${name}-2`,
  properties: [
    {
      key: 'bubbleType',
      value: 'participants',
    },
    {
      key: 'id',
      value: 10024,
    },
    {
      key: 'isConfigured',
      value: true,
    },
    {
      key: 'name',
      value: 'AlonCompanyProject',
    },
    {
      key: 'recentCommentsPeriod',
      value: 7,
    },
    {
      key: 'refresh',
      value: 15,
    },
    {
      key: 'type',
      value: 'project',
    },
    {
      key: 'useLogarithmicScale',
      value: false,
    },
    {
      key: 'useRelativeColoring',
      value: true,
    },
  ],
})
