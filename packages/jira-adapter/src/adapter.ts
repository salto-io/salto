/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Element,
  FetchResult,
  AdapterOperations,
  DeployResult,
  InstanceElement,
  TypeMap,
  isObjectType,
  FetchOptions,
  DeployOptions,
  Change,
  isInstanceChange,
  ElemIdGetter,
  ReadOnlyElementsSource,
  ProgressReporter,
  FixElementsFunc,
  isInstanceElement,
} from '@salto-io/adapter-api'
import {
  config as configUtils,
  definitions,
  elements as elementUtils,
  client as clientUtils,
  combineElementFixers,
  fetch as fetchUtils,
  openapi,
} from '@salto-io/adapter-components'
import { applyFunctionToChangeData, ERROR_MESSAGES, getElemIdFuncWrapper, logDuration } from '@salto-io/adapter-utils'
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
import missingFieldDescriptionsFilter from './filters/field_configuration/missing_field_descriptions'
import fieldConfigurationDependenciesFilter from './filters/field_configuration/field_configuration_dependencies'
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
import workflowV1RemovalFilter from './filters/workflowV2/workflowV1_removal'
import workflowTransitionIdsFilter from './filters/workflowV2/transition_ids'
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
import objectTypeIconFilter from './filters/assets/object_type_icon'
import filtersFilter from './filters/filter'
import removeEmptyValuesFilter from './filters/remove_empty_values'
import jqlReferencesFilter from './filters/jql/jql_references'
import userFilter from './filters/user'
import changePortalGroupFieldsFilter from './filters/change_portal_group_fields'
import { JIRA, PROJECT_TYPE, SERVICE_DESK } from './constants'
import { paginate, filterResponseEntries } from './client/pagination'
import { dependencyChanger } from './dependency_changers'
import { getChangeGroupIds } from './group_change'
import fetchCriteria from './fetch_criteria'
import assetsObjectFieldConfigurationFilter from './filters/assets/assets_object_field_configuration'
import assetsObjectFieldConfigurationReferencesFilter from './filters/assets/assets_object_field_configuration_references'
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
import accountInfoFilter, { isJsmPremiumEnabledInService, isJsmEnabledInService } from './filters/account_info'
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
import addAliasExtendedFilter from './filters/add_alias_extended'
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
import objectSchemaDeployFilter from './filters/assets/object_schema_deployment'
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
import asyncApiCallsFilter from './filters/async_api_calls'
import slaAdditionFilter from './filters/sla_addition_deployment'
import addImportantValuesFilter from './filters/add_important_values'
import ScriptRunnerClient from './client/script_runner_client'
import { jiraJSMAssetsEntriesFunc, jiraJSMEntriesFunc } from './jsm_utils'
import { hasSoftwareProject } from './utils'
import { getWorkspaceId } from './workspace_id'
import { JSM_ASSETS_DUCKTYPE_SUPPORTED_TYPES } from './config/api_config'
import { createFixElementFunctions } from './fix_elements'
import fieldContextOptionsSplitFilter from './filters/fields/field_context_option_split'
import fieldContextOptionsDeploymentFilter from './filters/fields/context_options_deployment_filter'
import fieldContextOptionsDeploymentOrderFilter from './filters/fields/context_options_order_deployment_filter'
import contextDefaultValueDeploymentFilter from './filters/fields/context_default_value_deployment_filter'
import statusPropertiesReferencesFilter from './filters/workflowV2/status_properties_references'
import enhancedSearchNoiseReductionFilter from './filters/script_runner/enhanced_search/enhanced_search_noise_filter'
import remove10kOptionsContexts from './filters/fields/remove_10k_options_contexts'

const { getAllElements, addRemainingTypes, restoreInstanceTypeFromDeploy } = elementUtils.ducktype
const { findDataField } = elementUtils
const { computeGetArgs } = fetchUtils.resource
const { getAllInstances } = elementUtils.swagger
const { createPaginator, getWithCursorPagination } = clientUtils
const log = logger(module)

const { query: queryFilter, hideTypes: hideTypesFilter, ...otherCommonFilters } = commonFilters
const { toArrayAsync } = collections.asynciterable
const { makeArray } = collections.array

