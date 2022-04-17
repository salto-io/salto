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
import { Values } from '@salto-io/adapter-api'

export const createWebhookValues = (name: string): Values => ({
  name,
  url: `https://example.com/rest/webhooks/${name}`,
  excludeBody: true,
  filters: {
    issue_related_events_section: 'status = Done',
  },
  events: [
    'option_watching_changed',
    'user_created',
    'jira:version_updated',
    'worklog_updated',
    'project_deleted',
    'sprint_created',
    'board_updated',
  ],
  enabled: true,
})
