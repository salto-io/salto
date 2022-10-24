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
import { config as configUtils } from '@salto-io/adapter-components'
import { AUTOMATION_LABEL_TYPE, AUTOMATION_TYPE, BOARD_COLUMN_CONFIG_TYPE, BOARD_ESTIMATION_TYPE, ISSUE_TYPE_NAME, ISSUE_TYPE_SCHEMA_NAME, RESOLUTION_TYPE_NAME, STATUS_TYPE_NAME } from '../constants'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../filters/fields/constants'


export type JspUrls = {
  add: string
  modify?: string
  remove?: string
  query?: string
  dataField?: string
}

export type JiraApiConfig = Omit<configUtils.AdapterSwaggerApiConfig, 'swagger'> & {
  types: Record<string, configUtils.TypeConfig & {
    jspRequests?: JspUrls
  }>
  platformSwagger: configUtils.AdapterSwaggerApiConfig['swagger']
  jiraSwagger: configUtils.AdapterSwaggerApiConfig['swagger']
  typesToFallbackToInternalId: string[]
}

const DEFAULT_ID_FIELDS = ['name']
const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'expand', fieldType: 'string' },
]

const DEFAULT_SERVICE_ID_FIELD = 'id'

// A list of custom field types that support options
// according to https://support.atlassian.com/jira-cloud-administration/docs/edit-a-custom-fields-options/
const FIELD_TYPES_WITH_OPTIONS = [
  'com.atlassian.jira.plugin.system.customfieldtypes:select',
  'com.atlassian.jira.plugin.system.customfieldtypes:multiselect',
  'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect',
  'com.atlassian.jira.plugin.system.customfieldtypes:radiobuttons',
  'com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes',
]

