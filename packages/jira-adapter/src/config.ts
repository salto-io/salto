/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { ElemID, CORE_ANNOTATIONS, BuiltinTypes, ObjectType } from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import { JIRA } from './constants'

const { createClientConfigType } = clientUtils
const { createUserFetchConfigType, createSwaggerAdapterApiConfigType } = configUtils

const DEFAULT_ID_FIELDS = ['name']
const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'expand', fieldType: 'string' },
]

type JiraClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>

type JiraFetchConfig = configUtils.UserFetchConfig
type JiraApiConfig = Omit<configUtils.AdapterSwaggerApiConfig, 'swagger'> & {
  platformSwagger: configUtils.AdapterSwaggerApiConfig['swagger']
  jiraSwagger: configUtils.AdapterSwaggerApiConfig['swagger']
}


const DEFAULT_TYPE_CUSTOMIZATIONS: JiraApiConfig['types'] = {
  // Cloud platform API
  Configuration: {
    transformation: {
      dataField: '.',
    },
  },
  PageBeanDashboard: {
    request: {
      url: '/rest/api/3/dashboard/search',
      paginationField: 'startAt',
      queryParams: {
        expand: 'description,owner,viewUrl,favouritedCount,sharePermissions',
      },
    },
  },
  PageBeanField: {
    request: {
      url: '/rest/api/3/field/search',
      paginationField: 'startAt',
      queryParams: {
        expand: 'key,searcherKey',
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
          context: [{ name: 'fieldId', fromField: 'id' }],
          conditions: [{
            fromField: 'schema.custom',
            // TODO - not all types allow defaults and options
            // not clear which types allow options and which do not
            match: [
              'com.atlassian.jira.plugin.system.customfieldtypes:select',
              'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect',
            ],
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
      idFields: ['id'],
      fieldTypeOverrides: [
        { fieldName: 'contexts', fieldType: 'list<CustomFieldContext>' },
        // TODO:ORI - move this to a "mapping" type fetch logic?
        { fieldName: 'contextDefaults', fieldType: 'list<CustomFieldContextDefaultValue>' },
        { fieldName: 'contextIssueTypes', fieldType: 'list<IssueTypeToContextMapping>' },
        { fieldName: 'contextProjects', fieldType: 'list<CustomFieldContextProjectMapping>' },
      ],
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
            // TODO - not all types allow defaults and options
            // not clear which types allow options and which do not
            match: [
              'com.atlassian.jira.plugin.system.customfieldtypes:select',
              'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect',
            ],
          }],
        },
      ],
    },
  },
  CustomFieldContext: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'options', fieldType: 'list<CustomFieldContextOption>' },
      ],
    },
  },
  PageBeanCustomFieldContextOption: {
    request: {
      url: '/rest/api/3/field/{fieldId}/context/{contextId}/option',
      paginationField: 'startAt',
    },
  },
  PageBeanFieldConfiguration: {
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
      ],
    },
  },
  PageBeanFieldConfigurationItem: {
    request: {
      url: '/rest/api/3/fieldconfiguration/{id}/fields',
      paginationField: 'startAt',
    },
  },
  PageBeanFieldConfigurationScheme: {
    request: {
      url: '/rest/api/3/fieldconfigurationscheme',
      paginationField: 'startAt',
    },
  },
  PageBeanFieldConfigurationIssueTypeItem: {
    request: {
      url: '/rest/api/3/fieldconfigurationscheme/mapping',
      paginationField: 'startAt',
    },
  },
  PageBeanFilterDetails: {
    request: {
      url: '/rest/api/3/filter/search',
      queryParams: {
        expand: 'description,owner,jql,searchUrl,viewUrl,sharePermissions,subscriptions',
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
  FilterDetails: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'columns', fieldType: 'ColumnItem' },
      ],
    },
  },
  PageBeanIssueTypeScheme: {
    request: {
      url: '/rest/api/3/issuetypescheme',
      paginationField: 'startAt',
    },
  },
  PageBeanIssueTypeSchemeMapping: {
    request: {
      url: '/rest/api/3/issuetypescheme/mapping',
      paginationField: 'startAt',
    },
  },
  PageBeanIssueTypeScreenScheme: {
    request: {
      url: '/rest/api/3/issuetypescreenscheme',
      paginationField: 'startAt',
    },
  },
  PageBeanIssueTypeScreenSchemeItem: {
    request: {
      url: '/rest/api/3/issuetypescreenscheme/mapping',
      paginationField: 'startAt',
    },
  },
  PageBeanNotificationScheme: {
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
      // TODO - can we use "standalone fields" to extract the permissions to instances?
      url: '/rest/api/3/permissions',
    },
  },
  PermissionSchemes: {
    request: {
      url: '/rest/api/3/permissionscheme',
      queryParams: {
        expand: 'all',
      },
    },
  },
  ProjectType: {
    transformation: {
      idFields: ['key'],
    },
  },
  PageBeanProject: {
    request: {
      url: '/rest/api/3/project/search',
      queryParams: {
        expand: 'description,lead,issueTypes,url,projectKeys,permissions',
      },
    },
  },
  PageBeanScreen: {
    request: {
      url: '/rest/api/3/screens',
      paginationField: 'startAt',
      recurseInto: [
        {
          type: 'rest__api__3__screens___screenId___tabs@uuuuuuuu_00123_00125uu',
          toField: 'tabs',
          context: [{ name: 'screenId', fromField: 'id' }],
        },
        {
          type: 'rest__api__3__screens___screenId___availableFields@uuuuuuuu_00123_00125uu',
          toField: 'availableFields',
          context: [{ name: 'screenId', fromField: 'id' }],
        },
      ],
    },
  },
  Screen: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'tabs', fieldType: 'list<ScreenableTab>' },
        { fieldName: 'availableFields', fieldType: 'list<ScreenableField>' },
      ],
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
    },
  },
  PageBeanScreenScheme: {
    request: {
      url: '/rest/api/3/screenscheme',
      paginationField: 'startAt',
    },
  },
  // eslint-disable-next-line @typescript-eslint/camelcase
  rest__api__3__status: {
    transformation: {
      dataField: '.',
    },
  },
  PageBeanWorkflow: {
    request: {
      url: '/rest/api/3/workflow/search',
      paginationField: 'startAt',
      queryParams: {
        expand: 'transitions,transitions.rules,statuses,statuses.properties',
      },
    },
  },
  PageBeanWorkflowScheme: {
    request: {
      url: '/rest/api/3/workflowscheme',
      paginationField: 'startAt',
    },
  },
  Labels: {
    // TODO - need to handle this in a filter probably, this currently fetches each page
    // as an instance, it cannot fetch the values because the values are strings
    request: {
      url: '/rest/api/3/label',
      paginationField: 'startAt',
    },
  },

  // Jira API
  'agile__1_0__board@uuvuu': {
    request: {
      url: '/rest/agile/1.0/board',
      paginationField: 'startAt',
      queryParams: {
        expand: 'admins,permissions',
      },
      recurseInto: [
        {
          type: 'agile__1_0__board___boardId___configuration@uuvuuuu_00123_00125uu',
          toField: 'config',
          context: [{ name: 'boardId', fromField: 'id' }],
        },
      ],
    },
  },

  'agile__1_0__board_values@uuvuuu': {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'config', fieldType: 'list<agile__1_0__board___boardId___configuration@uuvuuuu_00123_00125uu>' },
      ],
    },
  },

  'agile__1_0__board___boardId___configuration@uuvuuuu_00123_00125uu': {
    request: {
      url: '/rest/agile/1.0/board/{boardId}/configuration',
    },
  },
}

