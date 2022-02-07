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
import { FetchResult, AdapterOperations, DeployResult, InstanceElement, TypeMap, isObjectType, FetchOptions, DeployOptions, Change, isInstanceChange, ElemIdGetter } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData, logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { objects } from '@salto-io/lowerdash'
import JiraClient from './client/client'
import changeValidator from './change_validators'
import { JiraConfig, getApiDefinitions } from './config'
import { FilterCreator, Filter, filtersRunner, FilterResult } from './filter'
import fieldReferencesFilter from './filters/field_references'
import referenceBySelfLinkFilter from './filters/references_by_self_link'
import removeSelfFilter from './filters/remove_self'
import issueTypeSchemeReferences from './filters/issue_type_schemas/issue_type_scheme_references'
import issueTypeSchemeFilter from './filters/issue_type_schemas/issue_type_scheme'
import sharePermissionFilter from './filters/share_permission'
import sortListsFilter from './filters/sort_lists'
import boardFilter from './filters/board'
import screenFilter from './filters/screen/screen'
import mapListsFilter from './filters/map_lists'
import missingStatusesFilter from './filters/statuses/missing_statuses'
import issueTypeScreenSchemeFilter from './filters/issue_type_screen_scheme'
import fieldConfigurationFilter from './filters/field_configuration'
import fieldConfigurationTrashedFieldsFilter from './filters/field_configuration_trashed_fields'
import fieldConfigurationSchemeFilter from './filters/field_configurations_scheme'
import hiddenValuesInListsFilter from './filters/hidden_value_in_lists'
import projectFilter from './filters/project'
import projectComponentFilter from './filters/project_component'
import defaultInstancesDeployFilter from './filters/default_instances_deploy'
import workflowFilter from './filters/workflow/workflow'
import workflowPropertiesFilter from './filters/workflow/workflow_properties'
import workflowSchemeFilter from './filters/workflow_scheme'
import duplicateIdsFilter from './filters/duplicate_ids'
import fieldStructureFilter from './filters/fields/field_structure_filter'
import fieldDeploymentFilter from './filters/fields/field_deployment_filter'
import contextDeploymentFilter from './filters/fields/context_deployment_filter'
import fieldTypeReferencesFilter from './filters/fields/field_type_references_filter'
import avatarsFilter from './filters/avatars'
import userFilter from './filters/user'
import { JIRA } from './constants'
import { removeScopedObjects } from './client/pagination'
import { dependencyChanger } from './dependency_changers'

const {
  generateTypes,
  getAllInstances,
  loadSwagger,
  addDeploymentAnnotations,
} = elementUtils.swagger
const { createPaginator, getWithOffsetAndLimit } = clientUtils
const log = logger(module)

export const DEFAULT_FILTERS = [
  // This should happen before any filter that creates new instances or references
  duplicateIdsFilter,
  avatarsFilter,
  workflowFilter,
  workflowPropertiesFilter,
  workflowSchemeFilter,
  missingStatusesFilter,
  issueTypeSchemeReferences,
  issueTypeSchemeFilter,
  sharePermissionFilter,
  boardFilter,
  projectFilter,
  projectComponentFilter,
  fieldStructureFilter,
  fieldTypeReferencesFilter,
  fieldDeploymentFilter,
  contextDeploymentFilter,
  screenFilter,
  issueTypeScreenSchemeFilter,
  fieldConfigurationFilter,
  fieldConfigurationSchemeFilter,
  userFilter,
  referenceBySelfLinkFilter,
  // Must run after referenceBySelfLinkFilter
  removeSelfFilter,
  fieldReferencesFilter,
  // Must run after fieldReferencesFilter
  fieldConfigurationTrashedFieldsFilter,
  // Must run after fieldReferencesFilter
  sortListsFilter,
  // Must run after fieldReferencesFilter
  mapListsFilter,
  hiddenValuesInListsFilter,
  // Must be last
  defaultInstancesDeployFilter,
]

export interface JiraAdapterParams {
  filterCreators?: FilterCreator[]
  client: JiraClient
  config: JiraConfig
  getElemIdFunc?: ElemIdGetter
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

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    config,
  }: JiraAdapterParams) {
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: getWithOffsetAndLimit,
      customEntryExtractor: removeScopedObjects,
    })
    this.paginator = paginator
    this.createFiltersRunner = () => (
      filtersRunner({
        client,
        paginator,
        config,
        getElemIdFunc,
      }, filterCreators, objects.concatObjects)
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
      fetchConfig: this.userConfig.fetch,
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
    const filterResult = (await this.createFiltersRunner().onFetch(elements) ?? {}) as FilterResult

    // This needs to happen after the onFetch since some filters
    // may add fields that deployment annotation should be added to
    await addDeploymentAnnotations(
      elements.filter(isObjectType),
      Object.values(swaggers),
      this.userConfig.apiDefinitions,
    )
    return { elements, errors: filterResult.errors }
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
      changeValidator: changeValidator(this.client, this.userConfig),
      dependencyChanger,
    }
  }
}