const DEFAULT_TYPE_CUSTOMIZATIONS: JiraApiConfig['types'] = {
  // Cloud platform API
  Configuration: {
    transformation: {
      dataField: '.',
      isSingleton: true,
      serviceUrl: '/secure/admin/ViewApplicationProperties.jspa',
    },
  },
  Dashboards: {
    request: {
      url: '/rest/api/3/dashboard/search',
      paginationField: 'startAt',
      queryParams: {
        expand: 'description,owner,sharePermissions',
      },
      recurseInto: [
        {
          type: 'DashboardGadgetResponse',
          toField: 'gadgets',
          context: [{ name: 'dashboardId', fromField: 'id' }],
        },
      ],
    },
  },

  DashboardGadget: {
    transformation: {
      idFields: ['title', 'position.column', 'position.row'],
      fieldTypeOverrides: [
        { fieldName: 'properties', fieldType: 'Map<unknown>' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/dashboard/{dashboardId}/gadget',
        method: 'post',
        urlParamsToFields: {
          dashboardId: '_parent.0.id',
        },
      },
      modify: {
        url: '/rest/api/3/dashboard/{dashboardId}/gadget/{gadgetId}',
        method: 'put',
        urlParamsToFields: {
          dashboardId: '_parent.0.id',
          gadgetId: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/dashboard/{dashboardId}/gadget/{gadgetId}',
        method: 'delete',
        urlParamsToFields: {
          dashboardId: '_parent.0.id',
          gadgetId: 'id',
        },
      },
    },
  },

  DashboardGadgetPosition: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'column', fieldType: 'number' },
        { fieldName: 'row', fieldType: 'number' },
      ],
    },
  },

  Dashboard: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'gadgets', fieldType: 'List<DashboardGadget>' },
        { fieldName: 'layout', fieldType: 'string' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      fieldsToOmit: [
        { fieldName: 'isFavourite' },
      ],
      standaloneFields: [
        {
          fieldName: 'gadgets',
        },
      ],
      serviceUrl: '/jira/dashboards/{id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/dashboard',
        method: 'post',
        fieldsToIgnore: ['gadgets'],
      },
      modify: {
        url: '/rest/api/3/dashboard/{id}',
        method: 'put',
        fieldsToIgnore: ['gadgets'],
      },
      remove: {
        url: '/rest/api/3/dashboard/{id}',
        method: 'delete',
      },
    },
  },
  BoardConfiguration_columnConfig_columns: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'statuses', fieldType: 'List<string>' },
      ],
    },
  },
  Fields: {
    request: {
      url: '/rest/api/3/field/search',
      paginationField: 'startAt',
      queryParams: {
        expand: 'searcherKey,isLocked',
      },
      recurseInto: [
        {
          type: 'PageBeanCustomFieldContext',
          toField: 'contexts',
          context: [
            { name: 'fieldId', fromField: 'id' },
            { name: 'fieldSchema', fromField: 'schema.custom' },
          ],
          conditions: [{
            fromField: 'id',
            match: ['customfield_.*'],
          }],
        },
        {
          type: 'PageBeanCustomFieldContextDefaultValue',
          toField: 'contextDefaults',
          skipOnError: true,
          context: [{ name: 'fieldId', fromField: 'id' }],
          conditions: [{
            fromField: 'schema.custom',
            // This condition is to avoid trying to fetch the default value
            // for unsupported types (e.g., com.atlassian.jira.ext.charting:timeinstatus)
            // for which Jira will return "Retrieving default value for provided
            // custom field is not supported."
            match: ['com.atlassian.jira.plugin.system.customfieldtypes:*'],
          }],
        },
        {
          type: 'PageBeanIssueTypeToContextMapping',
          toField: 'contextIssueTypes',
          context: [{ name: 'fieldId', fromField: 'id' }],
          conditions: [{ fromField: 'id', match: ['customfield_.*'] }],
        },
        {
          type: 'PageBeanCustomFieldContextProjectMapping',
          toField: 'contextProjects',
          context: [{ name: 'fieldId', fromField: 'id' }],
          conditions: [{ fromField: 'id', match: ['customfield_.*'] }],
        },
      ],
    },
  },
  Field: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      fieldTypeOverrides: [
        { fieldName: 'contexts', fieldType: 'list<CustomFieldContext>' },
        { fieldName: 'contextDefaults', fieldType: 'list<CustomFieldContextDefaultValue>' },
        { fieldName: 'contextIssueTypes', fieldType: 'list<IssueTypeToContextMapping>' },
        { fieldName: 'contextProjects', fieldType: 'list<CustomFieldContextProjectMapping>' },
      ],
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/field',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/field/{fieldId}',
        method: 'put',
        urlParamsToFields: {
          fieldId: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/field/{id}',
        method: 'delete',
      },
    },
  },
  ApplicationProperty: {
    transformation: {
      fieldsToOmit: [
        {
          fieldName: 'key',
        },
      ],
    },
    deployRequests: {
      modify: {
        url: '/rest/api/3/application-properties/{id}',
        method: 'put',
      },
    },
  },
  PageBeanCustomFieldContext: {
    request: {
      url: '/rest/api/3/field/{fieldId}/context',
      paginationField: 'startAt',
      recurseInto: [
        {
          type: 'PageBeanCustomFieldContextOption',
          toField: 'options',
          context: [{ name: 'contextId', fromField: 'id' }],
          conditions: [{
            fromContext: 'fieldSchema',
            match: FIELD_TYPES_WITH_OPTIONS,
          }],
        },
      ],
    },
  },

  CustomFieldContextOption: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
    },
  },

  CustomFieldContext: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'options', fieldType: 'list<CustomFieldContextOption>' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      fieldsToOmit: [
        { fieldName: 'isAnyIssueType' },
      ],
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/field/{fieldId}/context',
        method: 'post',
        urlParamsToFields: {
          fieldId: '_parent.0.id',
        },
      },
      modify: {
        url: '/rest/api/3/field/{fieldId}/context/{contextId}',
        method: 'put',
        urlParamsToFields: {
          contextId: 'id',
          fieldId: '_parent.0.id',
        },
      },
      remove: {
        url: '/rest/api/3/field/{fieldId}/context/{contextId}',
        method: 'delete',
        urlParamsToFields: {
          contextId: 'id',
          fieldId: '_parent.0.id',
        },
      },
    },
  },
  PageBeanCustomFieldContextOption: {
    request: {
      url: '/rest/api/3/field/{fieldId}/context/{contextId}/option',
      paginationField: 'startAt',
    },
  },
  FieldConfigurations: {
    request: {
      url: '/rest/api/3/fieldconfiguration',
      paginationField: 'startAt',
      recurseInto: [
        {
          type: 'PageBeanFieldConfigurationItem',
          toField: 'fields',
          context: [{ name: 'id', fromField: 'id' }],
        },
      ],
    },
  },
  FieldConfiguration: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'fields', fieldType: 'list<FieldConfigurationItem>' },
        { fieldName: 'isDefault', fieldType: 'boolean' },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/ConfigureFieldLayout!default.jspa?=&id={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/fieldconfiguration',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/fieldconfiguration/{id}',
        method: 'put',
      },
      remove: {
        url: '/rest/api/3/fieldconfiguration/{id}',
        method: 'delete',
      },
    },
  },
  PageBeanFieldConfigurationItem: {
    request: {
      url: '/rest/api/3/fieldconfiguration/{id}/fields',
      paginationField: 'startAt',
    },
  },
  FieldsConfigurationScheme: {
    request: {
      url: '/rest/api/3/fieldconfigurationscheme',
      paginationField: 'startAt',
      recurseInto: [
        {
          type: 'FieldsConfigurationIssueTypeItem',
          toField: 'items',
          context: [{ name: 'schemeId', fromField: 'id' }],
        },
      ],
    },
  },
  FieldConfigurationScheme: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'items', fieldType: 'list<FieldConfigurationIssueTypeItem>' }],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/ConfigureFieldLayoutScheme!default.jspa?=&id={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/fieldconfigurationscheme',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/fieldconfigurationscheme/{id}',
        method: 'put',
      },
      remove: {
        url: '/rest/api/3/fieldconfigurationscheme/{id}',
        method: 'delete',
      },
    },
  },

  FieldsConfigurationIssueTypeItem: {
    request: {
      url: '/rest/api/3/fieldconfigurationscheme/mapping?fieldConfigurationSchemeId={schemeId}',
      paginationField: 'startAt',
    },
  },
  FieldConfigurationIssueTypeItem: {
    transformation: {
      fieldsToOmit: [{ fieldName: 'fieldConfigurationSchemeId' }],
    },
  },
  Filters: {
    request: {
      url: '/rest/api/3/filter/search',
      queryParams: {
        expand: 'description,owner,jql,sharePermissions,subscriptions',
      },
      paginationField: 'startAt',
      recurseInto: [
        {
          // note - when the columns are default we get a 404 error if we try to get them
          // there is no way to know ahead of time if a filter has columns configured
          // but we suppress 404 errors so this works
          type: 'rest__api__3__filter___id___columns@uuuuuuuu_00123_00125uu',
          toField: 'columns',
          context: [{ name: 'id', fromField: 'id' }],
        },
      ],
    },
  },
  Filter: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'columns', fieldType: 'list<ColumnItem>' },
        { fieldName: 'expand', fieldType: 'string' },
        { fieldName: 'subscriptions', fieldType: 'list<FilterSubscription>' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      fieldsToOmit: [
        { fieldName: 'expand' },
        { fieldName: 'subscriptions' },
      ],
      serviceUrl: '/issues/?filter={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/filter',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/filter/{id}',
        method: 'put',
      },
      remove: {
        url: '/rest/api/3/filter/{id}',
        method: 'delete',
      },
    },
  },
  GroupName: {
    transformation: {
      fieldsToOmit: [
        { fieldName: 'groupId' },
      ],
    },
  },
  IssueTypeSchemes: {
    request: {
      url: '/rest/api/3/issuetypescheme',
      paginationField: 'startAt',
      recurseInto: [
        {
          type: 'IssueTypeSchemeMappings',
          toField: 'issueTypeIds',
          context: [{ name: 'schemeId', fromField: 'id' }],
        },
      ],
    },
  },

  Board_location: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'projectKeyOrId', fieldType: 'number' },
      ],
      fieldsToOmit: [
        { fieldName: 'displayName' },
        { fieldName: 'projectName' },
        { fieldName: 'projectKey' },
        { fieldName: 'projectTypeKey' },
        { fieldName: 'avatarURI' },
        { fieldName: 'name' },
      ],
    },
  },

  IssueTypeScheme: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'issueTypeIds', fieldType: 'list<IssueTypeSchemeMapping>' }],
      serviceIdField: 'issueTypeSchemeId',
      fieldsToHide: [
        { fieldName: 'id' },
      ],
      serviceUrl: '/secure/admin/ConfigureOptionSchemes!default.jspa?fieldId=&schemeId={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/issuetypescheme',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/issuetypescheme/{issueTypeSchemeId}',
        method: 'put',
        urlParamsToFields: {
          issueTypeSchemeId: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/issuetypescheme/{issueTypeSchemeId}',
        method: 'delete',
        urlParamsToFields: {
          issueTypeSchemeId: 'id',
        },
      },
    },
  },
  IssueTypeSchemeMappings: {
    request: {
      url: '/rest/api/3/issuetypescheme/mapping?issueTypeSchemeId={schemeId}',
      paginationField: 'startAt',
    },
  },
  IssueTypeSchemeMapping: {
    transformation: {
      fieldsToOmit: [{ fieldName: 'issueTypeSchemeId' }],
    },
  },
  IssueTypeScreenSchemes: {
    request: {
      url: '/rest/api/3/issuetypescreenscheme',
      paginationField: 'startAt',
      recurseInto: [
        {
          type: 'IssueTypeScreenSchemeItems',
          toField: 'issueTypeMappings',
          context: [{ name: 'schemeId', fromField: 'id' }],
        },
      ],
    },
  },
  IssueTypeScreenScheme: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'issueTypeMappings', fieldType: 'list<IssueTypeScreenSchemeItem>' }],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/ConfigureIssueTypeScreenScheme.jspa?id={id}',
    },
    request: {
      url: '/rest/api/3/issuetypescreenscheme',
      paginationField: 'startAt',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/issuetypescreenscheme',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/issuetypescreenscheme/{issueTypeScreenSchemeId}',
        method: 'put',
        urlParamsToFields: {
          issueTypeScreenSchemeId: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/issuetypescreenscheme/{issueTypeScreenSchemeId}',
        method: 'delete',
        urlParamsToFields: {
          issueTypeScreenSchemeId: 'id',
        },
      },
    },
  },
  IssueTypeScreenSchemeItems: {
    request: {
      url: '/rest/api/3/issuetypescreenscheme/mapping?issueTypeScreenSchemeId={schemeId}',
      paginationField: 'startAt',
    },
  },
  IssueTypeScreenSchemeItem: {
    transformation: {
      fieldsToOmit: [{ fieldName: 'issueTypeScreenSchemeId' }],
    },
  },

  NotificationSchemes: {
    request: {
      url: '/rest/api/3/notificationscheme',
      queryParams: {
        expand: 'all',
      },
      paginationField: 'startAt',
    },
  },
  Permissions: {
    request: {
      url: '/rest/api/3/permissions',
    },
  },
  PermissionSchemes: {
    request: {
      url: '/rest/api/3/permissionscheme',
      queryParams: {
        expand: 'permissions,user',
      },
    },
  },

  PermissionHolder: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'user', fieldType: 'User' },
        { fieldName: 'id', fieldType: 'string' },
        { fieldName: 'notificationType', fieldType: 'string' },
        { fieldName: 'parameter', fieldType: 'unknown' },
      ],
      fieldsToOmit: [
        { fieldName: 'value' },
        { fieldName: 'expand' },
        { fieldName: 'user' },
      ],
    },
  },

  PermissionGrant: {
    transformation: {
      fieldsToOmit: [
        {
          fieldName: 'id',
        },
      ],
    },
  },

  PermissionScheme: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/EditPermissions!default.jspa?schemeId={id}',
    },
    request: {
      url: '/rest/api/3/project/{projectId}/permissionscheme',
      queryParams: {
        expand: 'all',
      },
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/permissionscheme',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/permissionscheme/{schemeId}',
        method: 'put',
        urlParamsToFields: {
          schemeId: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/permissionscheme/{schemeId}',
        method: 'delete',
        urlParamsToFields: {
          schemeId: 'id',
        },
      },
    },
  },
  ProjectType: {
    transformation: {
      idFields: ['key'],
      fieldsToOmit: [
        { fieldName: 'icon' },
      ],
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

  RoleActor: {
    transformation: {
      fieldsToOmit: [
        {
          fieldName: 'id',
        },
      ],
    },
  },

  ProjectCategory: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/projectcategories/EditProjectCategory!default.jspa?id={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/projectCategory',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/projectCategory/{id}',
        method: 'put',
      },
      remove: {
        url: '/rest/api/3/projectCategory/{id}',
        method: 'delete',
      },
    },
  },

  Project: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'projectKeys', fieldType: 'List<string>' },
        { fieldName: 'entityId', fieldType: 'string' },
        { fieldName: 'leadAccountId', fieldType: 'string' },
        { fieldName: 'components', fieldType: 'list<ProjectComponent>' },
        { fieldName: 'workflowScheme', fieldType: 'WorkflowScheme' },
        { fieldName: 'permissionScheme', fieldType: 'PermissionScheme' },
        { fieldName: 'notificationScheme', fieldType: 'NotificationScheme' },
        { fieldName: 'issueSecurityScheme', fieldType: 'ProjectSecurityScheme' },
        { fieldName: 'issueTypeScreenScheme', fieldType: 'IssueTypeScreenScheme' },
        { fieldName: 'fieldConfigurationScheme', fieldType: 'FieldConfigurationScheme' },
        { fieldName: 'issueTypeScheme', fieldType: ISSUE_TYPE_SCHEMA_NAME },
        { fieldName: 'fieldContexts', fieldType: `list<${FIELD_CONTEXT_TYPE_NAME}>` },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      fieldsToOmit: [
        { fieldName: 'style' },
        { fieldName: 'simplified' },
        { fieldName: 'isPrivate' },
        { fieldName: 'expand' },
      ],
      standaloneFields: [
        {
          fieldName: 'components',
        },
      ],
      serviceUrl: '/secure/project/EditProject!default.jspa?pid={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/project',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/project/{projectIdOrKey}',
        method: 'put',
        urlParamsToFields: {
          projectIdOrKey: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/project/{projectIdOrKey}',
        method: 'delete',
        urlParamsToFields: {
          projectIdOrKey: 'id',
        },
      },
    },
  },
  ContainerOfWorkflowSchemeAssociations: {
    request: {
      url: '/rest/api/3/workflowscheme/project?projectId={projectId}',
    },
  },
  WorkflowSchemeAssociations: {
    transformation: {
      fieldsToOmit: [{ fieldName: 'projectIds' }],
    },
  },
  ProjectComponent: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'issueCount', fieldType: 'number' },
        { fieldName: 'leadAccountId', fieldType: 'string' },
        { fieldName: 'componentBean', fieldType: 'ProjectComponent' },
      ],
      fieldsToHide: [
        { fieldName: 'id' },
      ],
      fieldsToOmit: [
        { fieldName: 'issueCount' },
        { fieldName: 'projectId' },
        { fieldName: 'project' },
        { fieldName: 'realAssignee' },
        { fieldName: 'isAssigneeTypeValid' },
        { fieldName: 'realAssigneeType' },
        { fieldName: 'assignee' },
        { fieldName: 'componentBean' },
      ],
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/component',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/component/{id}',
        method: 'put',
      },
      remove: {
        url: '/rest/api/3/component/{id}',
        method: 'delete',
      },
    },
  },
  NotificationScheme: {
    request: {
      url: '/rest/api/3/project/{projectId}/notificationscheme',
    },
    transformation: {
      fieldsToHide: [{ fieldName: 'id' }],
      serviceUrl: '/secure/admin/EditNotifications!default.jspa?schemeId={id}',
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
  PageBeanIssueTypeScreenSchemesProjects: {
    request: {
      url: '/rest/api/3/issuetypescreenscheme/project?projectId={projectId}',
    },
  },

  PageBeanIssueTypeSchemeProjects: {
    request: {
      url: '/rest/api/3/issuetypescheme/project?projectId={projectId}',
    },
  },

  IssueTypeScreenSchemesProjects: {
    transformation: {
      fieldsToOmit: [{ fieldName: 'projectIds' }],
    },
  },

  PageBeanFieldConfigurationSchemeProjects: {
    request: {
      url: '/rest/api/3/fieldconfigurationscheme/project?projectId={projectId}',
    },
  },

  Screens: {
    request: {
      url: '/rest/api/3/screens',
      paginationField: 'startAt',
      recurseInto: [
        {
          type: 'rest__api__3__screens___screenId___tabs@uuuuuuuu_00123_00125uu',
          toField: 'tabs',
          context: [{ name: 'screenId', fromField: 'id' }],
        },
      ],
    },
  },

  Resolution: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/EditResolution!default.jspa?id={id}',
    },
    jspRequests: {
      add: '/secure/admin/AddResolution.jspa',
      modify: '/secure/admin/EditResolution.jspa',
      query: '/rest/api/3/resolution',
    },
  },

  Screen: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'tabs', fieldType: 'list<ScreenableTab>' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/ConfigureFieldScreen.jspa?id={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/screens',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/screens/{screenId}',
        method: 'put',
        urlParamsToFields: {
          screenId: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/screens/{screenId}',
        method: 'delete',
        urlParamsToFields: {
          screenId: 'id',
        },
      },
    },
  },
  'rest__api__3__screens___screenId___tabs@uuuuuuuu_00123_00125uu': {
    request: {
      url: '/rest/api/3/screens/{screenId}/tabs',
      recurseInto: [
        {
          type: 'rest__api__3__screens___screenId___tabs___tabId___fields@uuuuuuuu_00123_00125uuuu_00123_00125uu',
          toField: 'fields',
          context: [{ name: 'tabId', fromField: 'id' }],
        },
      ],
    },
    transformation: {
      dataField: '.',
    },
  },
  ScreenableTab: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'fields', fieldType: 'list<ScreenableField>' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/screens/{screenId}/tabs',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/screens/{screenId}/tabs/{tabId}',
        method: 'put',
        urlParamsToFields: {
          tabId: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/screens/{screenId}/tabs/{tabId}',
        method: 'delete',
        urlParamsToFields: {
          tabId: 'id',
        },
      },
    },
  },
  ScreenSchemes: {
    request: {
      url: '/rest/api/3/screenscheme',
      paginationField: 'startAt',
    },
  },
  Statuses: {
    request: {
      url: '/rest/api/3/statuses/search',
      paginationField: 'startAt',
    },
  },
  Workflows: {
    request: {
      url: '/rest/api/3/workflow/search',
      paginationField: 'startAt',
      queryParams: {
        expand: 'transitions,transitions.rules,transitions.properties,statuses,statuses.properties,operations',
      },
    },
  },
  WorkflowCondition: {
    transformation: {
      fieldsToOmit: [
        { fieldName: 'nodeType' },
      ],
    },
  },
  TransitionScreenDetails: {
    transformation: {
      fieldsToOmit: [
        { fieldName: 'name' },
      ],
    },
  },
  Workflow: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'name', fieldType: 'string' },
        { fieldName: 'entityId', fieldType: 'string' },
      ],
      idFields: ['id.name'],
      serviceIdField: 'entityId',
      fieldsToHide: [
        {
          fieldName: 'entityId',
        },
      ],
      fieldsToOmit: [
        { fieldName: 'created' },
        { fieldName: 'updated' },
      ],
      serviceUrl: '/secure/admin/workflows/ViewWorkflowSteps.jspa?workflowMode=live&workflowName={name}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/workflow',
        method: 'post',
      },
      // Works only for inactive workflows
      remove: {
        url: '/rest/api/3/workflow/{entityId}',
        method: 'delete',
      },
    },
  },
  WorkflowSchemes: {
    request: {
      url: '/rest/api/3/workflowscheme',
      paginationField: 'startAt',
    },
  },

  SecurityScheme: {
    request: {
      url: '/rest/api/3/project/{projectKeyOrId}/issuesecuritylevelscheme',
    },
    transformation: {
      dataField: '.',
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      standaloneFields: [
        {
          fieldName: 'levels',
        },
      ],
      serviceUrl: '/secure/admin/EditIssueSecurityScheme!default.jspa?=&schemeId={id}',
    },
    jspRequests: {
      add: '/secure/admin/AddIssueSecurityScheme.jspa',
      modify: '/secure/admin/EditIssueSecurityScheme.jspa',
      remove: '/secure/admin/DeleteIssueSecurityScheme.jspa',
      query: '/rest/api/3/issuesecurityschemes',
      dataField: 'issueSecuritySchemes',
    },
  },

  ProjectSecurityScheme: {
    request: {
      url: '/rest/api/3/project/{projectKeyOrId}/issuesecuritylevelscheme',
    },
    transformation: {
      dataField: '.',
    },
  },

  SecuritySchemes: {
    request: {
      url: '/rest/api/3/issuesecurityschemes',
      recurseInto: [
        {
          type: 'SecurityLevel',
          toField: 'levels',
          context: [
            { name: 'id', fromField: 'id' },
            { name: 'issueSecuritySchemeId', fromField: 'id' },
          ],
        },
      ],
    },
  },

  PageBeanIssueSecurityLevelMember: {
    request: {
      url: '/rest/api/3/issuesecurityschemes/{issueSecuritySchemeId}/members?issueSecurityLevelId={issueSecurityLevelId}',
    },
  },

  IssueSecurityLevelMember: {
    transformation: {
      fieldsToOmit: [
        { fieldName: 'issueSecurityLevelId' },
      ],
    },
    jspRequests: {
      add: '/secure/admin/AddIssueSecurity.jspa',
      remove: '/secure/admin/DeleteIssueSecurity.jspa',
      query: '/rest/api/3/issuesecurityschemes/{schemeId}/members',
      dataField: 'values',
    },
  },

  SecurityLevel: {
    request: {
      url: '/rest/api/3/issuesecurityschemes/{id}',
      recurseInto: [
        {
          type: 'PageBeanIssueSecurityLevelMember',
          toField: 'members',
          context: [{
            name: 'issueSecurityLevelId', fromField: 'id',
          }],
        },
      ],
    },
    transformation: {
      dataField: 'levels',
      fieldTypeOverrides: [
        { fieldName: 'levels', fieldType: 'List<SecurityLevel>' },
        { fieldName: 'members', fieldType: 'List<IssueSecurityLevelMember>' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      fieldsToOmit: [
        {
          fieldName: 'self',
        },
      ],
    },
    jspRequests: {
      add: '/secure/admin/EditIssueSecurities!addLevel.jspa',
      modify: '/secure/admin/EditSecurityLevel.jspa',
      remove: '/secure/admin/DeleteIssueSecurityLevel.jspa',
      query: '/rest/api/3/issuesecurityschemes/{schemeId}',
      dataField: 'levels',
    },
  },

  StatusCategory: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
    },
  },

  Status: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'string' },
        { fieldName: 'name', fieldType: 'string' },
        { fieldName: 'statusCategory', fieldType: 'string' },
        { fieldName: 'scope', fieldType: 'StatusScope' },
        { fieldName: 'description', fieldType: 'string' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      fieldsToOmit: [
        {
          fieldName: 'scope',
        },
        {
          fieldName: 'icon',
        },
        {
          fieldName: 'resolved',
        },
      ],
      serviceUrl: '/secure/admin/EditStatus!default.jspa?id={id}',
      nameMapping: 'lowercase',
    },
    deployRequests: {
      remove: {
        url: '/rest/api/3/statuses?id={id}',
        method: 'delete',
      },
    },
  },

  WorkflowScheme: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/EditWorkflowScheme.jspa?schemeId={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/workflowscheme',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/workflowscheme/{id}',
        method: 'put',
      },
      remove: {
        url: '/rest/api/3/workflowscheme/{id}',
        method: 'delete',
      },
    },
  },
  IssueType: {
    request: {
      url: '/rest/api/3/issuetype',
    },
    transformation: {
      dataField: '.',
      fieldTypeOverrides: [
        { fieldName: 'untranslatedName', fieldType: 'string' },
      ],
      fieldsToOmit: [
        { fieldName: 'subtask' },
        { fieldName: 'avatarId' },
        { fieldName: 'iconUrl' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/EditIssueType!default.jspa?id={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/issuetype',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/issuetype/{id}',
        method: 'put',
      },
      remove: {
        url: '/rest/api/3/issuetype/{id}',
        method: 'delete',
      },
    },
  },
  AttachmentSettings: {
    transformation: {
      isSingleton: true,
      serviceUrl: '/secure/admin/ViewAttachmentSettings.jspa',
    },
  },
  Permissions_permissions: {
    transformation: {
      isSingleton: true,
    },
  },

  // Jira API
  Boards: {
    request: {
      url: '/rest/agile/1.0/board',
      paginationField: 'startAt',
      queryParams: {
        expand: 'admins,permissions',
      },
      recurseInto: [
        {
          type: 'BoardConfiguration',
          toField: 'config',
          context: [{ name: 'boardId', fromField: 'id' }],
          isSingle: true,
        },
      ],
    },
  },

  BoardConfiguration_estimation: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'timeTracking', fieldType: 'string' },
        { fieldName: 'field', fieldType: 'string' },
      ],
      fieldsToOmit: [
        { fieldName: 'type' },
      ],
    },
  },

  Group: {
    transformation: {
      fieldsToHide: [
        { fieldName: 'groupId' },
      ],
      serviceIdField: 'groupId',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/group',
        method: 'post',
      },
      remove: {
        url: '/rest/api/3/group?groupId={groupId}',
        method: 'delete',
      },
    },
  },

  Groups: {
    request: {
      url: '/rest/api/3/group/bulk',
      paginationField: 'startAt',
    },
  },

  Board: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'config', fieldType: 'BoardConfiguration' },
        { fieldName: 'filterId', fieldType: 'string' },
        { fieldName: 'columnConfig', fieldType: BOARD_COLUMN_CONFIG_TYPE },
        { fieldName: 'subQuery', fieldType: 'string' },
        { fieldName: 'estimation', fieldType: BOARD_ESTIMATION_TYPE },
      ],
      fieldsToOmit: [
        { fieldName: 'canEdit' },
      ],
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
    },
    deployRequests: {
      add: {
        url: '/rest/agile/1.0/board',
        method: 'post',
      },
      remove: {
        url: '/rest/agile/1.0/board/{boardId}',
        method: 'delete',
        urlParamsToFields: {
          boardId: 'id',
        },
      },
    },
  },

  IssueLinkType: {
    deployRequests: {
      add: {
        url: '/rest/api/3/issueLinkType',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/issueLinkType/{issueLinkTypeId}',
        method: 'put',
        urlParamsToFields: {
          issueLinkTypeId: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/issueLinkType/{issueLinkTypeId}',
        method: 'delete',
        urlParamsToFields: {
          issueLinkTypeId: 'id',
        },
      },
    },
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/EditLinkType!default.jspa?id={id}',
    },
  },

  ProjectRole: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/project/EditProjectRole!default.jspa?id={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/role',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/role/{id}',
        method: 'put',
      },
      remove: {
        url: '/rest/api/3/role/{id}',
        method: 'delete',
      },
    },
  },

  TimeTrackingProvider: {
    transformation: {
      serviceUrl: '/secure/admin/TimeTrackingAdmin.jspa',
    },
  },

  Automation: {
    transformation: {
      serviceUrl: '/jira/settings/automation#/rule/{id}',
    },
  },

  IssueEvent: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/ListEventTypes.jspa',
    },
  },
  Priorities: {
    request: {
      url: '/rest/api/3/priority/search',
      paginationField: 'startAt',
    },
  },
  Priority: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/EditPriority!default.jspa?id={id}',
    },
    deployRequests: {
      add: {
        url: '/rest/api/3/priority',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/priority/{id}',
        method: 'put',
      },
    },
  },

  ApplicationRole: {
    transformation: {
      fieldsToOmit: [
        { fieldName: 'userCount' },
        { fieldName: 'remainingSeats' },
        { fieldName: 'groupDetails' },
        { fieldName: 'defaultGroupsDetails' },
      ],
    },
  },

  FilterSubscription: {
    transformation: {
      fieldsToOmit: [
        { fieldName: 'id' },
      ],
    },
  },

  SharePermission: {
    transformation: {
      fieldsToOmit: [
        {
          fieldName: 'id',
        },
      ],
    },
  },

  ScreenScheme: {
    transformation: {
      fieldsToHide: [
        {
          fieldName: 'id',
        },
      ],
      serviceUrl: '/secure/admin/ConfigureFieldScreenScheme.jspa?id={id}',
    },

    deployRequests: {
      add: {
        url: '/rest/api/3/screenscheme',
        method: 'post',
      },
      modify: {
        url: '/rest/api/3/screenscheme/{screenSchemeId}',
        method: 'put',
        urlParamsToFields: {
          screenSchemeId: 'id',
        },
      },
      remove: {
        url: '/rest/api/3/screenscheme/{screenSchemeId}',
        method: 'delete',
        urlParamsToFields: {
          screenSchemeId: 'id',
        },
      },
    },
  },

  BoardConfiguration: {
    transformation: {
      fieldsToOmit: [
        { fieldName: 'id' },
        { fieldName: 'name' },
        { fieldName: 'type' },
        { fieldName: 'ranking' },
        { fieldName: 'location' },
      ],
    },
    request: {
      url: '/rest/agile/1.0/board/{boardId}/configuration',
    },
  },
}

