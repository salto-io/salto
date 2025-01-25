/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  fetch as fetchUtils,
  definitions as definitionsUtils,
  openapi,
  restoreChangeElement,
  createChangeElementResolver,
} from '@salto-io/adapter-components'
import { ERROR_MESSAGES, logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, objects } from '@salto-io/lowerdash'
import OktaClient from './client/client'
import changeValidator from './change_validators'
import { CLIENT_CONFIG, FETCH_CONFIG, OLD_API_DEFINITIONS_CONFIG } from './config'
import { configType, OktaUserConfig } from './user_config'
import fetchCriteria from './fetch_criteria'
import { paginate } from './client/pagination'
import { dependencyChanger } from './dependency_changers'
import { FilterCreator, Filter, filterRunner } from './filter'
import commonFilters from './filters/common'
import fieldReferencesFilter from './filters/field_references'
import defaultDeployFilter from './filters/default_deploy'
import defaultDeployDefinitionsFilter from './filters/default_deploy_definitions'
import appDeploymentFilter from './filters/app_fetch'
import standardRolesFilter from './filters/standard_roles'
import userSchemaFilter from './filters/user_schema'
import oktaExpressionLanguageFilter from './filters/expression_language'
import accessPolicyRuleConstraintsFilter from './filters/access_policy_rule_constraints'
import defaultPolicyRuleDeployment from './filters/default_rule_deployment'
import appUserSchemaAdditionAndRemovalFilter from './filters/app_user_schema_deployment'
import authorizationRuleFilter from './filters/authorization_server_rule'
import privateApiDeployFilter from './filters/private_api_deploy'
import profileEnrollmentAttributesFilter from './filters/profile_enrollment_attributes'
import userFilter from './filters/user'
import serviceUrlFilter from './filters/service_url'
import schemaDeploymentFilter from './filters/schema_deployment'
import appLogoFilter from './filters/app_logo'
import brandThemeRemovalFilter from './filters/brand_theme_removal'
import brandThemeFilesFilter from './filters/brand_theme_files'
import groupMembersFilter from './filters/group_members'
import removeApplicationGrants from './filters/remove_application_grants'
import unorderedListsFilter from './filters/unordered_lists'
import addAliasFilter from './filters/add_alias'
import profileMappingRemovalFilter from './filters/profile_mapping_removal'
import policyPrioritiesFilter, {
  POLICY_PRIORITY_TYPE_NAMES,
  POLICY_RULE_PRIORITY_TYPE_NAMES,
} from './filters/policy_priority'
import groupPushFilter from './filters/group_push'
import addImportantValues from './filters/add_important_values'
import removedUserRoleAssignments from './filters/removed_user_roles_assignments'
import brandCustomizationsFilter from './filters/brand_customizations'
import { APP_LOGO_TYPE_NAME, BRAND_LOGO_TYPE_NAME, FAV_ICON_TYPE_NAME, OKTA, USER_TYPE_NAME } from './constants'
import { getLookUpNameCreator } from './reference_mapping'
import { User, getUsers, getUsersFromInstances, shouldConvertUserIds } from './user_utils'
import { isClassicEngineOrg, logUsersCount } from './utils'
import { createFixElementFunctions } from './fix_elements'
import { CLASSIC_ENGINE_UNSUPPORTED_TYPES, createFetchDefinitions } from './definitions/fetch'
import { createDeployDefinitions } from './definitions/deploy/deploy'
import { createPaginationDefinitions } from './definitions/requests/pagination'
import { createClientDefinitions, shouldAccessPrivateAPIs } from './definitions/requests/clients'
import { OktaOptions } from './definitions/types'
import { OPEN_API_DEFINITIONS } from './definitions/sources'
import { getAdminUrl } from './client/admin'

const { awu } = collections.asynciterable
const { generateOpenApiTypes } = openapi
const { createPaginator } = clientUtils
const log = logger(module)

