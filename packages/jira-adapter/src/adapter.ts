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
import { Element, FetchResult, AdapterOperations, DeployResult, InstanceElement, TypeMap, isObjectType, FetchOptions, DeployOptions, Change, isInstanceChange, ElemIdGetter, ReadOnlyElementsSource, ProgressReporter, FixElementsFunc, isInstanceElement } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils, client as clientUtils, combineElementFixers, fetch as fetchUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData, getElemIdFuncWrapper, logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { objects, collections } from '@salto-io/lowerdash'
import JiraClient from './client/client'
import changeValidator from './change_validators'
import { JiraConfig, configType, getApiDefinitions } from './config/config'
import { FilterCreator, Filter, filtersRunner } from './filter'
import localeFilter from './filters/locale'
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
import brokenReferences from './filters/broken_reference_filter'
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
import replaceFieldConfigurationReferences from './filters/field_configuration/replace_field_configuration_references'
import fieldConfigurationDeployment from './filters/field_configuration/field_configuration_deployment'
import missingDescriptionsFilter from './filters/missing_descriptions'
import fieldConfigurationSchemeFilter from './filters/field_configurations_scheme'
import dashboardFilter from './filters/dashboard/dashboard_deployment'
import dashboardLayoutFilter from './filters/dashboard/dashboard_layout'
import gadgetFilter from './filters/dashboard/gadget'
import gadgetPropertiesFilter from './filters/dashboard/gadget_properties'
import hiddenValuesInListsFilter from './filters/hidden_value_in_lists'
import projectFilter from './filters/project'
import projectComponentFilter from './filters/project_component'
import archivedProjectComponentsFilter from './filters/archived_project_components'
import defaultInstancesDeployFilter from './filters/default_instances_deploy'
import workflowFilter from './filters/workflowV2/workflow_filter'
import workflowStructureFilter from './filters/workflow/workflow_structure_filter'
import workflowDiagramFilter from './filters/workflow/workflow_diagrams'
import resolutionPropertyFilter from './filters/workflow/resolution_property_filter'
import workflowPropertiesFilter from './filters/workflow/workflow_properties_filter'
import transitionIdsFilter from './filters/workflow/transition_ids_filter'
import workflowDeployFilter from './filters/workflow/workflow_deploy_filter'
import workflowModificationFilter from './filters/workflow/workflow_modification_filter'
import emptyValidatorWorkflowFilter from './filters/workflow/empty_validator_workflow'
import workflowGroupsFilter from './filters/workflow/groups_filter'
import triggersFilter from './filters/workflow/triggers_filter'
import workflowSchemeFilter from './filters/workflow_scheme'
import duplicateIdsFilter from './filters/duplicate_ids'
import unresolvedParentsFilter from './filters/unresolved_parents'
import fieldNameFilter from './filters/fields/field_name_filter'
import accountIdFilter from './filters/account_id/account_id_filter'
import userFallbackFilter from './filters/account_id/user_fallback_filter'
import userIdFilter from './filters/account_id/user_id_filter'
import fieldStructureFilter from './filters/fields/field_structure_filter'
import fieldDeploymentFilter from './filters/fields/field_deployment_filter'
import contextDeploymentFilter from './filters/fields/context_deployment_filter'
import fieldTypeReferencesFilter from './filters/fields/field_type_references_filter'
import contextReferencesFilter from './filters/fields/context_references_filter'
import contextsProjectsFilter from './filters/fields/contexts_projects_filter'
import serviceUrlInformationFilter from './filters/service_url/service_url_information'
import serviceUrlFilter from './filters/service_url/service_url'
import serviceUrlJsmFilter from './filters/service_url/service_url_jsm'
import priorityFilter from './filters/priority'
import statusDeploymentFilter from './filters/statuses/status_deployment'
import securitySchemeFilter from './filters/security_scheme/security_scheme'
import groupNameFilter from './filters/group_name'
import notificationSchemeDeploymentFilter from './filters/notification_scheme/notification_scheme_deployment'
import notificationSchemeStructureFilter from './filters/notification_scheme/notification_scheme_structure'
import forbiddenPermissionSchemeFilter from './filters/permission_scheme/forbidden_permission_schemes'
import wrongUserPermissionSchemeFilter from './filters/permission_scheme/wrong_user_permission_scheme_filter'
import maskingFilter from './filters/masking'
import avatarsFilter from './filters/avatars'
import iconUrlFilter from './filters/icon_url'
import filtersFilter from './filters/filter'
import removeEmptyValuesFilter from './filters/remove_empty_values'
import jqlReferencesFilter from './filters/jql/jql_references'
import userFilter from './filters/user'
import changePortalGroupFieldsFilter from './filters/change_portal_group_fields'
import { JIRA, PROJECT_TYPE, SERVICE_DESK } from './constants'
import { paginate, removeScopedObjects } from './client/pagination'
import { dependencyChanger } from './dependency_changers'
import { getChangeGroupIds } from './group_change'
import fetchCriteria from './fetch_criteria'
import permissionSchemeFilter from './filters/permission_scheme/sd_portals_permission_scheme'
import allowedPermissionsSchemeFilter from './filters/permission_scheme/allowed_permission_schemes'
import automationLabelFetchFilter from './filters/automation/automation_label/label_fetch'
import automationLabelDeployFilter from './filters/automation/automation_label/label_deployment'
import deployDcIssueEventsFilter from './filters/data_center/issue_events'
import requestTypelayoutsToValuesFilter from './filters/layouts/request_types_layouts_to_values'
import prioritySchemeFetchFilter from './filters/data_center/priority_scheme/priority_scheme_fetch'
import prioritySchemeDeployFilter from './filters/data_center/priority_scheme/priority_scheme_deploy'
import requestTypeLayoutsFilter from './filters/layouts/request_type_request_form'
import prioritySchemeProjectAssociationFilter from './filters/data_center/priority_scheme/priority_scheme_project_association'
import { GetUserMapFunc, getUserMapFuncCreator } from './users'
import commonFilters from './filters/common'
import accountInfoFilter from './filters/account_info'
import requestTypeFilter from './filters/request_type'
import deployPermissionSchemeFilter from './filters/permission_scheme/deploy_permission_scheme_filter'
import scriptRunnerWorkflowFilter from './filters/script_runner/workflow/workflow_filter'
import pluginVersionFliter from './filters/data_center/plugin_version'
import scriptRunnerWorkflowListsFilter from './filters/script_runner/workflow/workflow_lists_parsing'
import scriptRunnerWorkflowReferencesFilter from './filters/script_runner/workflow/workflow_references'
import scriptRunnerTemplateExpressionFilter from './filters/script_runner/script_template_expressions'
import scriptRunnerEmptyAccountIdsFilter from './filters/script_runner/workflow/empty_account_ids'
import storeUsersFilter from './filters/store_users'
import projectCategoryFilter from './filters/project_category'
import addAliasFilter from './filters/add_alias'
import projectRoleRemoveTeamManagedDuplicatesFilter from './filters/remove_specific_duplicate_roles'
import issueLayoutFilter from './filters/layouts/issue_layout'
import removeSimpleFieldProjectFilter from './filters/remove_simplified_field_project'
import changeJSMElementsFieldFilter from './filters/change_jsm_fields'
import formsFilter from './filters/forms/forms'
import addJsmTypesAsFieldsFilter from './filters/add_jsm_types_as_fields'
import createReferencesIssueLayoutFilter from './filters/layouts/create_references_layouts'
import issueTypeHierarchyFilter from './filters/issue_type_hierarchy_filter'
import projectFieldContextOrder from './filters/project_field_contexts_order'
import scriptedFieldsIssueTypesFilter from './filters/script_runner/scripted_fields_issue_types'
import scriptRunnerFilter from './filters/script_runner/script_runner_filter'
import scriptRunnerListenersDeployFilter from './filters/script_runner/script_runner_listeners_deploy'
import scriptedFragmentsDeployFilter from './filters/script_runner/scripted_fragments_deploy'
import fetchJsmTypesFilter from './filters/jsm_types_fetch_filter'
import assetsInstancesDeploymentFilter from './filters/assets/assets_instances_deployment'
import deployAttributesFilter from './filters/assets/attribute_deploy_filter'
import deployJsmTypesFilter from './filters/jsm_types_deploy_filter'
import jsmPathFilter from './filters/jsm_paths'
import portalSettingsFilter from './filters/portal_settings'
import queueDeploymentFilter from './filters/queue_deployment'
import scriptRunnerInstancesDeploy from './filters/script_runner/script_runner_instances_deploy'
import behaviorsMappingsFilter from './filters/script_runner/behaviors_mappings'
import behaviorsFieldUuidFilter from './filters/script_runner/behaviors_field_uuid'
import queueFetchFilter from './filters/queue_fetch'
import portalGroupsFilter from './filters/portal_groups'
import assetsObjectTypePath from './filters/assets/assets_object_type_path'
import assetsObjectTypeChangeFields from './filters/assets/assets_object_type_change_fields'
import assetsObjectTypeOrderFilter from './filters/assets/assets_object_type_order'
import defaultAttributesFilter from './filters/assets/label_object_type_attribute'
import changeAttributesPathFilter from './filters/assets/change_attributes_path'
import ScriptRunnerClient from './client/script_runner_client'
import { weakReferenceHandlers } from './weak_references'
import { jiraJSMAssetsEntriesFunc, jiraJSMEntriesFunc } from './jsm_utils'
import { hasSoftwareProject } from './utils'
import { getWorkspaceId } from './workspace_id'
import { JSM_ASSETS_DUCKTYPE_SUPPORTED_TYPES } from './config/api_config'

