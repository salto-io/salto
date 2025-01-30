/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ListType, MapType, ObjectType } from '@salto-io/adapter-api'
import { config as configUtils, definitions, elements } from '@salto-io/adapter-components'
import { JIRA, SCRIPT_RUNNER_API_DEFINITIONS, JSM_DUCKTYPE_API_DEFINITIONS, FETCH_CONFIG } from '../constants'
import { getProductSettings } from '../product_settings'
import { JiraDuckTypeConfig } from './api_config'

const { createSwaggerAdapterApiConfigType, createDucktypeAdapterApiConfigType, defaultMissingUserFallbackField } =
  configUtils

type JiraClientConfig = definitions.ClientBaseConfig<definitions.ClientRateLimitConfig> & {
  fieldConfigurationItemsDeploymentLimit: number
  usePrivateAPI: boolean
  boardColumnRetry: number
}

export type JspUrls = {
  add: string
  modify?: string
  remove?: string
  query?: string
  dataField?: string
}

type JiraApiConfig = Omit<configUtils.AdapterSwaggerApiConfig, 'swagger'> & {
  types: Record<
    string,
    configUtils.TypeConfig & {
      jspRequests?: JspUrls
    }
  >
  platformSwagger: configUtils.AdapterSwaggerApiConfig['swagger']
  jiraSwagger: configUtils.AdapterSwaggerApiConfig['swagger']
  typesToFallbackToInternalId: string[]
}

type JiraDeployConfig = definitions.UserDeployConfig &
  definitions.DefaultMissingUserFallbackConfig & {
    forceDelete: boolean
    taskMaxRetries: number
    taskRetryDelay: number
    ignoreMissingExtensions: boolean
  }

type JiraFetchFilters = definitions.DefaultFetchCriteria & {
  type?: string
  state?: string
}

type JiraFetchConfig = definitions.UserFetchConfig<{ fetchCriteria: JiraFetchFilters }> & {
  fallbackToInternalId?: boolean
  addTypeToFieldName?: boolean
  convertUsersIds?: boolean
  parseTemplateExpressions?: boolean
  parseAdditionalAutomationExpressions?: boolean
  enableScriptRunnerAddon?: boolean
  enableJSM?: boolean
  enableJsmExperimental?: boolean
  enableJSMPremium?: boolean
  removeDuplicateProjectRoles?: boolean
  addAlias?: boolean
  enableMissingReferences?: boolean
  enableIssueLayouts?: boolean
  enableNewWorkflowAPI?: boolean
  allowUserCallFailure?: boolean
  enableAssetsObjectFieldConfiguration?: boolean
  automationPageSize?: number
  splitFieldContextOptions?: boolean
  enableRequestTypeFieldNameAlignment?: boolean
  removeFieldConfigurationDefaultValues?: boolean
}

export type MaskingConfig = {
  automationHeaders: string[]
  secretRegexps: string[]
}

export const CUSTOM_REFERENCES_CONFIG = 'customReferences'

export const customReferencesHandlersNames = [
  'automationProjects',
  'fieldConfigurationsHandler',
  'queueFieldsHandler',
  'contextProjectsHandler',
  'fieldContextsHandler',
] as const

export type CustomReferencesHandlers = (typeof customReferencesHandlersNames)[number]

export type JiraCustomReferencesConfig = Record<CustomReferencesHandlers, boolean>

export type JiraConfig = {
  client: JiraClientConfig
  fetch: JiraFetchConfig
  deploy: JiraDeployConfig
  apiDefinitions: JiraApiConfig
  masking: MaskingConfig
  [SCRIPT_RUNNER_API_DEFINITIONS]?: JiraDuckTypeConfig
  [JSM_DUCKTYPE_API_DEFINITIONS]?: JiraDuckTypeConfig
  [CUSTOM_REFERENCES_CONFIG]?: JiraCustomReferencesConfig
}

