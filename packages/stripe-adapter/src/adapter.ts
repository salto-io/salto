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
import {
  FetchResult,
  AdapterOperations,
  DeployResult,
  InstanceElement,
  TypeMap,
  isObjectType,
  DeployModifiers,
  FetchOptions,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  config as configUtils,
  elements as elementUtils,
  fetch as fetchUtils,
} from '@salto-io/adapter-components'
import { logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import StripeClient from './client/client'
import { StripeConfig, API_DEFINITIONS_CONFIG, FETCH_CONFIG } from './config'
import fetchCriteria from './fetch_criteria'
import { FilterCreator, Filter, filtersRunner } from './filter'
import { STRIPE } from './constants'
import changeValidator from './change_validator'
import commonFilters from './filters/common'
import fieldReferencesFilter from './filters/field_references'

const { createPaginator, getWithCursorPagination } = clientUtils

const { generateTypes, getAllInstances } = elementUtils.swagger
const log = logger(module)

export const DEFAULT_FILTERS = [
  // fieldReferencesFilter should run after all elements were created
  fieldReferencesFilter,
  ...Object.values(commonFilters),
]

export interface StripeAdapterParams {
  filterCreators?: FilterCreator[]
  client: StripeClient
  config: StripeConfig
}

export default class StripeAdapter implements AdapterOperations {
  private filtersRunner: Required<Filter>
  private client: StripeClient
  private paginator: clientUtils.Paginator
  private userConfig: StripeConfig
  private fetchQuery: elementUtils.query.ElementQuery

  public constructor({ filterCreators = DEFAULT_FILTERS, client, config }: StripeAdapterParams) {
    this.userConfig = config
    this.client = client
    this.paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: () => getWithCursorPagination(),
    })
    this.fetchQuery = elementUtils.query.createElementQuery(this.userConfig[FETCH_CONFIG], fetchCriteria)
    this.filtersRunner = filtersRunner(
      {
        client: this.client,
        paginator: this.paginator,
        config,
        fetchQuery: this.fetchQuery,
      },
      filterCreators,
    )
  }

  @logDuration('generating types from swagger')
  private async getAllTypes(): Promise<{
    allTypes: TypeMap
    parsedConfigs: Record<string, configUtils.TypeSwaggerConfig>
  }> {
    return generateTypes(STRIPE, this.userConfig[API_DEFINITIONS_CONFIG])
  }

  @logDuration('generating instances from service')
  private async getInstances(
    allTypes: TypeMap,
    parsedConfigs: Record<string, configUtils.TypeSwaggerConfig>,
  ): Promise<fetchUtils.FetchElements<InstanceElement[]>> {
    const updatedApiDefinitionsConfig = {
      ...this.userConfig[API_DEFINITIONS_CONFIG],
      // user config takes precedence over parsed config
      types: {
        ...parsedConfigs,
        ..._.mapValues(this.userConfig[API_DEFINITIONS_CONFIG].types, (def, typeName) => ({
          ...parsedConfigs[typeName],
          ...def,
        })),
      },
    }
    return getAllInstances({
      paginator: this.paginator,
      objectTypes: _.pickBy(allTypes, isObjectType),
      apiConfig: updatedApiDefinitionsConfig,
      supportedTypes: this.userConfig[API_DEFINITIONS_CONFIG].supportedTypes,
      fetchQuery: this.fetchQuery,
    })
  }

  /**
   * Fetch configuration elements in the given stripe account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch stripe account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types' })
    const { allTypes, parsedConfigs } = await this.getAllTypes()
    progressReporter.reportProgress({ message: 'Fetching instances' })
    const { elements: instances } = await this.getInstances(allTypes, parsedConfigs)

    const elements = [...Object.values(allTypes), ...instances]

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    await this.filtersRunner.onFetch(elements)
    return { elements }
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