const DEFAULT_FILTERS = [
  standardRolesFilter, // TODO SALTO-5607 - move to infra
  userSchemaFilter,
  authorizationRuleFilter,
  // must run before userFilter
  removedUserRoleAssignments,
  // should run before fieldReferencesFilter
  userFilter,
  groupPushFilter,
  groupMembersFilter, // TODO SALTO-5607 - move to infra
  oktaExpressionLanguageFilter,
  profileEnrollmentAttributesFilter,
  addImportantValues, // TODO SALTO-5607 - move to infra
  accessPolicyRuleConstraintsFilter,
  defaultPolicyRuleDeployment,
  appUserSchemaAdditionAndRemovalFilter,
  schemaDeploymentFilter,
  removeApplicationGrants,
  appLogoFilter,
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
  profileMappingRemovalFilter,
  // should run after fieldReferences
  ...Object.values(commonFilters),
  brandCustomizationsFilter, // must run after fieldReferencesFilter and referencedInstanceNames (SALTO-7314) filter
  // should run last
  privateApiDeployFilter,
  defaultDeployFilter,
  // This catches types we moved to the new infra definitions
  defaultDeployDefinitionsFilter,
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
  accountName?: string
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
  private definitions: definitionsUtils.RequiredDefinitions<OktaOptions>
  private accountName?: string
  private elementsSource: ReadOnlyElementsSource

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    userConfig,
    configInstance,
    elementsSource,
    isOAuthLogin,
    adminClient,
    accountName,
  }: OktaAdapterParams) {
    this.userConfig = userConfig
    this.configInstance = configInstance
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    this.adminClient = adminClient
    this.isOAuthLogin = isOAuthLogin
    this.elementsSource = elementsSource
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })
    this.fetchQuery = elementUtils.query.createElementQuery(this.userConfig.fetch, fetchCriteria)
    this.accountName = accountName

    const definitions = {
      // TODO - SALTO-5746 - only provide adminClient when it is defined
      clients: createClientDefinitions({ main: this.client, private: this.adminClient ?? this.client }),
      pagination: createPaginationDefinitions(this.userConfig),
      fetch: createFetchDefinitions({
        userConfig: this.userConfig,
        fetchQuery: this.fetchQuery,
        usePrivateAPI: shouldAccessPrivateAPIs(this.isOAuthLogin, this.userConfig),
        baseUrl: getAdminUrl(this.client.baseUrl),
      }),
      deploy: createDeployDefinitions(),
      sources: { openAPI: [OPEN_API_DEFINITIONS] },
    }

    this.definitions = definitionsUtils.mergeDefinitionsWithOverrides(
      {
        ...definitions,
        fetch: definitionsUtils.mergeWithUserElemIDDefinitions({
          userElemID: userConfig.fetch.elemID,
          fetchConfig: definitions.fetch,
        }),
      },
      this.accountName,
    )

    this.paginator = paginator

    const sharedContext = {}
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
          sharedContext,
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
            message: ERROR_MESSAGES.OTHER_ISSUES,
            detailedMessage:
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

  @logDuration('generating instances and types from service')
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

    await logUsersCount(elements, this.client)
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
    const [instanceChanges, nonInstanceChanges] = _.partition(changeGroup.changes, isInstanceChange)
    if (nonInstanceChanges.length > 0) {
      log.warn(
        `We currently can't deploy types. Therefore, the following changes will not be deployed: ${nonInstanceChanges.map(elem => getChangeData(elem).elemID.getFullName()).join(', ')}`,
      )
    }
    if (instanceChanges.length === 0) {
      log.warn(`no instance changes in group ${changeGroup.groupID}`)
      return {
        appliedChanges: [],
        errors: [],
      }
    }
    if (this.definitions.deploy?.instances === undefined) {
      // not supposed to happen if we didn't fail on a change validator
      const message = 'no deploy definitions found, cannot deploy changes'
      return {
        appliedChanges: [],
        errors: [
          {
            message,
            detailedMessage: message,
            severity: 'Error',
          },
        ],
      }
    }
    const getLookUpName = getLookUpNameCreator({
      enableMissingReferences: this.userConfig.fetch.enableMissingReferences,
      isUserTypeIncluded: this.fetchQuery.isTypeMatch(USER_TYPE_NAME),
    })

    const sourceChanges = _.keyBy(instanceChanges, change => getChangeData(change).elemID.getFullName())
    const runner = this.createFiltersRunner()
    const deployDefQuery = definitionsUtils.queryWithDefault(this.definitions.deploy.instances)
    const changeResolver = createChangeElementResolver({ getLookUpName, elementSource: this.elementsSource })
    const resolvedChanges = await awu(instanceChanges)
      .map(async change =>
        deployDefQuery.query(getChangeData(change).elemID.typeName)?.referenceResolution?.when === 'early' &&
        !SKIP_RESOLVE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName)
          ? changeResolver(change)
          : change,
      )
      .toArray()
    await runner.preDeploy(resolvedChanges)

    const { deployResult } = await runner.deploy(resolvedChanges, changeGroup)
    const appliedChangesBeforeRestore = [...deployResult.appliedChanges]
    await runner.onDeploy(appliedChangesBeforeRestore)

    const appliedChanges = await awu(appliedChangesBeforeRestore)
      .map(change => restoreChangeElement(change, sourceChanges, getLookUpName))
      .toArray()
    return {
      appliedChanges,
      errors: deployResult.errors,
    }
  }

  public get deployModifiers(): AdapterOperations['deployModifiers'] {
    return {
      changeValidator: changeValidator({
        client: this.client,
        userConfig: this.userConfig,
        fetchQuery: this.fetchQuery,
        definitions: this.definitions,
        oldApiDefsConfig: OLD_API_DEFINITIONS_CONFIG,
      }),
      dependencyChanger,
    }
  }

  fixElements: FixElementsFunc = elements => this.fixElementsFunc(elements)
}