const jspUrlsType = createMatchingObjectType<Partial<JspUrls>>({
  elemID: new ElemID(JIRA, 'jspUrlsType'),
  fields: {
    add: { refType: BuiltinTypes.STRING },
    modify: { refType: BuiltinTypes.STRING },
    remove: { refType: BuiltinTypes.STRING },
    query: { refType: BuiltinTypes.STRING },
    dataField: { refType: BuiltinTypes.STRING },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const defaultApiDefinitionsType = createSwaggerAdapterApiConfigType({
  adapter: JIRA,
  additionalTypeFields: {
    jspRequests: {
      refType: jspUrlsType,
    },
  },
})

const apiDefinitionsType = createMatchingObjectType<Partial<JiraApiConfig>>({
  elemID: new ElemID(JIRA, 'apiDefinitions'),
  fields: {
    apiVersion: { refType: BuiltinTypes.STRING },
    typeDefaults: {
      refType: defaultApiDefinitionsType.fields.typeDefaults.refType,
    },
    types: {
      refType: defaultApiDefinitionsType.fields.types.refType,
    },
    jiraSwagger: {
      refType: defaultApiDefinitionsType.fields.swagger.refType,
    },
    platformSwagger: {
      refType: defaultApiDefinitionsType.fields.swagger.refType,
    },
    supportedTypes: {
      refType: new MapType(new ListType(BuiltinTypes.STRING)),
    },
    typesToFallbackToInternalId: {
      refType: new ListType(BuiltinTypes.STRING),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const PARTIAL_DEFAULT_CONFIG: Omit<JiraConfig, 'apiDefinitions'> = {
  client: {
    // Jira does not allow more items in a single request than this
    fieldConfigurationItemsDeploymentLimit: 100,
    usePrivateAPI: true,
    boardColumnRetry: 5,
    logging: {
      responseStrategies: [
        { pattern: '^\\/rest\\/greenhopper\\/1.0\\/rapidviewconfig\\/estimation', numItems: 1, strategy: 'omit' },
        { pattern: '^\\/rest\\/agile\\/1.0\\/board/.*\\/configuration', numItems: 50, strategy: 'omit' },
        { pattern: '^\\/rest\\/api\\/2\\/user\\/search', numItems: 10, strategy: 'truncate' },
        { pattern: '^\\/rest\\/gira\\/1', numItems: 10, strategy: 'omit' },
        { pattern: '^\\/rest\\/gira\\/1', numItems: 1, strategy: 'truncate' }, // for truncating the request data
        { size: 100000, strategy: 'truncate' },
      ],
    },
  },
  fetch: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    hideTypes: true,
    enableMissingReferences: true,
    removeDuplicateProjectRoles: true,
    addAlias: true,
    enableIssueLayouts: true,
    enableNewWorkflowAPI: true,
    allowUserCallFailure: false,
    enableAssetsObjectFieldConfiguration: true,
    removeFieldConfigurationDefaultValues: false,
    splitFieldContextOptions: true,
  },
  deploy: {
    forceDelete: false,
    taskMaxRetries: 180,
    taskRetryDelay: 1000,
    ignoreMissingExtensions: false,
  },
  masking: {
    automationHeaders: ['Authorization', 'x-api-key'],
    secretRegexps: ['xoxb-.*'], // xoxb-.* is Slack token, used by script runner
  },
}

const getPartialDefaultConfig = (isDataCenter: boolean): Omit<JiraConfig, 'apiDefinitions'> => ({
  ...PARTIAL_DEFAULT_CONFIG,
  fetch: {
    ...PARTIAL_DEFAULT_CONFIG.fetch,
    enableNewWorkflowAPI: !isDataCenter,
  },
})

export const getDefaultConfig = ({ isDataCenter }: { isDataCenter: boolean }): JiraConfig => ({
  ...getPartialDefaultConfig(isDataCenter),
  apiDefinitions: getProductSettings({ isDataCenter }).defaultApiDefinitions,
  [SCRIPT_RUNNER_API_DEFINITIONS]: getProductSettings({ isDataCenter }).defaultScriptRunnerApiDefinitions,
  [JSM_DUCKTYPE_API_DEFINITIONS]: getProductSettings({ isDataCenter }).defaultDuckTypeApiDefinitions,
})

const createClientConfigType = (): ObjectType => {
  const configType = definitions.createClientConfigType({ adapter: JIRA })
  configType.fields.FieldConfigurationItemsDeploymentLimit = new Field(
    configType,
    'FieldConfigurationItemsDeploymentLimit',
    BuiltinTypes.NUMBER,
  )
  configType.fields.usePrivateAPI = new Field(configType, 'usePrivateAPI', BuiltinTypes.BOOLEAN)

  configType.fields.boardColumnRetry = new Field(configType, 'boardColumnRetry', BuiltinTypes.NUMBER)
  return configType
}

const CHANGE_VALIDATOR_NAMES = [
  'unresolvedReference',
  'brokenReferences',
  'deployTypesNotSupported',
  'readOnlyProjectRoleChange',
  'defaultFieldConfiguration',
  'fieldConfigurationDescriptionLength',
  'fieldConfigurationItemDescriptionLength',
  'screen',
  'issueTypeScheme',
  'issueTypeSchemeDefaultType',
  'teamManagedProject',
  'projectDeletion',
  'status',
  'privateApi',
  'emptyValidatorWorkflowChange',
  'readOnlyWorkflow',
  'dashboardGadgets',
  'referencedWorkflowDeletion',
  'dashboardLayout',
  'issueLayouts',
  'permissionType',
  'automations',
  'activeSchemeDeletion',
  'statusMigrationChange',
  'workflowSchemeMigration',
  'workflowStatusMappings',
  'inboundTransition',
  'issueTypeSchemeMigration',
  'missingExtensionsTransitionRules',
  'activeSchemeChange',
  'masking',
  'issueTypeDeletion',
  'lockedFields',
  'fieldContext',
  'fieldSecondGlobalContext',
  'systemFields',
  'workflowProperties',
  'permissionScheme',
  'screenSchemeDefault',
  'wrongUserPermissionScheme',
  'accountId',
  'workflowSchemeDups',
  'workflowTransitionDuplicateName',
  'permissionSchemeDeployment',
  'projectCategory',
  'customFieldsWith10KOptions',
  'issueTypeHierarchy',
  'automationProjects',
  'deleteLastQueueValidator',
  'defaultAdditionQueueValidator',
  'defaultAttributeValidator',
  'boardColumnConfig',
  'automationToAssets',
  'addJsmProject',
  'deleteLabelAtttribute',
  'jsmPermissions',
  'fieldContextOptions',
  'uniqueFields',
  'assetsObjectFieldConfigurationAql',
  'projectAssigneeType',
  'fieldContextDefaultValue',
  'fieldContextOrderRemoval',
  'optionValue',
  'enhancedSearchDeployment',
  'fieldContext',
  'emptyProjectScopedContext',
  'filter',
  'kanbanBoardBacklog',
  'globalTransition',
  'htmlBodyContentAction',
  'automationIssueType',
]

export type ChangeValidatorName = (typeof CHANGE_VALIDATOR_NAMES)[number]

const changeValidatorConfigType = definitions.createChangeValidatorConfigType({
  adapterName: JIRA,
  changeValidatorNames: CHANGE_VALIDATOR_NAMES,
})

const jiraDeployConfigType = definitions.createUserDeployConfigType(JIRA, changeValidatorConfigType, {
  ...defaultMissingUserFallbackField,
  taskMaxRetries: { refType: BuiltinTypes.NUMBER },
  taskRetryDelay: { refType: BuiltinTypes.NUMBER },
  forceDelete: { refType: BuiltinTypes.BOOLEAN },
  ignoreMissingExtensions: { refType: BuiltinTypes.BOOLEAN },
})

const fetchFiltersType = createMatchingObjectType<JiraFetchFilters>({
  elemID: new ElemID(JIRA, 'FetchFilters'),
  fields: {
    name: { refType: BuiltinTypes.STRING },
    type: { refType: BuiltinTypes.STRING },
    state: { refType: BuiltinTypes.STRING },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const fetchConfigType = definitions.createUserFetchConfigType({
  adapterName: JIRA,
  additionalFields: {
    fallbackToInternalId: { refType: BuiltinTypes.BOOLEAN },
    addTypeToFieldName: { refType: BuiltinTypes.BOOLEAN },
    showUserDisplayNames: { refType: BuiltinTypes.BOOLEAN },
    enableScriptRunnerAddon: { refType: BuiltinTypes.BOOLEAN },
    enableJSM: { refType: BuiltinTypes.BOOLEAN },
    enableJsmExperimental: { refType: BuiltinTypes.BOOLEAN },
    enableJSMPremium: { refType: BuiltinTypes.BOOLEAN },
    removeDuplicateProjectRoles: { refType: BuiltinTypes.BOOLEAN },
    allowUserCallFailure: { refType: BuiltinTypes.BOOLEAN },
    // Default is true
    parseTemplateExpressions: { refType: BuiltinTypes.BOOLEAN },
    parseAdditionalAutomationExpressions: { refType: BuiltinTypes.BOOLEAN },
    addAlias: { refType: BuiltinTypes.BOOLEAN },
    enableMissingReferences: { refType: BuiltinTypes.BOOLEAN },
    enableIssueLayouts: { refType: BuiltinTypes.BOOLEAN },
    enableNewWorkflowAPI: { refType: BuiltinTypes.BOOLEAN },
    enableAssetsObjectFieldConfiguration: { refType: BuiltinTypes.BOOLEAN },
    automationPageSize: { refType: BuiltinTypes.NUMBER },
    splitFieldContextOptions: { refType: BuiltinTypes.BOOLEAN },
    enableRequestTypeFieldNameAlignment: { refType: BuiltinTypes.BOOLEAN },
    removeFieldConfigurationDefaultValues: { refType: BuiltinTypes.BOOLEAN },
  },
  fetchCriteriaType: fetchFiltersType,
  omitElemID: true,
})

const maskingConfigType = createMatchingObjectType<Partial<MaskingConfig>>({
  elemID: new ElemID(JIRA, 'MaskingConfig'),
  fields: {
    automationHeaders: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    secretRegexps: {
      refType: new ListType(BuiltinTypes.STRING),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const customReferencesConfigType = createMatchingObjectType<Partial<JiraCustomReferencesConfig>>({
  elemID: new ElemID(JIRA, 'customReferencesConfig'),
  fields: {
    automationProjects: { refType: BuiltinTypes.BOOLEAN },
    fieldConfigurationsHandler: { refType: BuiltinTypes.BOOLEAN },
    queueFieldsHandler: { refType: BuiltinTypes.BOOLEAN },
    contextProjectsHandler: { refType: BuiltinTypes.BOOLEAN },
    fieldContextsHandler: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const configType = createMatchingObjectType<Partial<JiraConfig>>({
  elemID: new ElemID(JIRA),
  fields: {
    client: { refType: createClientConfigType() },
    deploy: { refType: jiraDeployConfigType },
    fetch: { refType: fetchConfigType },
    apiDefinitions: { refType: apiDefinitionsType },
    masking: { refType: maskingConfigType },
    [SCRIPT_RUNNER_API_DEFINITIONS]: {
      refType: createDucktypeAdapterApiConfigType({
        adapter: JIRA,
        elemIdPrefix: 'ducktype',
      }),
    },
    [JSM_DUCKTYPE_API_DEFINITIONS]: {
      refType: createDucktypeAdapterApiConfigType({
        adapter: JIRA,
        elemIdPrefix: 'ducktype',
      }),
    },
    [CUSTOM_REFERENCES_CONFIG]: { refType: customReferencesConfigType },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(PARTIAL_DEFAULT_CONFIG, [
      'client',
      'masking',
      'fetch.hideTypes',
      'fetch.enableMissingReferences',
      'fetch.addAlias',
      'fetch.enableIssueLayouts',
      'fetch.removeDuplicateProjectRoles',
      'fetch.enableNewWorkflowAPI',
      'fetch.allowUserCallFailure',
      'fetch.enableAssetsObjectFieldConfiguration',
      'fetch.automationPageSize',
      'fetch.parseAdditionalAutomationExpressions',
      'fetch.enableRequestTypeFieldNameAlignment',
      'fetch.removeFieldConfigurationDefaultValues',
      'deploy.taskMaxRetries',
      'deploy.taskRetryDelay',
      'deploy.ignoreMissingExtensions',
      SCRIPT_RUNNER_API_DEFINITIONS,
      JSM_DUCKTYPE_API_DEFINITIONS,
      CUSTOM_REFERENCES_CONFIG,
    ]),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const getApiDefinitions = (
  config: JiraApiConfig,
): {
  platform: configUtils.AdapterSwaggerApiConfig
  jira: configUtils.AdapterSwaggerApiConfig
} => {
  const baseConfig = _.omit(config, ['platformSwagger', 'jiraSwagger'])
  return {
    platform: { ...baseConfig, swagger: config.platformSwagger },
    jira: { ...baseConfig, swagger: config.jiraSwagger },
  }
}

export const validateJiraFetchConfig = ({
  fetchConfig,
  apiDefinitions,
  scriptRunnerApiDefinitions,
  jsmApiDefinitions,
}: {
  fetchConfig: JiraFetchConfig
  apiDefinitions: JiraApiConfig
  scriptRunnerApiDefinitions?: JiraDuckTypeConfig
  jsmApiDefinitions: JiraDuckTypeConfig
}): void => {
  const jsmSupportedTypes = fetchConfig.enableJSM ? Object.keys(jsmApiDefinitions.supportedTypes) : []
  const scriptRunnerSupportedTypes =
    fetchConfig.enableScriptRunnerAddon && scriptRunnerApiDefinitions !== undefined
      ? Object.keys(scriptRunnerApiDefinitions.supportedTypes)
      : []
  const supportedTypes = Object.keys(apiDefinitions.supportedTypes)
    .concat(jsmSupportedTypes)
    .concat(scriptRunnerSupportedTypes)

  configUtils.validateSupportedTypes(FETCH_CONFIG, fetchConfig, supportedTypes)
}
