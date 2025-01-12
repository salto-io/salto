/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import {
  DEFAULT_API_DEFINITIONS,
  SCRIPT_RUNNER_DUCKTYPE_API_DEFINITIONS,
  JiraApiConfig,
  JSM_DUCKTYPE_API_DEFINITIONS,
} from '../config/api_config'
import { ProductSettings } from './product_settings'
import { addTypeNameOverrides } from './utils'

const CLOUD_DEFAULT_API_DEFINITIONS: Partial<JiraApiConfig> = {
  types: {
    IssueSecurityLevelMember: {
      request: undefined,
      jspRequests: {
        add: '/secure/admin/AddIssueSecurity.jspa',
        remove: '/secure/admin/DeleteIssueSecurity.jspa',
        query: '/rest/api/3/issuesecurityschemes/{schemeId}/members',
        dataField: 'values',
      },
    },
    SecurityLevel: {
      request: undefined,
      jspRequests: {
        add: '/secure/admin/EditIssueSecurities!addLevel.jspa',
        modify: '/secure/admin/EditSecurityLevel.jspa',
        remove: '/secure/admin/DeleteIssueSecurityLevel.jspa',
        query: '/rest/api/3/issuesecurityschemes/{schemeId}',
        dataField: 'levels',
      },
    },
    SecurityScheme: {
      request: undefined,
      jspRequests: {
        add: '/secure/admin/AddIssueSecurityScheme.jspa',
        modify: '/secure/admin/EditIssueSecurityScheme.jspa',
        remove: '/secure/admin/DeleteIssueSecurityScheme.jspa',
        query: '/rest/api/3/issuesecurityschemes',
        dataField: 'issueSecuritySchemes',
      },
    },
    Priorities: {
      request: {
        url: '/rest/api/3/priority/search',
        paginationField: 'startAt',
      },
    },
    Projects: {
      request: {
        url: '/rest/api/3/project/search',
        paginationField: 'startAt',
        queryParams: {
          expand: 'description,lead,url',
        },
        recurseInto: [
          {
            type: 'PageBeanComponentWithIssueCount',
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
    },
    NotificationScheme: {
      request: {
        url: '/rest/api/3/project/{projectId}/notificationscheme',
      },
      jspRequests: {
        add: '/secure/admin/AddNotificationScheme.jspa',
        modify: '/secure/admin/EditNotificationScheme.jspa',
        remove: '/secure/admin/DeleteNotificationScheme.jspa',
      },
    },
    NotificationSchemeEvent: {
      transformation: {
        fieldTypeOverrides: [
          { fieldName: 'eventType', fieldType: 'number' },
          { fieldName: 'notifications', fieldType: 'List<PermissionHolder>' },
        ],
      },
      jspRequests: {
        add: '/secure/admin/AddNotification.jspa',
        remove: '/secure/admin/DeleteNotification.jspa',
        query: '/rest/api/3/notificationscheme/{id}?expand=all',
      },
    },
  },
}

const CLOUD_ADDITIONAL_TYPE_NAME_OVERRIDES = [
  {
    originalName: 'PageBeanPriority',
    newName: 'Priorities',
  },
  {
    originalName: 'PageBeanProject',
    newName: 'Projects',
  },
]

export const CLOUD_SETTINGS: ProductSettings = {
  defaultApiDefinitions: definitionsUtils.mergeWithDefaultConfig(
    addTypeNameOverrides(DEFAULT_API_DEFINITIONS, CLOUD_ADDITIONAL_TYPE_NAME_OVERRIDES),
    CLOUD_DEFAULT_API_DEFINITIONS,
  ) as JiraApiConfig,
  wrapConnection: _.identity,
  type: 'cloud',
  defaultScriptRunnerApiDefinitions: SCRIPT_RUNNER_DUCKTYPE_API_DEFINITIONS,
  defaultDuckTypeApiDefinitions: JSM_DUCKTYPE_API_DEFINITIONS,
}