export const DEFAULT_API_DEFINITIONS: JiraApiConfig = {
  platformSwagger: {
    url: 'https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json',
    typeNameOverrides: [
      {
        originalName: 'PageBeanString',
        newName: 'Labels',
      },
    ],
  },
  jiraSwagger: {
    url: 'https://developer.atlassian.com/cloud/jira/software/swagger.v3.json',
  },
  typeDefaults: {
    transformation: {
      idFields: DEFAULT_ID_FIELDS,
      fieldsToOmit: FIELDS_TO_OMIT,
    },
  },
  types: DEFAULT_TYPE_CUSTOMIZATIONS,
}

export const DEFAULT_INCLUDE_ENDPOINTS: string[] = [
  // platform api
  'rest__api__3__application_properties@uuuuuub', // ApplicationProperty
  'rest__api__3__applicationrole',
  'AttachmentSettings',
  'Configuration',
  'rest__api__3__configuration__timetracking__list', // TimeTrackingProvider
  'PageBeanDashboard',
  'PageBeanField',
  'PageBeanFieldConfiguration',
  'PageBeanFieldConfigurationScheme',
  'PageBeanFieldConfigurationIssueTypeItem',
  'PageBeanFilterDetails',
  'IssueLinkTypes',
  'SecuritySchemes', // TODO - extend support for this (only supported on paid accounts)
  'PageBeanIssueTypeScheme',
  'PageBeanIssueTypeSchemeMapping',
  'PageBeanIssueTypeScreenScheme',
  'PageBeanIssueTypeScreenSchemeItem',
  'PageBeanNotificationScheme',
  'Permissions',
  'PermissionSchemes',
  'rest__api__3__priority',
  'rest__api__3__projectCategory',
  'PageBeanProject',
  'rest__api__3__project__type',
  'rest__api__3__resolution',
  'rest__api__3__role',
  'PageBeanScreen',
  'PageBeanScreenScheme',
  'rest__api__3__settings__columns', // TODO - group these into one element
  'rest__api__3__status',
  'rest__api__3__statuscategory',
  'PageBeanWorkflow',
  'PageBeanWorkflowScheme',
  'Labels',
  'ServerInformation',

  // jira api
  'agile__1_0__board@uuvuu',
]

