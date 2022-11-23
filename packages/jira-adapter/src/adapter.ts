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
import _ from 'lodash'
import { FetchResult, AdapterOperations, DeployResult, InstanceElement, TypeMap, isObjectType, FetchOptions, DeployOptions, Change, isInstanceChange, ElemIdGetter, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData, logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { objects } from '@salto-io/lowerdash'
import JiraClient from './client/client'
import changeValidator from './change_validators'
import { JiraConfig, getApiDefinitions } from './config/config'
import { FilterCreator, Filter, filtersRunner } from './filter'
import fieldReferencesFilter from './filters/field_references'
import referenceBySelfLinkFilter from './filters/references_by_self_link'
import removeSelfFilter from './filters/remove_self'
import issueTypeSchemeReferences from './filters/issue_type_schemas/issue_type_scheme_references'
import issueTypeSchemeFilter from './filters/issue_type_schemas/issue_type_scheme'
import sharePermissionFilter from './filters/share_permission'
import sortListsFilter from './filters/sort_lists'
import automationFetchFilter from './filters/automation/automation_fetch'
import automationStructureFilter from './filters/automation/automation_structure'
import boardFilter from './filters/board/board'
import boardColumnsFilter from './filters/board/board_columns'
import boardSubQueryFilter from './filters/board/board_subquery'
import boardEstimationFilter from './filters/board/board_estimation'
import boardDeploymentFilter from './filters/board/board_deployment'
import automationDeploymentFilter from './filters/automation/automation_deployment'
import smartValueReferenceFilter from './filters/automation/smart_values/smart_value_reference_filter'
import webhookFilter from './filters/webhook/webhook'
import screenFilter from './filters/screen/screen'
import issueTypeScreenSchemeFilter from './filters/issue_type_screen_scheme'
import issueTypeFilter from './filters/issue_type'
import fieldConfigurationFilter from './filters/field_configuration/field_configuration'
import fieldConfigurationIrrelevantFields from './filters/field_configuration/field_configuration_irrelevant_fields'
import fieldConfigurationSplitFilter from './filters/field_configuration/field_configuration_split'
import fieldConfigurationItemsFilter from './filters/field_configuration/field_configuration_items'
import missingFieldDescriptionsFilter from './filters/field_configuration/missing_field_descriptions'
import fieldConfigurationDependenciesFilter from './filters/field_configuration/field_configuration_dependencies'
import missingDescriptionsFilter from './filters/missing_descriptions'
import fieldConfigurationSchemeFilter from './filters/field_configurations_scheme'
import dashboardFilter from './filters/dashboard/dashboard_deployment'
import dashboardLayoutFilter from './filters/dashboard/dashboard_layout'
import gadgetFilter from './filters/dashboard/gadget'
import hiddenValuesInListsFilter from './filters/hidden_value_in_lists'
import projectFilter from './filters/project'
import projectComponentFilter from './filters/project_component'
import defaultInstancesDeployFilter from './filters/default_instances_deploy'
import workflowStructureFilter from './filters/workflow/workflow_structure_filter'
import resolutionPropertyFilter from './filters/workflow/resolution_property_filter'
import workflowPropertiesFilter from './filters/workflow/workflow_properties_filter'
import transitionIdsFilter from './filters/workflow/transition_ids_filter'
import workflowDeployFilter from './filters/workflow/workflow_deploy_filter'
import workflowModificationFilter from './filters/workflow/workflow_modification_filter'
import workflowGroupsFilter from './filters/workflow/groups_filter'
import triggersFilter from './filters/workflow/triggers_filter'
import workflowSchemeFilter from './filters/workflow_scheme'
import duplicateIdsFilter from './filters/duplicate_ids'
import unresolvedParentsFilter from './filters/unresolved_parents'
import fieldNameFilter from './filters/fields/field_name_filter'
import accountIdFilter from './filters/account_id/account_id_filter'
import addDisplayNameFilter from './filters/account_id/add_display_name_filter'
import fieldStructureFilter from './filters/fields/field_structure_filter'
import fieldDeploymentFilter from './filters/fields/field_deployment_filter'
import contextDeploymentFilter from './filters/fields/context_deployment_filter'
import fieldTypeReferencesFilter from './filters/fields/field_type_references_filter'
import contextReferencesFilter from './filters/fields/context_references_filter'
import contextsProjectsFilter from './filters/fields/contexts_projects_filter'
import queryFilter from './filters/query'
import serviceUrlInformationFilter from './filters/service_url/service_url_information'
import serviceUrlFilter from './filters/service_url/service_url'
import resolutionFilter from './filters/resolution'
import priorityFilter from './filters/priority'
import statusDeploymentFilter from './filters/statuses/status_deployment'
import securitySchemeFilter from './filters/security_scheme/security_scheme'
import notificationSchemeDeploymentFilter from './filters/notification_scheme/notification_scheme_deployment'
import notificationSchemeStructureFilter from './filters/notification_scheme/notification_scheme_structure'
import forbiddenPermissionSchemeFilter from './filters/permission_scheme/forbidden_permission_schemes'
import wrongUserPermissionSchemeFilter from './filters/permission_scheme/wrong_user_permission_scheme_filter'
import maskingFilter from './filters/masking'
import avatarsFilter from './filters/avatars'
import iconUrlFilter from './filters/icon_url'
import removeEmptyValuesFilter from './filters/remove_empty_values'
import jqlReferencesFilter from './filters/jql/jql_references'
import userFilter from './filters/user'
import { JIRA } from './constants'
import { paginate, removeScopedObjects } from './client/pagination'
import { dependencyChanger } from './dependency_changers'
import { getChangeGroupIds } from './group_change'
import fetchCriteria from './fetch_criteria'
import permissionSchemeFilter from './filters/permission_scheme/sd_portals_permission_scheme'
import allowedPermissionsSchemeFilter from './filters/permission_scheme/allowed_permission_schemes'
import automationLabelFetchFilter from './filters/automation/automation_label/label_fetch'
import automationLabelDeployFilter from './filters/automation/automation_label/label_deployment'
import filtersDcDeployFilter from './filters/data_center/filters_permissions'
import deployDcIssueEventsFilter from './filters/data_center/issue_events'
import { GetIdMapFunc, getIdMapFuncCreator } from './users_map'

const {
  generateTypes,
  getAllInstances,
  loadSwagger,
  addDeploymentAnnotations,
} = elementUtils.swagger

const { createPaginator } = clientUtils
const log = logger(module)

export const DEFAULT_FILTERS = [
  automationLabelFetchFilter,
  automationLabelDeployFilter,
  automationFetchFilter,
  automationStructureFilter,
  automationDeploymentFilter,
  webhookFilter,
  // Should run before duplicateIdsFilter
  fieldNameFilter,
  // This should happen before any filter that creates references
  duplicateIdsFilter,
  fieldStructureFilter,
  // This should run here again because fieldStructureFilter creates the instances and references
  duplicateIdsFilter,
  // This must run after duplicateIdsFilter
  unresolvedParentsFilter,
  contextReferencesFilter,
  fieldTypeReferencesFilter,
  fieldDeploymentFilter,
  contextDeploymentFilter,
  avatarsFilter,
  iconUrlFilter,
  workflowStructureFilter,
  triggersFilter,
  transitionIdsFilter,
  resolutionPropertyFilter,
  workflowPropertiesFilter,
  workflowDeployFilter,
  workflowModificationFilter,
  workflowGroupsFilter,
  workflowSchemeFilter,
  issueTypeFilter,
  issueTypeSchemeReferences,
  issueTypeSchemeFilter,
  sharePermissionFilter,
  boardFilter,
  boardColumnsFilter,
  boardSubQueryFilter,
  boardEstimationFilter,
  boardDeploymentFilter,
  dashboardFilter,
  dashboardLayoutFilter,
  gadgetFilter,
  projectFilter,
  projectComponentFilter,
  screenFilter,
  resolutionFilter,
  priorityFilter,
  statusDeploymentFilter,
  securitySchemeFilter,
  notificationSchemeStructureFilter,
  notificationSchemeDeploymentFilter,
  issueTypeScreenSchemeFilter,
  fieldConfigurationFilter,
  fieldConfigurationItemsFilter,
  fieldConfigurationSchemeFilter,
  userFilter,
  forbiddenPermissionSchemeFilter,
  jqlReferencesFilter,
  removeEmptyValuesFilter,
  maskingFilter,
  referenceBySelfLinkFilter,
  // Must run after referenceBySelfLinkFilter
  removeSelfFilter,
  fieldReferencesFilter,
  // Must run after fieldReferencesFilter
  contextsProjectsFilter,
  fieldConfigurationIrrelevantFields,
  // Must run after fieldConfigurationIrrelevantFields
  fieldConfigurationSplitFilter,
  // Must run after fieldConfigurationSplitFilter
  fieldConfigurationDependenciesFilter,
  missingFieldDescriptionsFilter,
  // Must run after fieldReferencesFilter
  sortListsFilter,
  serviceUrlInformationFilter,
  serviceUrlFilter,
  hiddenValuesInListsFilter,
  queryFilter,
  missingDescriptionsFilter,
  smartValueReferenceFilter,
  permissionSchemeFilter,
  allowedPermissionsSchemeFilter,
  // Must run before account id
  filtersDcDeployFilter,
  // Must run after user filter
  accountIdFilter,
  // Must run after accountIdFilter
  addDisplayNameFilter,
  // Must run after accountIdFilter
  wrongUserPermissionSchemeFilter,
  deployDcIssueEventsFilter,
  // Must be last
  defaultInstancesDeployFilter,
]

export interface JiraAdapterParams {
  filterCreators?: FilterCreator[]
  client: JiraClient
  config: JiraConfig
  getElemIdFunc?: ElemIdGetter
  elementsSource: ReadOnlyElementsSource
}

type AdapterSwaggers = {
  platform: elementUtils.swagger.LoadedSwagger
  jira: elementUtils.swagger.LoadedSwagger
}

export default class JiraAdapter implements AdapterOperations {
  private createFiltersRunner: () => Required<Filter>
  private client: JiraClient
  private userConfig: JiraConfig
  private paginator: clientUtils.Paginator
  private getElemIdFunc?: ElemIdGetter
  private fetchQuery: elementUtils.query.ElementQuery
  private getIdMapFunc: GetIdMapFunc

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    config,
    elementsSource,
  }: JiraAdapterParams) {
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
      customEntryExtractor: removeScopedObjects,
    })

    this.fetchQuery = elementUtils.query.createElementQuery(
      this.userConfig.fetch,
      fetchCriteria,
    )

    this.paginator = paginator
    this.getIdMapFunc = getIdMapFuncCreator(paginator)

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
          getIdMapFunc: this.getIdMapFunc,
        },
        filterCreators,
        objects.concatObjects
      )
    )
  }

  private async generateSwaggers(): Promise<AdapterSwaggers> {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(getApiDefinitions(this.userConfig.apiDefinitions))
          .map(async ([key, config]) => [key, await loadSwagger(config.swagger.url)])
      )
    )
  }

  @logDuration('generating types from swagger')
  private async getAllTypes(swaggers: AdapterSwaggers): Promise<{
    allTypes: TypeMap
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>
  }> {
    const apiDefinitions = getApiDefinitions(this.userConfig.apiDefinitions)
    // Note - this is a temporary way of handling multiple swagger defs in the same adapter
    // this will be replaced by built-in infrastructure support for multiple swagger defs
    // in the configuration
    const results = await Promise.all(
      Object.keys(swaggers).map(
        key => generateTypes(
          JIRA,
          apiDefinitions[key as keyof AdapterSwaggers],
          undefined,
          swaggers[key as keyof AdapterSwaggers]
        )
      )
    )
    return _.merge({}, ...results)
  }

  @logDuration('generating instances from service')
  private async getInstances(
    allTypes: TypeMap,
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>
  ): Promise<InstanceElement[]> {
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

  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch jira account configuration..')
    const swaggers = await this.generateSwaggers()
    progressReporter.reportProgress({ message: 'Fetching types' })
    const { allTypes, parsedConfigs } = await this.getAllTypes(swaggers)
    progressReporter.reportProgress({ message: 'Fetching instances' })
    const instances = await this.getInstances(allTypes, parsedConfigs)

    const elements = [
      ...Object.values(allTypes),
      ...instances,
    ]

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    const filterResult = await this.createFiltersRunner().onFetch(elements) || {}

    // This needs to happen after the onFetch since some filters
    // may add fields that deployment annotation should be added to
    await addDeploymentAnnotations(
      elements.filter(isObjectType),
      Object.values(swaggers),
      this.userConfig.apiDefinitions,
    )

    return filterResult.errors !== undefined
      ? { elements, errors: filterResult.errors }
      : { elements }
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

    const runner = this.createFiltersRunner()
    await runner.preDeploy(changesToDeploy)

    const { deployResult: { appliedChanges, errors } } = await runner.deploy(changesToDeploy)

    const changesToReturn = [...appliedChanges]
    await runner.onDeploy(changesToReturn)

    return {
      appliedChanges: changesToReturn,
      errors,
    }
  }

  get deployModifiers(): AdapterOperations['deployModifiers'] {
    return {
      changeValidator: changeValidator(this.client, this.userConfig, this.getIdMapFunc),
      dependencyChanger,
      getChangeGroupIds,
    }
  }
}
