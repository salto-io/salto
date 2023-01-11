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
import { Values } from '@salto-io/adapter-api'

export const createDashboardValues = (name: string): Values => ({
  name,
  description: 'desc!',
  layout: 'AAA',
  sharePermissions: [
    { type: 'authenticated' },
  ],
})

export const createGadget1Values = (name: string): Values => ({
  moduleKey: 'com.atlassian.jira.gadgets:bubble-chart-dashboard-item',
  color: 'blue',
  position: {
    row: 0,
    column: 2,
  },
  title: `${name}-1`,
  properties: {
    bubbleType: 'participants',
    id: 10024,
    isConfigured: true,
    name: 'AlonCompanyProject',
    recentCommentsPeriod: 7,
    refresh: 15,
    type: 'project',
    useLogarithmicScale: false,
    useRelativeColoring: true,
  },
})

export const createGadget2Values = (name: string): Values => ({
  moduleKey: 'com.atlassian.jira.gadgets:bubble-chart-dashboard-item',
  color: 'blue',
  position: {
    row: 1,
    column: 2,
  },
  title: `${name}-2`,
  properties: {
    bubbleType: 'participants',
    id: 10024,
    isConfigured: true,
    name: 'AlonCompanyProject',
    recentCommentsPeriod: 7,
    refresh: 15,
    type: 'project',
    useLogarithmicScale: false,
    useRelativeColoring: true,
  },
})