export type JiraConfig = {
  client?: JiraClientConfig
  fetch: JiraFetchConfig
  apiDefinitions: JiraApiConfig
}

const defaultApiDefinitionsType = createSwaggerAdapterApiConfigType({ adapter: JIRA })

const apiDefinitionsType = createMatchingObjectType<JiraApiConfig>({
  elemID: new ElemID(JIRA, 'apiDefinitions'),
  fields: {
    apiVersion: { type: BuiltinTypes.STRING },
    typeDefaults: {
      type: defaultApiDefinitionsType.fields.typeDefaults.type as ObjectType,
      annotations: { _required: true },
    },
    types: {
      type: defaultApiDefinitionsType.fields.types.type as ObjectType,
      annotations: { _required: true },
    },
    jiraSwagger: {
      type: defaultApiDefinitionsType.fields.swagger.type as ObjectType,
      annotations: { _required: true },
    },
    platformSwagger: {
      type: defaultApiDefinitionsType.fields.swagger.type as ObjectType,
      annotations: { _required: true },
    },
  },
})

export const configType = createMatchingObjectType<JiraConfig>({
  elemID: new ElemID(JIRA),
  fields: {
    client: { type: createClientConfigType(JIRA) },
    fetch: {
      type: createUserFetchConfigType(JIRA),
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.DEFAULT]: {
          includeTypes: DEFAULT_INCLUDE_ENDPOINTS,
        },
      },
    },
    apiDefinitions: {
      type: apiDefinitionsType,
      annotations: {
        _required: true,
        [CORE_ANNOTATIONS.DEFAULT]: DEFAULT_API_DEFINITIONS,
      },
    },
  },
})

export const getApiDefinitions = (config: JiraApiConfig): configUtils.AdapterSwaggerApiConfig[] => {
  const baseConfig = _.omit(config, ['platformSwagger', 'jiraSwagger'])
  return [
    { ...baseConfig, swagger: config.platformSwagger },
    { ...baseConfig, swagger: config.jiraSwagger },
  ]
}

export type FilterContext = Pick<JiraConfig, 'fetch' | 'apiDefinitions'>
