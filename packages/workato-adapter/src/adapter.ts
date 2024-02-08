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
import {
  FetchResult, AdapterOperations, DeployResult, PostFetchOptions, DeployModifiers,
  FetchOptions, ElemIdGetter,
} from '@salto-io/adapter-api'
import { client as clientUtils, elements as elementUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import WorkatoClient from './client/client'
import fetchCriteria from './fetch_criteria'
import { FilterCreator, Filter, filtersRunner } from './filter'
import { FETCH_CONFIG, WorkatoConfig } from './config'
import addRootFolderFilter from './filters/add_root_folder'
import fieldReferencesFilter from './filters/field_references'
import jiraProjectIssueTypeFilter from './filters/cross_service/jira/project_issuetypes'
import recipeCrossServiceReferencesFilter from './filters/cross_service/recipe_references'
import serviceUrlFilter from './filters/service_url'
import commonFilters from './filters/common'
import { WORKATO } from './constants'
import changeValidator from './change_validator'
import { paginate } from './client/pagination'

const log = logger(module)
const { createPaginator } = clientUtils
const { returnFullEntry } = elementUtils
const { getAllElements } = elementUtils.ducktype
const { simpleGetArgs } = fetchUtils.resource

export const DEFAULT_FILTERS = [
  addRootFolderFilter,
  jiraProjectIssueTypeFilter,
  // fieldReferencesFilter should run after all element manipulations are done
  fieldReferencesFilter,
  recipeCrossServiceReferencesFilter,
  serviceUrlFilter,
  // referencedIdFieldsFilter and queryFilter should run after element references are resolved
  ...Object.values(commonFilters),
]

export interface WorkatoAdapterParams {
  filterCreators?: FilterCreator[]
  client: WorkatoClient
  config: WorkatoConfig
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
}

export default class WorkatoAdapter implements AdapterOperations {
  private createFiltersRunner: () => Required<Filter>
  private client: WorkatoClient
  private paginator: clientUtils.Paginator
  private userConfig: WorkatoConfig
  private getElemIdFunc?: ElemIdGetter
  private fetchQuery: elementUtils.query.ElementQuery

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    config,
  }: WorkatoAdapterParams) {
    this.userConfig = config
    this.client = client
    this.getElemIdFunc = getElemIdFunc
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })
    this.paginator = paginator
    this.fetchQuery = elementUtils.query.createElementQuery(
      this.userConfig[FETCH_CONFIG],
      fetchCriteria,
    )
    this.createFiltersRunner = () => filtersRunner(
      {
        client,
        paginator,
        config: {
          fetch: config.fetch,
          apiDefinitions: config.apiDefinitions,
        },
        getElemIdFunc,
        fetchQuery: this.fetchQuery,
      },
      filterCreators,
    )
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<ReturnType<typeof getAllElements>> {
    return getAllElements({
      adapterName: WORKATO,
      types: this.userConfig.apiDefinitions.types,
      supportedTypes: this.userConfig.apiDefinitions.supportedTypes,
      fetchQuery: this.fetchQuery,
      paginator: this.paginator,
      nestedFieldFinder: returnFullEntry,
      computeGetArgs: simpleGetArgs,
      typeDefaults: this.userConfig.apiDefinitions.typeDefaults,
      getElemIdFunc: this.getElemIdFunc,
    })
  }

  /**
   * Fetch configuration elements in the given account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch workato account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types and instances' })
    const { elements, errors } = await this.getElements()
    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    await this.createFiltersRunner().onFetch(elements)
    return { elements, errors }
  }

  @logDuration('updating cross-service references')
  async postFetch(args: PostFetchOptions): Promise<void> {
    args.progressReporter.reportProgress({ message: 'Adding references to other services post-fetch' })
    await this.createFiltersRunner().onPostFetch(args)
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  // eslint-disable-next-line class-methods-use-this
  async deploy(): Promise<DeployResult> {
    throw new Error('Not implemented.')
  }

  // eslint-disable-next-line class-methods-use-this
  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator,
    }
  }
}
