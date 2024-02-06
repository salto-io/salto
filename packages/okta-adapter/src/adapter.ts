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
import { Element, FetchResult, AdapterOperations, DeployResult, InstanceElement, TypeMap, isObjectType, FetchOptions, DeployOptions, Change, isInstanceChange, ElemIdGetter, ReadOnlyElementsSource, getChangeData, ProgressReporter, isInstanceElement, FixElementsFunc } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils, client as clientUtils, combineElementFixers, fetch as fetchUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData, logDuration, resolveChangeElement, restoreChangeElement } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, objects } from '@salto-io/lowerdash'
import OktaClient from './client/client'
import changeValidator from './change_validators'
import { OktaConfig, API_DEFINITIONS_CONFIG, CLIENT_CONFIG, configType, FETCH_CONFIG, getSupportedTypes } from './config'
import fetchCriteria from './fetch_criteria'
import { paginate } from './client/pagination'
import { dependencyChanger } from './dependency_changers'
import { FilterCreator, Filter, filtersRunner } from './filter'
import commonFilters from './filters/common'
import replaceObjectWithIdFilter from './filters/replace_object_with_id'
import fieldReferencesFilter from './filters/field_references'
import urlReferencesFilter from './filters/url_references'
import defaultDeployFilter from './filters/default_deploy'
import appDeploymentFilter from './filters/app_deployment'
import standardRolesFilter from './filters/standard_roles'
import userTypeFilter from './filters/user_type'
import userSchemaFilter from './filters/user_schema'
import oktaExpressionLanguageFilter from './filters/expression_language'
import defaultPolicyRuleDeployment from './filters/default_rule_deployment'
import authorizationRuleFilter from './filters/authorization_server_rule'
import privateApiDeployFilter from './filters/private_api_deploy'
import profileEnrollmentAttributesFilter from './filters/profile_enrollment_attributes'
import deleteFieldsFilter from './filters/delete_fields'
import userFilter from './filters/user'
import serviceUrlFilter from './filters/service_url'
import schemaFieldsRemovalFilter from './filters/schema_field_removal'
import appLogoFilter from './filters/app_logo'
import brandThemeFilesFilter from './filters/brand_theme_files'
import groupMembersFilter from './filters/group_members'
import unorderedListsFilter from './filters/unordered_lists'
import addAliasFilter from './filters/add_alias'
import profileMappingPropertiesFilter from './filters/profile_mapping_properties'
import profileMappingAdditionFilter from './filters/profile_mapping_addition'
import omitAuthenticatorMappingFilter from './filters/omit_authenticator_mapping'
import groupPushFilter from './filters/group_push'
import addImportantValues from './filters/add_important_values'
import { APP_LOGO_TYPE_NAME, BRAND_LOGO_TYPE_NAME, FAV_ICON_TYPE_NAME, OKTA } from './constants'
import { getLookUpName } from './reference_mapping'
import { User, getUsers, getUsersFromInstances } from './user_utils'
import { isClassicEngineOrg } from './utils'
import { createFixElementFunctions } from './fix_elements'

const { awu } = collections.asynciterable

const { generateTypes, getAllInstances } = elementUtils.swagger
const { getAllElements } = elementUtils.ducktype
const { computeGetArgs } = fetchUtils.resource
const { findDataField } = elementUtils
const { createPaginator } = clientUtils
const log = logger(module)

const DEFAULT_FILTERS = [
  standardRolesFilter,
  deleteFieldsFilter,
  userTypeFilter,
  userSchemaFilter,
  omitAuthenticatorMappingFilter,
  profileMappingPropertiesFilter,
  authorizationRuleFilter,
  // should run before fieldReferencesFilter
  urlReferencesFilter,
  // should run before fieldReferencesFilter
  replaceObjectWithIdFilter,
  userFilter,
  groupMembersFilter,
  groupPushFilter,
  oktaExpressionLanguageFilter,
  profileEnrollmentAttributesFilter,
  addImportantValues,
  defaultPolicyRuleDeployment,
  schemaFieldsRemovalFilter,
  appLogoFilter,
  brandThemeFilesFilter,
  fieldReferencesFilter,
  // should run after fieldReferencesFilter
  addAliasFilter,
  // should run after fieldReferencesFilter
  unorderedListsFilter,
  // should run before appDeploymentFilter and after userSchemaFilter
  serviceUrlFilter,
  appDeploymentFilter,
  profileMappingAdditionFilter,
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
]

