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
import _ from 'lodash'
import {
  FetchResult,
  AdapterOperations,
  DeployResult,
  InstanceElement,
  isObjectType,
  FetchOptions,
  DeployOptions,
  Change,
  isInstanceChange,
  ElemIdGetter,
  ReadOnlyElementsSource,
  getChangeData,
  isInstanceElement,
  FixElementsFunc,
  TypeMap,
} from '@salto-io/adapter-api'
import {
  elements as elementUtils,
  client as clientUtils,
  combineElementFixers,
  resolveChangeElement,
  fetch as fetchUtils,
  definitions as definitionsUtils,
  openapi,
  restoreChangeElement,
} from '@salto-io/adapter-components'
import { applyFunctionToChangeData, logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, objects } from '@salto-io/lowerdash'
import OktaClient from './client/client'
import changeValidator from './change_validators'
import { CLIENT_CONFIG, FETCH_CONFIG, OLD_API_DEFINITIONS_CONFIG } from './config'
import { configType, getExcludeUserConfigSuggestion, OktaUserConfig, OktaUserFetchConfig } from './user_config'
import fetchCriteria from './fetch_criteria'
import { paginate } from './client/pagination'
import { dependencyChanger } from './dependency_changers'
import { FilterCreator, Filter, filterRunner } from './filter'
import commonFilters from './filters/common'
import fieldReferencesFilter from './filters/field_references'
import defaultDeployFilter from './filters/default_deploy'
import appDeploymentFilter from './filters/app_deployment'
import standardRolesFilter from './filters/standard_roles'
import userTypeFilter from './filters/user_type'
import userSchemaFilter from './filters/user_schema'
import oktaExpressionLanguageFilter from './filters/expression_language'
import accessPolicyRuleConstraintsFilter from './filters/access_policy_rule_constraints'
import defaultPolicyRuleDeployment from './filters/default_rule_deployment'
import appUserSchemaDeploymentFilter from './filters/app_user_schema_deployment'
import authorizationRuleFilter from './filters/authorization_server_rule'
import privateApiDeployFilter from './filters/private_api_deploy'
import profileEnrollmentAttributesFilter from './filters/profile_enrollment_attributes'
import userFilter from './filters/user'
import serviceUrlFilter from './filters/service_url'
import schemaFieldsRemovalFilter from './filters/schema_field_removal'
import appLogoFilter from './filters/app_logo'
import brandThemeAdditionFilter from './filters/brand_theme_addition'
import brandThemeRemovalFilter from './filters/brand_theme_removal'
import brandThemeFilesFilter from './filters/brand_theme_files'
import groupMembersFilter from './filters/group_members'
import unorderedListsFilter from './filters/unordered_lists'
import addAliasFilter from './filters/add_alias'
import profileMappingAdditionFilter from './filters/profile_mapping_addition'
import profileMappingRemovalFilter from './filters/profile_mapping_removal'
import policyPrioritiesFilter from './filters/policy_priority'
import groupPushFilter from './filters/group_push'
import addImportantValues from './filters/add_important_values'
import {
  APP_LOGO_TYPE_NAME,
  BRAND_LOGO_TYPE_NAME,
  FAV_ICON_TYPE_NAME,
  OKTA,
  POLICY_PRIORITY_TYPE_NAMES,
  POLICY_RULE_PRIORITY_TYPE_NAMES,
  USER_TYPE_NAME,
} from './constants'
import { getLookUpNameCreator } from './reference_mapping'
import { User, getUsers, getUsersFromInstances, shouldConvertUserIds } from './user_utils'
import { isClassicEngineOrg } from './utils'
import { createFixElementFunctions } from './fix_elements'
import { CLASSIC_ENGINE_UNSUPPORTED_TYPES, createFetchDefinitions } from './definitions/fetch'
import { PAGINATION } from './definitions/requests/pagination'
import { createClientDefinitions, shouldAccessPrivateAPIs } from './definitions/requests/clients'
import { OktaFetchOptions } from './definitions/types'
import { OPEN_API_DEFINITIONS } from './definitions/sources'
import { getAdminUrl } from './client/admin'

