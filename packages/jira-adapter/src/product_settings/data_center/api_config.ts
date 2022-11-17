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
import { JiraApiConfig } from '../../config/api_config'

export const DC_ADDITIONAL_TYPE_NAME_OVERRIDES = [
  {
    originalName: 'rest__api__3__priority',
    newName: 'Priorities',
  },
]

export const DC_DEFAULT_API_DEFINITIONS: Partial<JiraApiConfig> = {
  types: {
    IssueEvent: {
      deployRequests: {
        add: {
          url: '/rest/api/3/events',
          method: 'post',
        },
        modify: {
          url: '/rest/api/3/events',
          method: 'put',
        },
        remove: {
          url: '/rest/api/3/events?id={id}',
          method: 'delete',
        },
      },
    },
    Dashboard: {
      transformation: {
        serviceUrl: '/secure/Dashboard.jspa?selectPageId={id}',
      },
    },
    Automation: {
      transformation: {
        serviceUrl: '/secure/AutomationGlobalAdminAction!default.jspa#/rule/{id}',
      },
    },
    Priorities: {
      request: {
        url: '/rest/api/3/priority',
      },
      transformation: {
        dataField: '.',
      },
    },
  },
}