export interface OktaAdapterParams {
  filterCreators?: FilterCreator[]
  client: OktaClient
  config: OktaConfig
  configInstance?: InstanceElement
  getElemIdFunc?: ElemIdGetter
  elementsSource: ReadOnlyElementsSource
  isOAuthLogin: boolean
  adminClient?: OktaClient
}

export default class OktaAdapter implements AdapterOperations {
  private createFiltersRunner: (usersPromise?: Promise<User[]>) => Required<Filter>
  private client: OktaClient
  private userConfig: OktaConfig
  private configInstance?: InstanceElement
  private paginator: clientUtils.Paginator
  private getElemIdFunc?: ElemIdGetter
  private fetchQuery: elementUtils.query.ElementQuery
  private isOAuthLogin: boolean
  private adminClient?: OktaClient
  private fixElementsFunc: FixElementsFunc

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    config,
    configInstance,
    elementsSource,
    isOAuthLogin,
    adminClient,
  }: OktaAdapterParams) {
    this.userConfig = config
    this.configInstance = configInstance
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    this.adminClient = adminClient
    this.isOAuthLogin = isOAuthLogin
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })

    this.fetchQuery = elementUtils.query.createElementQuery(
      this.userConfig.fetch,
      fetchCriteria,
    )

    this.paginator = paginator

    const filterContext = {}
    this.createFiltersRunner = usersPromise => (
      filtersRunner(
        {
          client,
          paginator,
          config: this.userConfig,
          getElemIdFunc,
          elementsSource,
          fetchQuery: this.fetchQuery,
          adapterContext: filterContext,
          adminClient,
          usersPromise,
        },
        filterCreators,
        objects.concatObjects
      )
    )
    this.fixElementsFunc = combineElementFixers(createFixElementFunctions({ client, config }))
  }

  @logDuration('generating types from swagger')
  private async getSwaggerTypes(): Promise<{
    allTypes: TypeMap
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>
  }> {
    return generateTypes(
      OKTA,
      this.userConfig[API_DEFINITIONS_CONFIG],
    )
  }

  @logDuration('generating instances from service')
  private async getSwaggerInstances(
    allTypes: TypeMap,
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>
  ): Promise<elementUtils.FetchElements<InstanceElement[]>> {
    const updatedApiDefinitionsConfig = {
      ...this.userConfig.apiDefinitions,
      types: {
        ...parsedConfigs,
        ..._.mapValues(
          this.userConfig.apiDefinitions.types,
          (def, typeName) => ({ ...parsedConfigs[typeName], ...def })
        ),
      },
    }
    return getAllInstances({
      paginator: this.paginator,
      objectTypes: _.pickBy(allTypes, isObjectType),
      apiConfig: updatedApiDefinitionsConfig,
      fetchQuery: this.fetchQuery,
      supportedTypes: this.userConfig.apiDefinitions.supportedTypes,
      getElemIdFunc: this.getElemIdFunc,
    })
  }

  private async getPrivateApiElements(): Promise<elementUtils.FetchElements<Element[]>> {
    const { privateApiDefinitions } = this.userConfig
    if (this.isOAuthLogin && this.userConfig[CLIENT_CONFIG]?.usePrivateAPI) {
      log.warn('Fetching private APIs is not supported for OAuth login, creating config suggestion to exclude private APIs')
      return {
        elements: [],
        errors: [{ message: 'Salto could not access private API when connecting with OAuth. Group Push and Settings types could not be fetched', severity: 'Warning' }],
        configChanges: [{ type: 'disablePrivateAPI', reason: 'Private APIs can not be accessed when using OAuth login' }],
      }
    }
    if (this.adminClient === undefined || this.userConfig[CLIENT_CONFIG]?.usePrivateAPI !== true) {
      return { elements: [] }
    }

    const paginator = createPaginator({
      client: this.adminClient,
      paginationFuncCreator: paginate,
    })

    return getAllElements({
      adapterName: OKTA,
      types: privateApiDefinitions.types,
      shouldAddRemainingTypes: false,
      supportedTypes: privateApiDefinitions.supportedTypes,
      fetchQuery: this.fetchQuery,
      paginator,
      nestedFieldFinder: findDataField,
      computeGetArgs,
      typeDefaults: privateApiDefinitions.typeDefaults,
      getElemIdFunc: this.getElemIdFunc,
    })
  }

  @logDuration('generating instances from service')
  private async getAllElements(
    progressReporter: ProgressReporter
  ): Promise<elementUtils.FetchElements<Element[]>> {
    progressReporter.reportProgress({ message: 'Fetching types' })
    const { allTypes, parsedConfigs } = await this.getSwaggerTypes()
    progressReporter.reportProgress({ message: 'Fetching instances' })
    const { errors, elements: instances } = await this.getSwaggerInstances(allTypes, parsedConfigs)

    const privateApiResult = await this.getPrivateApiElements()

    const elements = [
      ...Object.values(allTypes),
      ...instances,
      ...privateApiResult.elements,
    ]
    return {
      elements,
      errors: (errors ?? []).concat(privateApiResult.errors ?? []),
      configChanges: privateApiResult.configChanges,
    }
  }

  private async handleClassicEngineOrg(): Promise<configUtils.ConfigChangeSuggestion | undefined> {
    const { isClassicOrg: isClassicOrgByConfig } = this.userConfig[FETCH_CONFIG]
    const isClassicOrg = isClassicOrgByConfig ?? await isClassicEngineOrg(this.client)
    if (isClassicOrg) {
      // update supported types to exclude types that are not supported in classic orgs
      this.userConfig[API_DEFINITIONS_CONFIG].supportedTypes = getSupportedTypes({
        isClassicOrg,
        supportedTypes: this.userConfig[API_DEFINITIONS_CONFIG].supportedTypes,
      })
      return {
        type: 'enableFetchFlag',
        value: 'isClassicOrg',
        reason: 'We detected that your Okta organization is using the Classic Engine, therefore, certain types of data that are only compatible with newer versions were not fetched.',
      }
    }
    return undefined
  }

  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch okta account configuration..')
    const { convertUsersIds, getUsersStrategy } = this.userConfig[FETCH_CONFIG]
    const classicOrgConfigSuggestion = await this.handleClassicEngineOrg()
    const { elements, errors, configChanges: getElementsConfigChanges } = await this.getAllElements(progressReporter)

    const usersPromise = convertUsersIds
      ? getUsers(
        this.paginator,
        getUsersStrategy === 'searchQuery'
          ? { userIds: getUsersFromInstances(elements.filter(isInstanceElement)), property: 'id' }
          : undefined
      )
      : undefined

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    const filterResult = await this.createFiltersRunner(usersPromise).onFetch(elements) || {}

    const configChanges = (getElementsConfigChanges ?? []).concat(classicOrgConfigSuggestion ?? [])
    const updatedConfig = !_.isEmpty(configChanges) && this.configInstance
      ? configUtils.getUpdatedCofigFromConfigChanges({
        configChanges,
        currentConfig: this.configInstance,
        configType,
      })
      : undefined
    return {
      elements,
      errors: (errors ?? []).concat(filterResult.errors ?? []),
      updatedConfig,
    }
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const changesToDeploy = await Promise.all(changeGroup.changes
      .filter(isInstanceChange)
      .map(change => applyFunctionToChangeData<Change<InstanceElement>>(
        change,
        instance => instance.clone()
      )))

    const resolvedChanges = await awu(changesToDeploy)
      .map(async change =>
        (SKIP_RESOLVE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName)
          ? change
          : resolveChangeElement(change, getLookUpName))).toArray()
    const runner = this.createFiltersRunner()
    await runner.preDeploy(resolvedChanges)

    const { deployResult: { appliedChanges, errors } } = await runner.deploy(resolvedChanges)

    const appliedChangesBeforeRestore = [...appliedChanges]
    await runner.onDeploy(appliedChangesBeforeRestore)

    const sourceChanges = _.keyBy(
      changesToDeploy,
      change => getChangeData(change).elemID.getFullName(),
    )

    const restoredAppliedChanges = await awu(appliedChangesBeforeRestore)
      .map(change => restoreChangeElement(
        change,
        sourceChanges,
        getLookUpName,
      ))
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
        config: this.userConfig,
      }),
      dependencyChanger,
    }
  }

  fixElements: FixElementsFunc = elements => this.fixElementsFunc(elements)
}