const SUPPORTED_TYPES = {
  ApplicationProperty: ['ApplicationProperties'],
  ApplicationRole: ['ApplicationRoles'],
  AttachmentSettings: ['AttachmentSettings'],
  Configuration: ['Configuration'],
  TimeTrackingProvider: ['TimeTrackingProviders'],
  Dashboard: ['Dashboards'],
  Field: ['Fields'],
  FieldConfiguration: ['FieldConfigurations'],
  FieldConfigurationScheme: ['FieldsConfigurationScheme'],
  // Should remove when doing the configuration migration
  FieldsConfigurationIssueTypeItem: ['FieldsConfigurationIssueTypeItem'],
  Filter: ['Filters'],
  IssueLinkType: ['IssueLinkTypes'],
  IssueEvent: ['IssueEvents'],
  IssueType: ['IssueType'],
  SecurityScheme: ['SecuritySchemes'],
  IssueTypeScheme: ['IssueTypeSchemes'],
  // Should remove when doing the configuration migration
  IssueTypeSchemeMappings: ['IssueTypeSchemeMappings'],
  IssueTypeScreenScheme: ['IssueTypeScreenSchemes'],
  // Should remove when doing the configuration migration
  IssueTypeScreenSchemeItems: ['IssueTypeScreenSchemeItems'],
  NotificationScheme: ['NotificationSchemes'],
  Permissions_permissions: ['Permissions'],
  PermissionScheme: ['PermissionSchemes'],
  Priority: ['Priorities'],
  ProjectCategory: ['ProjectCategories'],
  Project: ['Projects'],
  ProjectType: ['ProjectTypes'],
  Resolution: ['Resolutions'],
  ProjectRole: ['Roles'],
  Screen: ['Screens'],
  ScreenScheme: ['ScreenSchemes'],
  Status: ['Statuses'],
  StatusCategory: ['StatusCategories'],
  Workflow: ['Workflows'],
  WorkflowScheme: ['WorkflowSchemes'],
  ServerInformation: ['ServerInformation'],
  Board: ['Boards'],
  Group: ['Groups'],
  Automation: [],
  Webhook: [],
  [AUTOMATION_LABEL_TYPE]: [],
}

