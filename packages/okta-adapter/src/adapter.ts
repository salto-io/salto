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
import { Element, FetchResult, AdapterOperations, DeployResult, InstanceElement, TypeMap, isObjectType, FetchOptions, DeployOptions, Change, isInstanceChange, ElemIdGetter, ReadOnlyElementsSource, getChangeData, ProgressReporter } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData, logDuration, resolveChangeElement, restoreChangeElement } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, objects } from '@salto-io/lowerdash'
import OktaClient from './client/client'
import changeValidator from './change_validators'
import { OktaConfig, API_DEFINITIONS_CONFIG, CLIENT_CONFIG } from './config'
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
import policyRuleRemoval from './filters/policy_rule_removal'
import authorizationRuleFilter from './filters/authorization_server_rule'
import privateApiDeployFilter from './filters/private_api_deploy'
import profileEnrollmentAttributesFilter from './filters/profile_enrollment_attributes'
import deleteFieldsFilter from './filters/delete_fields'
import userFilter from './filters/user'
import serviceUrlFilter from './filters/service_url'
import schemaFieldsRemovalFilter from './filters/schema_field_removal'
import appLogoFilter from './filters/app_logo'
import brandThemeFilesFilter from './filters/brand_theme_files'
import { APP_LOGO_TYPE_NAME, BRAND_LOGO_TYPE_NAME, FAV_ICON_TYPE_NAME, OKTA } from './constants'
import { getLookUpName } from './reference_mapping'


const { awu } = collections.asynciterable

const { generateTypes, getAllInstances } = elementUtils.swagger
const { getAllElements } = elementUtils.ducktype
const { findDataField, computeGetArgs } = elementUtils
const { createPaginator } = clientUtils
const log = logger(module)

export const DEFAULT_FILTERS = [
  standardRolesFilter,
  deleteFieldsFilter,
  userTypeFilter,
  userSchemaFilter,
  authorizationRuleFilter,
  // should run before fieldReferencesFilter
  urlReferencesFilter,
  // should run before fieldReferencesFilter
  replaceObjectWithIdFilter,
  userFilter,
  oktaExpressionLanguageFilter,
  profileEnrollmentAttributesFilter,
  defaultPolicyRuleDeployment,
  policyRuleRemoval,
  schemaFieldsRemovalFilter,
  appLogoFilter,
  brandThemeFilesFilter,
  fieldReferencesFilter,
  // should run before appDeploymentFilter and after userSchemaFilter
  serviceUrlFilter,
  appDeploymentFilter,
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
  getElemIdFunc?: ElemIdGetter
  elementsSource: ReadOnlyElementsSource
  adminClient?: OktaClient
}

export default class OktaAdapter implements AdapterOperations {
  private createFiltersRunner: () => Required<Filter>
  private client: OktaClient
  private userConfig: OktaConfig
  private paginator: clientUtils.Paginator
  private getElemIdFunc?: ElemIdGetter
  private fetchQuery: elementUtils.query.ElementQuery
  private adminClient?: OktaClient

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    config,
    elementsSource,
    adminClient,
  }: OktaAdapterParams) {
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    this.adminClient = adminClient
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
    this.createFiltersRunner = () => (
      filtersRunner(
        {
          client,
          paginator,
          config,
          getElemIdFunc,
          elementsSource,
          fetchQuery: this.fetchQuery,
          adapterContext: filterContext,
          adminClient,
        },
        filterCreators,
        objects.concatObjects
      )
    )
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

    const privateApiElements = await this.getPrivateApiElements()

    const elements = [
      ...Object.values(allTypes),
      ...instances,
      ...privateApiElements.elements,
    ]
    return { elements, errors: (errors ?? []).concat(privateApiElements.errors ?? []) }
  }

  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch okta account configuration..')
    const { elements, errors } = await this.getAllElements(progressReporter)

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    const filterResult = await this.createFiltersRunner().onFetch(elements) || {}

    // TODO SALTO-2690: addDeploymentAnnotations

    return {
      elements,
      errors: (errors ?? []).concat(filterResult.errors ?? []),
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
}