const { awu } = collections.asynciterable
const { generateOpenApiTypes } = openapi
const { createPaginator } = clientUtils
const log = logger(module)

const DEFAULT_FILTERS = [
  standardRolesFilter, // TODO SALTO-5607 - move to infra
  userTypeFilter,
  userSchemaFilter,
  authorizationRuleFilter,
  // should run before fieldReferencesFilter
  userFilter,
  groupPushFilter,
  groupMembersFilter, // TODO SALTO-5607 - move to infra
  oktaExpressionLanguageFilter,
  profileEnrollmentAttributesFilter,
  addImportantValues, // TODO SALTO-5607 - move to infra
  accessPolicyRuleConstraintsFilter,
  defaultPolicyRuleDeployment,
  appUserSchemaDeploymentFilter,
  schemaFieldsRemovalFilter,
  appLogoFilter,
  brandThemeAdditionFilter,
  brandThemeRemovalFilter,
  brandThemeFilesFilter,
  fieldReferencesFilter,
  // should run after fieldReferencesFilter
  policyPrioritiesFilter,
  addAliasFilter, // TODO SALTO-5607 - move to infra
  // should run after fieldReferencesFilter and userFilter
  unorderedListsFilter,
  // should run before appDeploymentFilter and after userSchemaFilter
  serviceUrlFilter,
  appDeploymentFilter,
  profileMappingAdditionFilter,
  profileMappingRemovalFilter,
  // should run after fieldReferences
  ...Object.values(commonFilters),
  // should run last
  privateApiDeployFilter,
  defaultDeployFilter,
]

const SKIP_RESOLVE_TYPE_NAMES = [
  APP_LOGO_TYPE_NAME,
  BRAND_LOGO_TYPE_NAME,
  FAV_ICON_TYPE_NAME,
  ...POLICY_RULE_PRIORITY_TYPE_NAMES,
  ...POLICY_PRIORITY_TYPE_NAMES,
]

export interface OktaAdapterParams {
  filterCreators?: FilterCreator[]
  client: OktaClient
  userConfig: OktaUserConfig
  configInstance?: InstanceElement
  getElemIdFunc?: ElemIdGetter
  elementsSource: ReadOnlyElementsSource
  isOAuthLogin: boolean
  adminClient?: OktaClient
}

/**
 * Temporary adjusment to support migration of User type into the exclude list
 */
const createElementQueryWithUserType = (
  fetchConfig: OktaUserFetchConfig,
  criteria: Record<string, elementUtils.query.QueryCriterion>,
): elementUtils.query.ElementQuery => {
  const isUserExcluded = fetchConfig.exclude.find(fetchEnrty => fetchEnrty.type === USER_TYPE_NAME)
  const isUserIncluded = fetchConfig.include.find(fetchEntry => fetchEntry.type === USER_TYPE_NAME)
  const updatedConfig =
    !isUserExcluded && !isUserIncluded
      ? {
          ...fetchConfig,
          exclude: fetchConfig.exclude.concat({ type: USER_TYPE_NAME }),
        }
      : fetchConfig
  return elementUtils.query.createElementQuery(updatedConfig, criteria)
}