const { getAllElements } = elementUtils.ducktype
const { findDataField } = elementUtils
const { computeGetArgs } = fetchUtils.resource
const {
  generateTypes,
  getAllInstances,
  loadSwagger,
  addDeploymentAnnotations,
} = elementUtils.swagger
const { createPaginator, getWithCursorPagination } = clientUtils
const log = logger(module)

const { query: queryFilter, hideTypes: hideTypesFilter, ...otherCommonFilters } = commonFilters
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

export const DEFAULT_FILTERS = [
  accountInfoFilter,
  storeUsersFilter,
  changeJSMElementsFieldFilter,
  queueFetchFilter,
  changePortalGroupFieldsFilter,
  automationLabelFetchFilter,
  automationLabelDeployFilter,
  automationFetchFilter,
  automationStructureFilter,
  // Should run before automationDeploymentFilter
  brokenReferences,
  automationDeploymentFilter,
  webhookFilter,
  // Should run before duplicateIdsFilter
  fieldNameFilter,
  workflowStructureFilter,
  workflowFilter,
  // must run before references are transformed and after workflowFilter
  queryFilter,
  // This should run before duplicateIdsFilter
  projectRoleRemoveTeamManagedDuplicatesFilter,
  // This should happen before any filter that creates references
  duplicateIdsFilter,
  fieldStructureFilter,
  // This should run here again because fieldStructureFilter creates the instances and references
  duplicateIdsFilter,
  // This must run after duplicateIdsFilter
  unresolvedParentsFilter,
  localeFilter,
  contextReferencesFilter,
  fieldTypeReferencesFilter,
  fieldDeploymentFilter,
  contextDeploymentFilter,
  avatarsFilter,
  iconUrlFilter,
  triggersFilter,
  resolutionPropertyFilter,
  scriptRunnerFilter,
  // must run before references are transformed
  scriptedFieldsIssueTypesFilter,
  behaviorsMappingsFilter,
  behaviorsFieldUuidFilter,
  scriptRunnerWorkflowFilter,
  // must run after scriptRunnerWorkflowFilter
  scriptRunnerWorkflowListsFilter,
  scriptRunnerTemplateExpressionFilter,
  scriptRunnerEmptyAccountIdsFilter,
  // resolves references in workflow instances!
  workflowPropertiesFilter,
  // must run after scriptRunnerWorkflowListsFilter and workflowPropertiesFilter
  scriptRunnerWorkflowReferencesFilter,
  transitionIdsFilter,
  workflowDeployFilter,
  workflowModificationFilter,
  emptyValidatorWorkflowFilter,
  groupNameFilter,
  workflowGroupsFilter,
  workflowSchemeFilter,
  workflowDiagramFilter,
  issueTypeFilter,
  issueTypeSchemeReferences,
  issueTypeSchemeFilter,
  prioritySchemeFetchFilter,
  prioritySchemeDeployFilter,
  prioritySchemeProjectAssociationFilter,
  sharePermissionFilter,
  boardFilter,
  boardColumnsFilter,
  boardSubQueryFilter,
  boardEstimationFilter,
  boardDeploymentFilter,
  dashboardFilter,
  dashboardLayoutFilter,
  gadgetFilter,
  gadgetPropertiesFilter,
  projectCategoryFilter,
  projectFilter,
  projectComponentFilter,
  archivedProjectComponentsFilter,
  screenFilter,
  priorityFilter,
  statusDeploymentFilter,
  securitySchemeFilter,
  notificationSchemeStructureFilter,
  notificationSchemeDeploymentFilter,
  issueTypeScreenSchemeFilter,
  issueTypeHierarchyFilter,
  fieldConfigurationFilter,
  fieldConfigurationItemsFilter,
  fieldConfigurationSchemeFilter,
  userFilter,
  forbiddenPermissionSchemeFilter,
  jqlReferencesFilter,
  removeEmptyValuesFilter,
  maskingFilter,
  pluginVersionFliter,
  referenceBySelfLinkFilter,
  // Must run after referenceBySelfLinkFilter
  removeSelfFilter,
  formsFilter,
  serviceUrlJsmFilter, // Must run before fieldReferencesFilter
  fieldReferencesFilter,
  // Must run after fieldReferencesFilter
  addJsmTypesAsFieldsFilter,
  issueLayoutFilter,
  fetchJsmTypesFilter,
  assetsObjectTypeChangeFields,
  // Must run after issueLayoutFilter
  removeSimpleFieldProjectFilter,
  requestTypeLayoutsFilter,
  createReferencesIssueLayoutFilter,
  // Must run after createReferencesIssueLayoutFilter
  requestTypelayoutsToValuesFilter,
  // Must run after fieldReferencesFilter
  contextsProjectsFilter,
  // must run after contextsProjectsFilter
  projectFieldContextOrder,
  fieldConfigurationIrrelevantFields,
  // Must run after fieldConfigurationIrrelevantFields
  fieldConfigurationSplitFilter,
  // Must run after fieldReferencesFilter
  replaceFieldConfigurationReferences,
  fieldConfigurationDeployment,
  // Must run after fieldConfigurationSplitFilter
  fieldConfigurationDependenciesFilter,
  missingFieldDescriptionsFilter,
  // Must run after fieldReferencesFilter
  sortListsFilter,
  serviceUrlInformationFilter,
  serviceUrlFilter,
  filtersFilter,
  hiddenValuesInListsFilter,
  missingDescriptionsFilter,
  smartValueReferenceFilter,
  permissionSchemeFilter,
  allowedPermissionsSchemeFilter,
  deployPermissionSchemeFilter,
  // Must run after user filter
  accountIdFilter,
  // Must run after accountIdFilter
  userIdFilter,
  // Must run after accountIdFilter
  userFallbackFilter,
  // Must run after accountIdFilter
  wrongUserPermissionSchemeFilter,
  deployDcIssueEventsFilter,
  addAliasFilter,
  // must be done before scriptRunnerInstances
  scriptRunnerListenersDeployFilter,
  // must be done before scriptRunnerInstances
  scriptedFragmentsDeployFilter,
  scriptRunnerInstancesDeploy,
  portalSettingsFilter,
  queueDeploymentFilter,
  portalGroupsFilter,
  requestTypeFilter,
  // Must run before asstesDeployFilter
  assetsInstancesDeploymentFilter,
  // Must be done after JsmTypesFilter
  jsmPathFilter,
  ...Object.values(otherCommonFilters),
  // Must run after otherCommonFilters and specificly after referencedInstanceNamesFilterCreator.
  assetsObjectTypePath,
  // Must run after assetsObjectTypePath
  changeAttributesPathFilter,
  defaultAttributesFilter,
  assetsObjectTypeOrderFilter,
  deployAttributesFilter,
  deployJsmTypesFilter,
  hideTypesFilter, // Must run after defaultAttributesFilter and assetsObjectTypeOrderFilter, which also create types.
  // Must be last
  defaultInstancesDeployFilter,
]

