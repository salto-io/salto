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
  {
    originalName: 'rest__api__3__project',
    newName: 'Projects',
  },
  {
    originalName: 'rest__api__3__project___projectIdOrKey___components@uuuuuuuu_00123_00125uu',
    newName: 'ProjectComponents',
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
    Projects: {
      request: {
        url: '/rest/api/3/project',
        queryParams: {
          expand: 'description,lead,url',
        },
        recurseInto: [
          {
            type: 'ProjectComponents',
            toField: 'components',
            context: [{ name: 'projectIdOrKey', fromField: 'id' }],
          },
          {
            type: 'ContainerOfWorkflowSchemeAssociations',
            toField: 'workflowScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'PermissionScheme',
            toField: 'permissionScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'NotificationScheme',
            toField: 'notificationScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'ProjectSecurityScheme',
            toField: 'issueSecurityScheme',
            context: [{ name: 'projectKeyOrId', fromField: 'key' }],
            isSingle: true,
          },
          {
            type: 'PageBeanIssueTypeScreenSchemesProjects',
            toField: 'issueTypeScreenScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'PageBeanIssueTypeSchemeProjects',
            toField: 'issueTypeScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'PageBeanFieldConfigurationSchemeProjects',
            toField: 'fieldConfigurationScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
        ],
      },
      transformation: {
        dataField: '.',
      },
    },
    ProjectComponents: {
      request: {
        url: '/rest/api/3/project/{projectIdOrKey}/components',
      },
      transformation: {
        dataField: '.',
      },
    },
  },
}
