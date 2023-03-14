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
import _ from 'lodash'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ListType, MapType, ObjectType } from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils, elements } from '@salto-io/adapter-components'
import { JIRA } from '../constants'
import { getProductSettings } from '../product_settings'

const { createUserFetchConfigType, createSwaggerAdapterApiConfigType } = configUtils

type JiraClientConfig = clientUtils.ClientBaseConfig<clientUtils.ClientRateLimitConfig>
  & {
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
  types: Record<string, configUtils.TypeConfig & {
    jspRequests?: JspUrls
  }>
  platformSwagger: configUtils.AdapterSwaggerApiConfig['swagger']
  jiraSwagger: configUtils.AdapterSwaggerApiConfig['swagger']
  typesToFallbackToInternalId: string[]
}

type JiraDeployConfig = configUtils.UserDeployConfig & {
  forceDelete: boolean
}

type JiraFetchFilters = {
  name?: string
}

type JiraFetchConfig = configUtils.UserFetchConfig<JiraFetchFilters> & {
  fallbackToInternalId?: boolean
  addTypeToFieldName?: boolean
  convertUsersIds?: boolean
  parseTemplateExpressions?: boolean
  enableScriptRunnerAddon?: boolean
}

export type MaskingConfig = {
  automationHeaders: string[]
  secretRegexps: string[]
}

export type JiraConfig = {
  client: JiraClientConfig
  fetch: JiraFetchConfig
  deploy: JiraDeployConfig
  apiDefinitions: JiraApiConfig
  masking: MaskingConfig
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
  },
  fetch: {
    ...elements.query.INCLUDE_ALL_CONFIG,
    hideTypes: true,
  },
  deploy: {
    forceDelete: false,
  },
  masking: {
    automationHeaders: [],
    secretRegexps: ['xoxb-.*'], // xoxb-.* is Slack token, used by script runner
  },
}

export const getDefaultConfig = ({ isDataCenter }: { isDataCenter: boolean }): JiraConfig => ({
  ...PARTIAL_DEFAULT_CONFIG,
  apiDefinitions: getProductSettings({ isDataCenter }).defaultApiDefinitions,
})

const createClientConfigType = (): ObjectType => {
  const configType = clientUtils.createClientConfigType(JIRA)
  configType.fields.FieldConfigurationItemsDeploymentLimit = new Field(
    configType, 'FieldConfigurationItemsDeploymentLimit', BuiltinTypes.NUMBER
  )
  configType.fields.usePrivateAPI = new Field(
    configType, 'usePrivateAPI', BuiltinTypes.BOOLEAN
  )

  configType.fields.boardColumnRetry = new Field(
    configType, 'boardColumnRetry', BuiltinTypes.NUMBER
  )
  return configType
}

const jiraDeployConfigType = configUtils.createUserDeployConfigType(
  JIRA,
  {
    forceDelete: { refType: BuiltinTypes.BOOLEAN },
  }
)

const fetchFiltersType = createMatchingObjectType<JiraFetchFilters>({
  elemID: new ElemID(JIRA, 'FetchFilters'),
  fields: {
    name: { refType: BuiltinTypes.STRING },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const fetchConfigType = createUserFetchConfigType(
  JIRA,
  {
    fallbackToInternalId: { refType: BuiltinTypes.BOOLEAN },
    addTypeToFieldName: { refType: BuiltinTypes.BOOLEAN },
    showUserDisplayNames: { refType: BuiltinTypes.BOOLEAN },
    enableScriptRunnerAddon: { refType: BuiltinTypes.BOOLEAN },
    // Default is true
    parseTemplateExpressions: { refType: BuiltinTypes.BOOLEAN },
  },
  fetchFiltersType,
)

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

export const configType = createMatchingObjectType<Partial<JiraConfig>>({
  elemID: new ElemID(JIRA),
  fields: {
    client: { refType: createClientConfigType() },
    deploy: { refType: jiraDeployConfigType },
    fetch: { refType: fetchConfigType },
    apiDefinitions: { refType: apiDefinitionsType },
    masking: { refType: maskingConfigType },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(PARTIAL_DEFAULT_CONFIG, ['client', 'masking', 'fetch.hideTypes']),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const getApiDefinitions = (config: JiraApiConfig): {
  platform: configUtils.AdapterSwaggerApiConfig
  jira: configUtils.AdapterSwaggerApiConfig
} => {
  const baseConfig = _.omit(config, ['platformSwagger', 'jiraSwagger'])
  return {
    platform: { ...baseConfig, swagger: config.platformSwagger },
    jira: { ...baseConfig, swagger: config.jiraSwagger },
  }
}