export interface JiraAdapterParams {
  filterCreators?: FilterCreator[]
  client: JiraClient
  scriptRunnerClient: ScriptRunnerClient
  config: JiraConfig
  getElemIdFunc?: ElemIdGetter
  elementsSource: ReadOnlyElementsSource
  configInstance?: InstanceElement
}

type AdapterSwaggers = {
  platform: elementUtils.swagger.LoadedSwagger
  jira: elementUtils.swagger.LoadedSwagger
}
export default class JiraAdapter implements AdapterOperations {
  private createFiltersRunner: () => Required<Filter>
  private client: JiraClient
  private scriptRunnerClient: ScriptRunnerClient
  private userConfig: JiraConfig
  private paginator: clientUtils.Paginator
  private getElemIdFunc?: ElemIdGetter
  private logIdsFunc?: () => void
  private fetchQuery: elementUtils.query.ElementQuery
  private getUserMapFunc: GetUserMapFunc
  private fixElementsFunc: FixElementsFunc
  private configInstance?: InstanceElement

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    scriptRunnerClient,
    getElemIdFunc,
    config,
    configInstance,
    elementsSource,
  }: JiraAdapterParams) {
    const wrapper = getElemIdFunc ? getElemIdFuncWrapper(getElemIdFunc) : undefined
    this.userConfig = config
    this.configInstance = configInstance
    this.getElemIdFunc = wrapper?.getElemIdFunc
    this.logIdsFunc = wrapper?.logIdsFunc
    this.client = client
    this.scriptRunnerClient = scriptRunnerClient
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
      customEntryExtractor: removeScopedObjects,
      asyncRun: config.fetch.asyncPagination ?? true,
    })

    this.fetchQuery = elementUtils.query.createElementQuery(
      this.userConfig.fetch,
      fetchCriteria,
    )

    this.paginator = paginator
    this.getUserMapFunc = getUserMapFuncCreator(paginator, client.isDataCenter)

    const filterContext = {}
    this.createFiltersRunner = () => (
      filtersRunner(
        {
          client,
          paginator,
          config,
          getElemIdFunc: this.getElemIdFunc,
          elementsSource,
          fetchQuery: this.fetchQuery,
          adapterContext: filterContext,
          getUserMapFunc: this.getUserMapFunc,
          scriptRunnerClient,
        },
        filterCreators,
        objects.concatObjects
      )
    )

    this.fixElementsFunc = combineElementFixers(
      Object.values(weakReferenceHandlers).map(handler => handler.removeWeakReferences({ elementsSource }))
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

  @logDuration('generating swagger instances from service')
  private async getSwaggerInstances(
    allTypes: TypeMap,
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>,
    supportedTypes: Record<string, string[]>
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
      supportedTypes,
      getElemIdFunc: this.getElemIdFunc,
    })
  }

  @logDuration('generating scriptRunner instances and types from service')
  private async getScriptRunnerElements(): Promise<elementUtils.FetchElements<Element[]>> {
    const { scriptRunnerApiDefinitions } = this.userConfig
    // scriptRunnerApiDefinitions is currently undefined for DC
    if (this.scriptRunnerClient === undefined
      || !this.userConfig.fetch.enableScriptRunnerAddon
      || scriptRunnerApiDefinitions === undefined) {
      return { elements: [] }
    }

    const paginator = createPaginator({
      client: this.scriptRunnerClient,
      paginationFuncCreator: paginate,
    })

    return getAllElements({
      adapterName: JIRA,
      types: scriptRunnerApiDefinitions.types,
      shouldAddRemainingTypes: false,
      supportedTypes: scriptRunnerApiDefinitions.supportedTypes,
      fetchQuery: this.fetchQuery,
      paginator,
      nestedFieldFinder: findDataField,
      computeGetArgs,
      typeDefaults: scriptRunnerApiDefinitions.typeDefaults,
      getElemIdFunc: this.getElemIdFunc,
    })
  }

  @logDuration('generating JSM assets instances and types from service')
  private async getJSMAssetsElements():
  Promise<elementUtils.FetchElements<Element[]>> {
    const { jsmApiDefinitions } = this.userConfig
    // jsmApiDefinitions is currently undefined for DC
    if (this.client === undefined
      || jsmApiDefinitions === undefined
      || !this.userConfig.fetch.enableJSM
      || !this.userConfig.fetch.enableJsmExperimental) {
      return { elements: [] }
    }

    const workspaceId = await getWorkspaceId(this.client, this.userConfig)
    if (workspaceId === undefined) {
      return { elements: [] }
    }
    const workspaceContext = { workspaceId }
    return getAllElements({
      adapterName: JIRA,
      types: jsmApiDefinitions.types,
      shouldAddRemainingTypes: false,
      supportedTypes: JSM_ASSETS_DUCKTYPE_SUPPORTED_TYPES,
      fetchQuery: this.fetchQuery,
      paginator: this.paginator,
      nestedFieldFinder: findDataField,
      computeGetArgs,
      typeDefaults: jsmApiDefinitions.typeDefaults,
      additionalRequestContext: workspaceContext,
      getElemIdFunc: this.getElemIdFunc,
      getEntriesResponseValuesFunc: jiraJSMAssetsEntriesFunc(),
    })
  }

  @logDuration('generating JSM instances and types from service')
  private async getJSMElements(swaggerResponseElements: InstanceElement[]):
  Promise<elementUtils.FetchElements<Element[]>> {
    const { jsmApiDefinitions } = this.userConfig
    // jsmApiDefinitions is currently undefined for DC
    if (this.client === undefined
      || jsmApiDefinitions === undefined
      || !this.userConfig.fetch.enableJSM) {
      return { elements: [] }
    }
    const paginator = createPaginator({
      client: this.client,
      // Pagination method is different from the rest of jira's API
      paginationFuncCreator: () => getWithCursorPagination(),
    })
    const paginationArgs = {
      url: '/rest/servicedeskapi/servicedesk',
      paginationField: '_links.next',
    }
    const serviceDeskProjectIds = (await toArrayAsync(
      paginator(paginationArgs, page => makeArray(page.values) as clientUtils.ResponseValue[])
    )).flat().map(project => project.projectId)

    const serviceDeskProjects = await Promise.all(swaggerResponseElements
      .filter(project => project.elemID.typeName === PROJECT_TYPE)
      .filter(isInstanceElement)
      .filter(project => project.value.projectTypeKey === SERVICE_DESK)
      .filter(project => {
        if (!serviceDeskProjectIds.includes(project.value.id)) {
          log.debug(`Skipping project ${project.value.name} since it has no JSM permissions`)
          return false
        }
        return true
      }))

    const fetchResultWithDuplicateTypes = await Promise.all(serviceDeskProjects.map(async projectInstance => {
      const serviceDeskProjRecord: Record<string, string> = {
        projectKey: projectInstance.value.key,
        projectId: projectInstance.value.id,
      }
      log.debug(`Fetching elements for project ${projectInstance.elemID.name}`)
      return getAllElements({
        adapterName: JIRA,
        types: jsmApiDefinitions.types,
        shouldAddRemainingTypes: false,
        supportedTypes: jsmApiDefinitions.supportedTypes,
        fetchQuery: this.fetchQuery,
        paginator: this.paginator,
        nestedFieldFinder: findDataField,
        computeGetArgs,
        typeDefaults: jsmApiDefinitions.typeDefaults,
        getElemIdFunc: this.getElemIdFunc,
        additionalRequestContext: serviceDeskProjRecord,
        getEntriesResponseValuesFunc: jiraJSMEntriesFunc(projectInstance),
      })
    }))

    /* Remove all the duplicate types and create map from type to it's instances  */
    const typeNameToJSMInstances = _.groupBy(
      fetchResultWithDuplicateTypes.flatMap(result => result.elements).filter(isInstanceElement),
      instance => instance.elemID.typeName
    )

    /* create a list of all the JSM elements and change their types */
    const jiraJSMElements = Object.entries(typeNameToJSMInstances).flatMap(([typeName, instances]) => {
      const jsmElements = elementUtils.ducktype.getNewElementsFromInstances({
        adapterName: JIRA,
        typeName,
        instances,
        transformationConfigByType: configUtils.getTransformationConfigByType(jsmApiDefinitions.types),
        transformationDefaultConfig: jsmApiDefinitions.typeDefaults.transformation,
      })
      return _.concat(jsmElements.instances as Element[], jsmElements.nestedTypes, jsmElements.type)
    })
    const allConfigChangeSuggestions = fetchResultWithDuplicateTypes
      .flatMap(fetchResult => fetchResult.configChanges ?? [])
    const jsmErrors = fetchResultWithDuplicateTypes.flatMap(fetchResult => fetchResult.errors ?? [])

    return {
      elements: jiraJSMElements,
      configChanges: elementUtils.ducktype.getUniqueConfigSuggestions(allConfigChangeSuggestions),
      errors: jsmErrors,
    }
  }

  @logDuration('generating instances from service')
  private async getAllJiraElements(
    progressReporter: ProgressReporter,
    swaggers: AdapterSwaggers
  ): Promise<elementUtils.FetchElements<Element[]>> {
    log.debug('going to fetch jira account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types' })
    const { allTypes: swaggerTypes, parsedConfigs } = await this.getAllTypes(swaggers)
    const userConfigSupportedTypes = this.userConfig.apiDefinitions.supportedTypes
    const shouldOmitBoardSupportedType = !(await hasSoftwareProject(this.client))
    const supportedTypes = shouldOmitBoardSupportedType ? _.omit(userConfigSupportedTypes, 'Board') : userConfigSupportedTypes
    progressReporter.reportProgress({ message: 'Fetching instances' })
    const [swaggerResponse, scriptRunnerElements] = await Promise.all([
      this.getSwaggerInstances(swaggerTypes, parsedConfigs, supportedTypes),
      this.getScriptRunnerElements(),
    ])

    const jsmElements = await this.getJSMElements(swaggerResponse.elements)
    const jsmAssetsElements = await this.getJSMAssetsElements()
    const elements: Element[] = [
      ...Object.values(swaggerTypes),
      ...swaggerResponse.elements,
      ...scriptRunnerElements.elements,
      ...jsmElements.elements,
      ...jsmAssetsElements.elements,
    ]
    return { elements,
      errors: (swaggerResponse.errors ?? [])
        .concat(scriptRunnerElements.errors ?? [])
        .concat(jsmElements.errors ?? [])
        .concat(jsmAssetsElements.errors ?? []),
      configChanges: (jsmElements.configChanges ?? []) }
  }

  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    const swaggers = await this.generateSwaggers()
    const { elements, errors, configChanges } = await this.getAllJiraElements(progressReporter, swaggers)

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    const filterResult = await this.createFiltersRunner().onFetch(elements) || {}

    const updatedConfig = this.configInstance && configChanges
      ? configUtils.getUpdatedCofigFromConfigChanges({
        configChanges,
        currentConfig: this.configInstance,
        configType,
      }) : undefined
    // This needs to happen after the onFetch since some filters
    // may add fields that deployment annotation should be added to
    await addDeploymentAnnotations(
      elements.filter(isObjectType),
      Object.values(swaggers),
      this.userConfig.apiDefinitions,
    )
    if (this.logIdsFunc !== undefined) {
      this.logIdsFunc()
    }
    return { elements, errors: (errors ?? []).concat(filterResult.errors ?? []), updatedConfig }
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
      changeValidator: changeValidator(this.client, this.userConfig, this.paginator),
      dependencyChanger,
      getChangeGroupIds,
    }
  }

  fixElements: FixElementsFunc = elements => this.fixElementsFunc(elements)
}
