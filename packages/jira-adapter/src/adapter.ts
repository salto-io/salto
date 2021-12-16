/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { FetchResult, AdapterOperations, DeployResult, InstanceElement, TypeMap, isObjectType, FetchOptions, DeployOptions, Change, Element, getChangeElement, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils, client as clientUtils, deployment } from '@salto-io/adapter-components'
import { logDuration, resolveChangeElement } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import JiraClient from './client/client'
import changeValidator from './change_validator'
import { JiraConfig, getApiDefinitions } from './config'
import { FilterCreator, Filter, filtersRunner } from './filter'
import fieldReferences from './filters/field_references'
import referenceBySelfLinkFilter from './filters/references_by_self_link'
import issueTypeSchemeReferences from './filters/issue_type_scheme_references'
import authenticatedPermissionFilter from './filters/authenticated_permission'
import addDeploymentAnnotationsFilter from './filters/add_deployment_annotations'
import { JIRA } from './constants'
import { removeScopedObjects } from './client/pagination'

const { generateTypes, getAllInstances, loadSwagger } = elementUtils.swagger
const { createPaginator, getWithOffsetAndLimit } = clientUtils
const { deployChange } = deployment
const log = logger(module)

export const DEFAULT_FILTERS = [
  fieldReferences,
  referenceBySelfLinkFilter,
  issueTypeSchemeReferences,
  authenticatedPermissionFilter,
  addDeploymentAnnotationsFilter,
]

export interface JiraAdapterParams {
  filterCreators?: FilterCreator[]
  client: JiraClient
  config: JiraConfig
}

export default class JiraAdapter implements AdapterOperations {
  private createFiltersRunner: () => Promise<Required<Filter>>
  private client: JiraClient
  private userConfig: JiraConfig
  private paginator: clientUtils.Paginator
  private swaggers?: elementUtils.swagger.LoadedSwagger[]

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    config,
  }: JiraAdapterParams) {
    this.userConfig = config
    this.client = client
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: getWithOffsetAndLimit,
      customEntryExtractor: removeScopedObjects,
    })
    this.paginator = paginator
    this.createFiltersRunner = async () => (
      filtersRunner({
        client,
        paginator,
        config: { ...config, swaggers: await this.getSwaggers() },
      }, filterCreators)
    )
  }

  private async getSwaggers(): Promise<elementUtils.swagger.LoadedSwagger[]> {
    if (this.swaggers === undefined) {
      this.swaggers = await Promise.all(
        getApiDefinitions(this.userConfig.apiDefinitions)
          .map(apiDef => loadSwagger(apiDef.swagger.url))
      )
    }
    return this.swaggers
  }

  @logDuration('generating types from swagger')
  private async getAllTypes(): Promise<{
    allTypes: TypeMap
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>
  }> {
    const swaggers = await this.getSwaggers()
    // Note - this is a temporary way of handling multiple swagger defs in the same adapter
    // this will be replaced by built-in infrastructure support for multiple swagger defs
    // in the configuration
    const results = await Promise.all(
      getApiDefinitions(this.userConfig.apiDefinitions).map(
        (config, i) => generateTypes(JIRA, config, undefined, swaggers[i])
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
    })
  }

  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch jira account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types' })
    const { allTypes, parsedConfigs } = await this.getAllTypes()
    progressReporter.reportProgress({ message: 'Fetching instances' })
    const instances = await this.getInstances(allTypes, parsedConfigs)

    const elements = [
      ...Object.values(allTypes),
      ...instances,
    ]

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    await (await this.createFiltersRunner()).onFetch(elements)
    return { elements }
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const changesToDeploy = changeGroup.changes
      .filter(isInstanceChange)
      .map(change => ({
        action: change.action,
        data: _.mapValues(change.data, (element: Element) => element.clone()),
      })) as Change<InstanceElement>[]

    const runner = await this.createFiltersRunner()
    await runner.preDeploy(changesToDeploy)

    const result = await Promise.all(
      changesToDeploy.map(async change => {
        try {
          const response = await deployChange(
            await resolveChangeElement(change, ({ ref }) => ref.value),
            this.client,
            this.userConfig.apiDefinitions
              .types[getChangeElement(change).elemID.typeName]?.deployRequests,
          )
          if (isAdditionChange(change) && !Array.isArray(response)) {
            getChangeElement(change).value.id = response.id
          }
          return change
        } catch (err) {
          if (!_.isError(err)) {
            throw err
          }
          return err
        }
      })
    )

    const [errors, appliedChanges] = _.partition(result, _.isError)

    await runner.onDeploy(appliedChanges)

    return {
      appliedChanges,
      errors,
    }
  }

  // eslint-disable-next-line class-methods-use-this
  get deployModifiers(): AdapterOperations['deployModifiers'] {
    return { changeValidator }
  }
}