export default class OktaAdapter implements AdapterOperations {
  private createFiltersRunner: (usersPromise?: Promise<User[]>) => Required<Filter>
  private client: OktaClient
  private userConfig: OktaUserConfig
  private configInstance?: InstanceElement
  private paginator: clientUtils.Paginator
  private getElemIdFunc?: ElemIdGetter
  private fetchQuery: elementUtils.query.ElementQuery
  private isOAuthLogin: boolean
  private adminClient?: OktaClient
  private fixElementsFunc: FixElementsFunc
  private definitions: definitionsUtils.RequiredDefinitions<OktaFetchOptions>

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    userConfig,
    configInstance,
    elementsSource,
    isOAuthLogin,
    adminClient,
  }: OktaAdapterParams) {
    this.userConfig = userConfig
    this.configInstance = configInstance
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    this.adminClient = adminClient
    this.isOAuthLogin = isOAuthLogin
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })
    const definitions = {
      // TODO - SALTO-5746 - only provide adminClient when it is defined
      clients: createClientDefinitions({ main: this.client, private: this.adminClient ?? this.client }),
      pagination: PAGINATION,
      fetch: createFetchDefinitions(
        this.userConfig,
        shouldAccessPrivateAPIs(this.isOAuthLogin, this.userConfig),
        getAdminUrl(this.client.baseUrl),
      ),
      sources: { openAPI: [OPEN_API_DEFINITIONS] },
    }

    this.definitions = {
      ...definitions,
      fetch: definitionsUtils.mergeWithUserElemIDDefinitions({
        userElemID: userConfig.fetch.elemID,
        fetchConfig: definitions.fetch,
      }),
    }

    this.fetchQuery = createElementQueryWithUserType(this.userConfig.fetch, fetchCriteria)

    this.paginator = paginator

    this.createFiltersRunner = usersPromise =>
      filterRunner(
        {
          definitions: this.definitions,
          config: this.userConfig,
          getElemIdFunc,
          fetchQuery: this.fetchQuery,
          elementSource: elementsSource,
          oldApiDefinitions: OLD_API_DEFINITIONS_CONFIG,
          usersPromise,
          paginator: this.paginator,
          baseUrl: this.client.baseUrl,
          isOAuthLogin,
          sharedContext: {},
        },
        filterCreators,
        objects.concatObjects,
      )
    this.fixElementsFunc = combineElementFixers(
      createFixElementFunctions({ client, config: this.userConfig, elementsSource, fetchQuery: this.fetchQuery }),
    )
  }

  private async handleClassicEngineOrg(): Promise<definitionsUtils.ConfigChangeSuggestion | undefined> {
    const { isClassicOrg: isClassicOrgByConfig } = this.userConfig[FETCH_CONFIG]
    const isClassicOrg = isClassicOrgByConfig ?? (await isClassicEngineOrg(this.client))
    if (isClassicOrg) {
      const updatedCustomizations = _.omit(
        this.definitions.fetch.instances.customizations,
        CLASSIC_ENGINE_UNSUPPORTED_TYPES,
      )
      this.definitions.fetch.instances.customizations = updatedCustomizations
      return {
        type: 'enableFetchFlag',
        value: 'isClassicOrg',
        reason:
          'We detected that your Okta organization is using the Classic Engine, therefore, certain types of data that are only compatible with newer versions were not fetched.',
      }
    }
    return undefined
  }

  private handleOAuthLogin(): Omit<fetchUtils.FetchElements, 'elements'> {
    if (this.isOAuthLogin && this.userConfig[CLIENT_CONFIG]?.usePrivateAPI) {
      log.warn(
        'Fetching private APIs is not supported for OAuth login, creating config suggestion to exclude private APIs',
      )
      return {
        errors: [
          {
            message:
              'Salto could not access private API when connecting with OAuth. Group Push and Settings types could not be fetched',
            severity: 'Warning',
          },
        ],
        configChanges: [
          { type: 'disablePrivateAPI', reason: 'Private APIs can not be accessed when using OAuth login' },
        ],
      }
    }
    return { errors: [], configChanges: [] }
  }

  @logDuration('generating types from swagger')
  private async getAllSwaggerTypes(): Promise<TypeMap> {
    return _.defaults(
      {},
      ...(await Promise.all(
        collections.array.makeArray(this.definitions.sources?.openAPI).map(def =>
          generateOpenApiTypes({
            adapterName: OKTA,
            openApiDefs: def,
            defQuery: definitionsUtils.queryWithDefault(this.definitions.fetch.instances),
          }),
        ),
      )),
    )
  }

  @logDuration('fetching account configuration')
  async getElements(): Promise<fetchUtils.FetchElements> {
    const typesByTypeName = await this.getAllSwaggerTypes()

    const res = await fetchUtils.getElements({
      adapterName: OKTA,
      fetchQuery: this.fetchQuery,
      definitions: this.definitions,
      getElemIdFunc: this.getElemIdFunc,
      predefinedTypes: _.pickBy(typesByTypeName, isObjectType),
    })
    return res
  }

  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch okta account configuration..')
    progressReporter.reportProgress({ message: 'Fetching elements' })
    const classicOrgConfigSuggestion = await this.handleClassicEngineOrg()
    const { errors: oauthError, configChanges: oauthConfigChange } = this.handleOAuthLogin()
    const { elements, errors, configChanges: getElementsConfigChanges } = await this.getElements()

    const usersPromise = shouldConvertUserIds(this.fetchQuery, this.userConfig)
      ? getUsers(
          this.paginator,
          this.userConfig.fetch.getUsersStrategy === 'searchQuery'
            ? { userIds: getUsersFromInstances(elements.filter(isInstanceElement)), property: 'id' }
            : undefined,
        )
      : undefined

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    const filterResult = (await this.createFiltersRunner(usersPromise).onFetch(elements)) || {}

    const configChanges = (getElementsConfigChanges ?? [])
      .concat(classicOrgConfigSuggestion ?? [])
      .concat(oauthConfigChange ?? [])
      .concat(getExcludeUserConfigSuggestion(this.configInstance) ?? [])
    const updatedConfig =
      !_.isEmpty(configChanges) && this.configInstance
        ? definitionsUtils.getUpdatedConfigFromConfigChanges({
            configChanges,
            currentConfig: this.configInstance,
            configType,
          })
        : undefined
    return {
      elements,
      errors: (errors ?? []).concat(filterResult.errors ?? []).concat(oauthError ?? []),
      updatedConfig,
    }
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const changesToDeploy = await Promise.all(
      changeGroup.changes
        .filter(isInstanceChange)
        .map(change => applyFunctionToChangeData<Change<InstanceElement>>(change, instance => instance.clone())),
    )

    const getLookUpName = getLookUpNameCreator({
      enableMissingReferences: this.userConfig.fetch.enableMissingReferences,
      isUserTypeIncluded: this.fetchQuery.isTypeMatch(USER_TYPE_NAME),
    })

    const resolvedChanges = await awu(changesToDeploy)
      .map(async change =>
        SKIP_RESOLVE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName)
          ? change
          : resolveChangeElement(change, getLookUpName),
      )
      .toArray()
    const runner = this.createFiltersRunner()
    await runner.preDeploy(resolvedChanges)

    const {
      deployResult: { appliedChanges, errors },
    } = await runner.deploy(resolvedChanges)

    const appliedChangesBeforeRestore = [...appliedChanges]
    await runner.onDeploy(appliedChangesBeforeRestore)

    const sourceChanges = _.keyBy(changesToDeploy, change => getChangeData(change).elemID.getFullName())

    const restoredAppliedChanges = await awu(appliedChangesBeforeRestore)
      .map(change => restoreChangeElement(change, sourceChanges, getLookUpName))
      .toArray()

    return {
      appliedChanges: restoredAppliedChanges,
      errors,
    }
  }

  public get deployModifiers(): AdapterOperations['deployModifiers'] {
    return {
      changeValidator: changeValidator({
        client: this.client,
        userConfig: this.userConfig,
        fetchQuery: this.fetchQuery,
        oldApiDefsConfig: OLD_API_DEFINITIONS_CONFIG,
      }),
      dependencyChanger,
    }
  }

  fixElements: FixElementsFunc = elements => this.fixElementsFunc(elements)
}