const DEFAULT_FILTERS = [
  asyncApiCallsFilter,
  accountInfoFilter,
  storeUsersFilter,
  changeJSMElementsFieldFilter,
  queueFetchFilter,
  changePortalGroupFieldsFilter,
  automationLabelFetchFilter,
  automationLabelDeployFilter,
  automationFetchFilter,
  automationStructureFilter,
  brokenReferences, // Should run before automationDeploymentFilter
  automationDeploymentFilter,
  addImportantValuesFilter,
  webhookFilter,
  fieldNameFilter, // Should run before duplicateIdsFilter
  workflowFilter,
  workflowV1RemovalFilter,
  workflowStructureFilter,
  queryFilter,
  projectRoleRemoveTeamManagedDuplicatesFilter, // This should run before duplicateIdsFilter
  fieldStructureFilter, // fieldStructureFilter adds instances so it should run before duplicateIdsFilter. It also creates references so it should run before fieldReferencesFilter
  remove10kOptionsContexts, // must run after fieldStructureFilter and before fieldContextOptionsSplitFilter
  localeFilter,
  iconUrlFilter,
  triggersFilter,
  resolutionPropertyFilter,
  scriptRunnerFilter,
  scriptedFieldsIssueTypesFilter, // must run before references are transformed
  behaviorsMappingsFilter,
  behaviorsFieldUuidFilter,
  scriptRunnerWorkflowFilter,
  scriptRunnerWorkflowListsFilter, // must run after scriptRunnerWorkflowFilter
  scriptRunnerTemplateExpressionFilter,
  scriptRunnerEmptyAccountIdsFilter,
  workflowPropertiesFilter, // resolves references in workflow instances!
  scriptRunnerWorkflowReferencesFilter, // must run after scriptRunnerWorkflowListsFilter and workflowPropertiesFilter
  statusPropertiesReferencesFilter, // must run before workflowTransitionIdsFilter
  workflowTransitionIdsFilter, // must run after scriptRunnerWorkflowReferencesFilter
  transitionIdsFilter,
  workflowDeployFilter,
  workflowModificationFilter,
  emptyValidatorWorkflowFilter, // must run after workflowFilter
  objectTypeIconFilter,
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
  userFilter,
  forbiddenPermissionSchemeFilter,
  enhancedSearchNoiseReductionFilter, // Must run before jqlReferencesFilter
  removeEmptyValuesFilter,
  maskingFilter,
  pluginVersionFliter,
  referenceBySelfLinkFilter,
  removeSelfFilter, // Must run after referenceBySelfLinkFilter
  // serviceUrl filters must run before duplicateIdsFilter
  serviceUrlJsmFilter, // Must run before fieldReferencesFilter
  serviceUrlInformationFilter,
  serviceUrlFilter,
  addAliasFilter, // must run before duplicateIdsFilter
  duplicateIdsFilter,
  unresolvedParentsFilter, // must run after duplicateIdsFilter
  fieldConfigurationFilter, // must run after duplicateIdsFilter
  fieldConfigurationSchemeFilter,
  contextReferencesFilter, // must run after duplicateIdsFilter
  assetsObjectFieldConfigurationFilter, // must run after contextReferencesFilter
  fieldTypeReferencesFilter,
  fieldDeploymentFilter,
  contextDeploymentFilter, // must run after fieldDeploymentFilter
  avatarsFilter, // This must run after contextDeploymentFilter
  jqlReferencesFilter, // must run after assetsObjectFieldConfigurationFilter
  fieldContextOptionsSplitFilter,
  formsFilter, // must run before fieldReferencesFilter and after fieldContextOptionsSplitFilter
  fieldReferencesFilter,
  assetsObjectFieldConfigurationReferencesFilter, // This filter creates references, it must run after fieldReferencesFilter, assetsObjectFieldConfigurationFilter and before changeAttributesPathFilter
  addJsmTypesAsFieldsFilter, // Must run after fieldReferencesFilter
  issueLayoutFilter,
  fetchJsmTypesFilter,
  assetsObjectTypeChangeFields,
  removeSimpleFieldProjectFilter, // Must run after issueLayoutFilter
  requestTypeLayoutsFilter,
  createReferencesIssueLayoutFilter,
  requestTypelayoutsToValuesFilter, // Must run after createReferencesIssueLayoutFilter
  projectFieldContextOrder,
  fieldConfigurationDeployment,
  fieldConfigurationDependenciesFilter, // Must run after fieldConfigurationSplitFilter
  missingFieldDescriptionsFilter, // Must run after fieldReferencesFilter
  sortListsFilter,
  filtersFilter,
  hiddenValuesInListsFilter,
  missingDescriptionsFilter,
  smartValueReferenceFilter,
  permissionSchemeFilter,
  allowedPermissionsSchemeFilter,
  deployPermissionSchemeFilter,
  accountIdFilter, // Must run after user filter
  userIdFilter, // Must run after accountIdFilter
  userFallbackFilter, // Must run after accountIdFilter
  wrongUserPermissionSchemeFilter, // Must run after accountIdFilter
  deployDcIssueEventsFilter,
  addAliasExtendedFilter, // we need to run addAliasFilter before duplicateIdsFilter but we add jsm instances after it.
  // So we need to run it again. we should fix it in SALTO-7175.
  scriptRunnerListenersDeployFilter, // must be done before scriptRunnerInstances
  scriptedFragmentsDeployFilter, // must be done before scriptRunnerInstances
  scriptRunnerInstancesDeploy,
  portalSettingsFilter,
  queueDeploymentFilter,
  slaAdditionFilter,
  portalGroupsFilter,
  requestTypeFilter,
  fieldContextOptionsDeploymentFilter,
  fieldContextOptionsDeploymentOrderFilter,
  contextDefaultValueDeploymentFilter, // Must be ran after fieldContextOptionsDeploymentFilter
  assetsInstancesDeploymentFilter, // Must run before asstesDeployFilter
  jsmPathFilter, // Must be done after JsmTypesFilter
  ...Object.values(otherCommonFilters),
  assetsObjectTypePath, // Must run after otherCommonFilters and specificly after referencedInstanceNamesFilterCreator.
  changeAttributesPathFilter, // Must run after assetsObjectTypePath
  defaultAttributesFilter,
  assetsObjectTypeOrderFilter,
  deployAttributesFilter,
  objectSchemaDeployFilter, // Must run before deployJsmTypesFilter
  deployJsmTypesFilter,
  hideTypesFilter, // Must run after defaultAttributesFilter and assetsObjectTypeOrderFilter, which also create types.
  defaultInstancesDeployFilter, // Must be last
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
  platform: openapi.LoadedSwagger
  jira: openapi.LoadedSwagger
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
      customEntryExtractor: filterResponseEntries,
      asyncRun: config.fetch.asyncPagination ?? true,
    })

    this.fetchQuery = elementUtils.query.createElementQuery(this.userConfig.fetch, fetchCriteria)

    this.paginator = paginator
    this.getUserMapFunc = getUserMapFuncCreator(
      paginator,
      client.isDataCenter,
      config.fetch.allowUserCallFailure ?? false,
    )

    const filterContext = {}
    this.createFiltersRunner = () =>
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
        objects.concatObjects,
      )

    this.fixElementsFunc = combineElementFixers(createFixElementFunctions({ elementsSource, client, config }))
  }

  private async generateSwaggers(): Promise<AdapterSwaggers> {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(getApiDefinitions(this.userConfig.apiDefinitions)).map(async ([key, config]) => [
          key,
          await openapi.loadSwagger(config.swagger.url),
        ]),
      ),
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
      Object.keys(swaggers).map(key =>
        openapi.generateTypes(
          JIRA,
          apiDefinitions[key as keyof AdapterSwaggers],
          undefined,
          swaggers[key as keyof AdapterSwaggers],
        ),
      ),
    )
    return _.merge({}, ...results)
  }

  @logDuration('generating swagger instances from service')
  private async getSwaggerInstances(
    allTypes: TypeMap,
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>,
    supportedTypes: Record<string, string[]>,
  ): Promise<fetchUtils.FetchElements<InstanceElement[]>> {
    const updatedApiDefinitionsConfig = {
      ...this.userConfig.apiDefinitions,
      types: {
        ...parsedConfigs,
        ..._.mapValues(this.userConfig.apiDefinitions.types, (def, typeName) => ({
          ...parsedConfigs[typeName],
          ...def,
        })),
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
  private async getScriptRunnerElements(): Promise<fetchUtils.FetchElements<Element[]>> {
    const { scriptRunnerApiDefinitions } = this.userConfig
    // scriptRunnerApiDefinitions is currently undefined for DC
    if (
      this.scriptRunnerClient === undefined ||
      !this.userConfig.fetch.enableScriptRunnerAddon ||
      scriptRunnerApiDefinitions === undefined
    ) {
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
  private async getJSMAssetsElements(): Promise<fetchUtils.FetchElements<Element[]>> {
    const { jsmApiDefinitions } = this.userConfig
    // jsmApiDefinitions is currently undefined for DC
    if (
      this.client === undefined ||
      jsmApiDefinitions === undefined ||
      !this.userConfig.fetch.enableJSM ||
      !(this.userConfig.fetch.enableJsmExperimental || this.userConfig.fetch.enableJSMPremium) ||
      !(await isJsmPremiumEnabledInService(this.client))
    ) {
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
  private async getJSMElements(
    swaggerResponseElements: InstanceElement[],
  ): Promise<fetchUtils.FetchElements<Element[]>> {
    const { jsmApiDefinitions } = this.userConfig
    // jsmApiDefinitions is currently undefined for DC
    if (this.client === undefined || jsmApiDefinitions === undefined || !this.userConfig.fetch.enableJSM) {
      return { elements: [] }
    }

    const isJsmEnabled = await isJsmEnabledInService(this.client)
    if (!isJsmEnabled) {
      log.debug('enableJSM set to true, but JSM is not enabled in the service, skipping fetching JSM elements')
      return {
        elements: [],
        errors: [
          {
            message: ERROR_MESSAGES.OTHER_ISSUES,
            detailedMessage:
              'Jira Service Management is not enabled in this Jira instance. Skipping fetch of JSM elements.',
            severity: 'Warning',
          },
        ],
      }
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
    const serviceDeskProjectIds = (
      await toArrayAsync(paginator(paginationArgs, page => makeArray(page.values) as clientUtils.ResponseValue[]))
    )
      .flat()
      .map(project => project.projectId)

    const serviceDeskProjects = await Promise.all(
      swaggerResponseElements
        .filter(project => project.elemID.typeName === PROJECT_TYPE)
        .filter(isInstanceElement)
        .filter(project => project.value.projectTypeKey === SERVICE_DESK)
        .filter(project => {
          if (!serviceDeskProjectIds.includes(project.value.id)) {
            log.debug(`Skipping project ${project.value.name} since it has no JSM permissions`)
            return false
          }
          return true
        }),
    )

    const fetchResultWithDuplicateTypes = await Promise.all(
      serviceDeskProjects.map(async projectInstance => {
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
          shouldIgnorePermissionsError: true,
        })
      }),
    )

    /* Remove all the duplicate types and create map from type to it's instances  */
    const typeNameToJSMInstances = _.groupBy(
      fetchResultWithDuplicateTypes.flatMap(result => result.elements).filter(isInstanceElement),
      instance => instance.elemID.typeName,
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
    const allConfigChangeSuggestions = fetchResultWithDuplicateTypes.flatMap(
      fetchResult => fetchResult.configChanges ?? [],
    )
    const jsmErrors = fetchResultWithDuplicateTypes.flatMap(fetchResult => fetchResult.errors ?? [])

    return {
      elements: jiraJSMElements,
      configChanges: fetchUtils.getUniqueConfigSuggestions(allConfigChangeSuggestions),
      errors: jsmErrors,
    }
  }

  @logDuration('generating instances from service')
  private async getAllJiraElements(
    progressReporter: ProgressReporter,
    swaggers: AdapterSwaggers,
  ): Promise<fetchUtils.FetchElements<Element[]>> {
    log.debug('going to fetch jira account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types' })
    const { allTypes: swaggerTypes, parsedConfigs } = await this.getAllTypes(swaggers)
    const userConfigSupportedTypes = this.userConfig.apiDefinitions.supportedTypes
    const shouldOmitBoardSupportedType = !(await hasSoftwareProject(this.client))
    const supportedTypes = shouldOmitBoardSupportedType
      ? _.omit(userConfigSupportedTypes, 'Board')
      : userConfigSupportedTypes
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

    if (this.userConfig.jsmApiDefinitions) {
      // Remaining types should be added once to avoid overlaps between the generated elements,
      // so we add them once after all elements are generated
      addRemainingTypes({
        adapterName: JIRA,
        elements,
        typesConfig: this.userConfig.jsmApiDefinitions?.types ?? {},
        supportedTypes: this.userConfig.jsmApiDefinitions?.supportedTypes ?? {},
        typeDefaultConfig: {
          ...this.userConfig.apiDefinitions.typeDefaults,
          ...this.userConfig.jsmApiDefinitions?.typeDefaults,
        },
      })
    }
    return {
      elements,
      errors: (swaggerResponse.errors ?? [])
        .concat(scriptRunnerElements.errors ?? [])
        .concat(jsmElements.errors ?? [])
        .concat(jsmAssetsElements.errors ?? []),
      configChanges: jsmElements.configChanges ?? [],
    }
  }

  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    const swaggers = await this.generateSwaggers()
    const { elements, errors, configChanges } = await this.getAllJiraElements(progressReporter, swaggers)

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    const filterResult = (await this.createFiltersRunner().onFetch(elements)) || {}

    const updatedConfig =
      this.configInstance && configChanges
        ? definitions.getUpdatedConfigFromConfigChanges({
            configChanges,
            currentConfig: this.configInstance,
            configType,
          })
        : undefined
    // This needs to happen after the onFetch since some filters
    // may add fields that deployment annotation should be added to
    await openapi.addDeploymentAnnotations(
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
    const changesToDeploy = await Promise.all(
      changeGroup.changes
        .filter(isInstanceChange)
        .map(change => applyFunctionToChangeData<Change<InstanceElement>>(change, instance => instance.clone())),
    )

    const runner = this.createFiltersRunner()
    await runner.preDeploy(changesToDeploy)

    const {
      deployResult: { appliedChanges, errors },
    } = await runner.deploy(changesToDeploy)

    const changesToReturn = Array.from(appliedChanges)
    await runner.onDeploy(changesToReturn)

    const changesWithRestoredTypes = restoreInstanceTypeFromDeploy({
      appliedChanges: changesToReturn,
      originalInstanceChanges: changesToDeploy,
    })

    return {
      appliedChanges: changesWithRestoredTypes,
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
