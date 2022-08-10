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
import OktaClient from './client/client'
import { OktaConfig, API_DEFINITIONS_CONFIG } from './config'
import { FilterCreator, Filter, filtersRunner } from './filter'
import fieldReferencesFilter from './filters/field_references'
import { OKTA } from './constants'
import fetchCriteria from './fetch_criteria'

const {
  generateTypes,
  getAllInstances,
} = elementUtils.swagger

const { createPaginator, getWithOffsetAndLimit } = clientUtils
const log = logger(module)

export const DEFAULT_FILTERS = [
  fieldReferencesFilter,
]

export interface OktaAdapterParams {
  filterCreators?: FilterCreator[]
  client: OktaClient
  config: OktaConfig
  getElemIdFunc?: ElemIdGetter
  elementsSource: ReadOnlyElementsSource
}

export default class OktaAdapter implements AdapterOperations {
  private createFiltersRunner: () => Required<Filter>
  private client: OktaClient
  private userConfig: OktaConfig
  private paginator: clientUtils.Paginator
  private getElemIdFunc?: ElemIdGetter
  private fetchQuery: elementUtils.query.ElementQuery

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    config,
    elementsSource,
  }: OktaAdapterParams) {
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: getWithOffsetAndLimit,
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
        },
        filterCreators,
        objects.concatObjects
      )
    )
  }

  @logDuration('generating types from swagger')
  private async getAllTypes(): Promise<{
    allTypes: TypeMap
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>
  }> {
    return generateTypes(
      OKTA,
      this.userConfig[API_DEFINITIONS_CONFIG],
    )
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
    log.debug('going to fetch okta account configuration..')
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
    const filterResult = await this.createFiltersRunner().onFetch(elements) || {}

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
}