export const DEFAULT_API_DEFINITIONS: JiraApiConfig = {
  platformSwagger: {
    url: 'https://raw.githubusercontent.com/salto-io/jira-swaggers/main/platform-swagger.v3.json',
    typeNameOverrides: [
      {
        originalName: 'FilterDetails',
        newName: 'Filter',
      },
      {
        originalName: 'IssueTypeDetails',
        newName: ISSUE_TYPE_NAME,
      },
      {
        originalName: 'JiraStatus',
        newName: STATUS_TYPE_NAME,
      },
      {
        originalName: 'rest__api__3__application_properties@uuuuuub',
        newName: 'ApplicationProperties',
      },
      {
        originalName: 'rest__api__3__applicationrole',
        newName: 'ApplicationRoles',
      },
      {
        originalName: 'rest__api__3__configuration__timetracking__list',
        newName: 'TimeTrackingProviders',
      },
      {
        originalName: 'PageBeanDashboard',
        newName: 'Dashboards',
      },
      {
        originalName: 'PageBeanField',
        newName: 'Fields',
      },
      {
        originalName: 'PageBeanFieldConfigurationDetails',
        newName: 'FieldConfigurations',
      },
      {
        originalName: 'FieldConfigurationDetails',
        newName: 'FieldConfiguration',
      },
      {
        originalName: 'PageBeanFieldConfigurationScheme',
        newName: 'FieldsConfigurationScheme',
      },
      {
        originalName: 'PageBeanFieldConfigurationIssueTypeItem',
        newName: 'FieldsConfigurationIssueTypeItem',
      },
      {
        originalName: 'PageBeanFilterDetails',
        newName: 'Filters',
      },
      {
        originalName: 'PageBeanIssueTypeScheme',
        newName: 'IssueTypeSchemes',
      },
      {
        originalName: 'PageBeanIssueTypeSchemeMapping',
        newName: 'IssueTypeSchemeMappings',
      },
      {
        originalName: 'PageBeanIssueTypeScreenScheme',
        newName: 'IssueTypeScreenSchemes',
      },
      {
        originalName: 'PageBeanIssueTypeScreenSchemeItem',
        newName: 'IssueTypeScreenSchemeItems',
      },
      {
        originalName: 'PageBeanNotificationScheme',
        newName: 'NotificationSchemes',
      },
      {
        originalName: 'PageBeanPriority',
        newName: 'Priorities',
      },
      {
        originalName: 'rest__api__3__projectCategory',
        newName: 'ProjectCategories',
      },
      {
        originalName: 'PageBeanProject',
        newName: 'Projects',
      },
      {
        originalName: 'ComponentWithIssueCount',
        newName: 'ProjectComponent',
      },
      {
        originalName: 'rest__api__3__project__type',
        newName: 'ProjectTypes',
      },
      {
        originalName: 'rest__api__3__resolution',
        newName: 'Resolutions',
      },
      {
        originalName: 'rest__api__3__role',
        newName: 'Roles',
      },
      {
        originalName: 'PageBeanScreen',
        newName: 'Screens',
      },
      {
        originalName: 'PageBeanScreenScheme',
        newName: 'ScreenSchemes',
      },
      {
        originalName: 'PageOfStatuses',
        newName: 'Statuses',
      },
      {
        originalName: 'rest__api__3__statuscategory',
        newName: 'StatusCategories',
      },
      {
        originalName: 'PageBeanWorkflow',
        newName: 'Workflows',
      },
      {
        originalName: 'PageBeanWorkflowScheme',
        newName: 'WorkflowSchemes',
      },
      {
        originalName: 'rest__api__3__events',
        newName: 'IssueEvents',
      },
      {
        originalName: 'Webhook',
        newName: 'AppWebhook',
      },
      {
        originalName: 'PageBeanGroupDetails',
        newName: 'Groups',
      },
      {
        originalName: 'GroupDetails',
        newName: 'Group',
      },
    ],
    additionalTypes: [
      // Needed to create a different transformation configuration for security scheme
      // that is fetched from the recurse into of a project and a normal security scheme
      { typeName: 'ProjectSecurityScheme', cloneFrom: 'SecurityScheme' },
    ],
  },
  jiraSwagger: {
    url: 'https://raw.githubusercontent.com/salto-io/jira-swaggers/main/software-swagger.v3.json',
    typeNameOverrides: [
      {
        originalName: 'rest__agile__1_0__board@uuuuvuu',
        newName: 'Boards',
      },
      {
        originalName: 'Boards_values',
        newName: 'Board',
      },
      {
        originalName: 'rest__agile__1_0__board___boardId___configuration@uuuuvuuuu_00123_00125uu',
        newName: 'BoardConfiguration',
      },
    ],
  },
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: FIELDS_TO_OMIT,
      serviceIdField: DEFAULT_SERVICE_ID_FIELD,
    },
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
  typesToFallbackToInternalId: [
    AUTOMATION_TYPE,
    'CustomFieldContext',
    FIELD_TYPE_NAME,
    RESOLUTION_TYPE_NAME,
    STATUS_TYPE_NAME,
  ],
  supportedTypes: SUPPORTED_TYPES,
}
