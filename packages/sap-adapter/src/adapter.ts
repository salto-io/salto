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
import {
  FetchResult, AdapterOperations, DeployResult, DeployModifiers, FetchOptions,
  InstanceElement, ElemIdGetter,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  elements as elementUtils,
} from '@salto-io/adapter-components'
import { logDuration } from '@salto-io/adapter-utils'
import { objects } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import SAPClient from './client/client'
import { FilterCreator, Filter, filtersRunner, FilterResult, BrandIdToClient } from './filter'
import { FETCH_CONFIG, SAPConfig } from './config'
import { SAP } from './constants'
import changeValidator from './change_validator'
import { paginate } from './client/pagination'
import fieldReferencesFilter from './filters/field_references'
import { Credentials } from './auth'
import { getConfigFromConfigChanges } from './config_change'

const log = logger(module)
const { createPaginator } = clientUtils
const { findDataField, computeGetArgs } = elementUtils
const {
  getAllElements,
} = elementUtils.ducktype
const { concatObjects } = objects

export const DEFAULT_FILTERS = [
  fieldReferencesFilter,
]

export interface SAPAdapterParams {
  filterCreators?: FilterCreator[]
  client: SAPClient
  credentials: Credentials
  config: SAPConfig
  elementsSource: ReadOnlyElementsSource
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
  configInstance?: InstanceElement
}

export default class SAPAdapter implements AdapterOperations {
  private client: SAPClient
  private paginator: clientUtils.Paginator
  private userConfig: SAPConfig
  private getElemIdFunc?: ElemIdGetter
  private configInstance?: InstanceElement
  private fetchQuery: elementUtils.query.ElementQuery
  private createFiltersRunner: ({ filterRunnerClient, paginator } : {
    filterRunnerClient?: SAPClient
    paginator?: clientUtils.Paginator
  }) => Promise<Required<Filter>>

  public constructor({
    filterCreators = DEFAULT_FILTERS as FilterCreator[],
    client,
    getElemIdFunc,
    config,
    configInstance,
    elementsSource,
  }: SAPAdapterParams) {
    this.userConfig = config
    this.configInstance = configInstance
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    this.paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })

    this.fetchQuery = elementUtils.query.createElementQuery(this.userConfig[FETCH_CONFIG])

    this.createFiltersRunner = async ({
      filterRunnerClient,
      paginator,
    } : {
      filterRunnerClient?: SAPClient
      paginator?: clientUtils.Paginator
      brandIdToClient?: BrandIdToClient
    }) => (
      filtersRunner(
        {
          client: filterRunnerClient ?? this.client,
          paginator: paginator ?? this.paginator,
          config: {
            fetch: config.fetch,
            apiDefinitions: config.apiDefinitions,
          },
          getElemIdFunc,
          fetchQuery: this.fetchQuery,
          elementsSource,
        },
        filterCreators,
        concatObjects,
      )
    )
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<ReturnType<typeof getAllElements>> {
    const { supportedTypes } = this.userConfig.apiDefinitions
    // SAP Support and (if enabled) global SAP Guide types
    return getAllElements({
      adapterName: SAP,
      types: this.userConfig.apiDefinitions.types,
      supportedTypes,
      fetchQuery: this.fetchQuery,
      paginator: this.paginator,
      nestedFieldFinder: findDataField,
      computeGetArgs,
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
    log.debug('going to fetch sap account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types and instances' })
    const { elements, configChanges, errors } = await this.getElements()

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    // This exposes different subdomain clients for Guide related types filters
    const result = await (await this.createFiltersRunner({}))
      .onFetch(elements) as FilterResult
    const updatedConfig = this.configInstance && configChanges
      ? getConfigFromConfigChanges(configChanges, this.configInstance)
      : undefined

    const fetchErrors = (errors ?? []).concat(result.errors ?? [])
    return { elements, errors: fetchErrors, updatedConfig }
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  // eslint-disable-next-line class-methods-use-this
  async deploy(): Promise<DeployResult> {
    throw new Error('deploy not supported')
  }

  // eslint-disable-next-line class-methods-use-this
  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator,
    }
  }
}
