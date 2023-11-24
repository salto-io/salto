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
import {
  FetchResult, AdapterOperations, DeployResult, InstanceElement, TypeMap, isObjectType,
  DeployModifiers, FetchOptions,
} from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils, elements as elementUtils } from '@salto-io/adapter-components'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import SAPClient from './client/client'
import { SAPConfig, API_DEFINITIONS_CONFIG, FETCH_CONFIG, SAPApiConfig } from './config'
import { FilterCreator, Filter, filtersRunner } from './filter'
import commonFilters from './filters/common'
import fieldReferencesFilter from './filters/field_references'
import changeValidator from './change_validator'
import { SAP } from './constants'
import { paginate } from './client/pagination'

const { createPaginator } = clientUtils
const { generateTypes, getAllInstances } = elementUtils.swagger
const log = logger(module)

export const DEFAULT_FILTERS = [
  // fieldReferencesFilter should run after all elements were created
  fieldReferencesFilter,
  ...Object.values(commonFilters),
]

export interface SAPAdapterParams {
  filterCreators?: FilterCreator[]
  client: SAPClient
  config: SAPConfig
}

export default class SAPAdapter implements AdapterOperations {
  private createFiltersRunner: () => Required<Filter>
  private client: SAPClient
  private paginator: clientUtils.Paginator
  private userConfig: SAPConfig
  private fetchQuery: elementUtils.query.ElementQuery

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    config,
  }: SAPAdapterParams) {
    this.userConfig = config
    this.client = client
    // TODO: figure SAP pagination
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })
    this.paginator = paginator
    this.fetchQuery = elementUtils.query.createElementQuery(config[FETCH_CONFIG])
    this.createFiltersRunner = () => (
      filtersRunner({ client, paginator, config, fetchQuery: this.fetchQuery }, filterCreators)
    )
  }

  private apiDefinitions(
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>,
  ): SAPApiConfig {
    return {
      ...this.userConfig[API_DEFINITIONS_CONFIG],
      // user config takes precedence over parsed config
      types: {
        ...parsedConfigs,
        ..._.mapValues(
          this.userConfig[API_DEFINITIONS_CONFIG].types,
          (def, typeName) => ({ ...parsedConfigs[typeName], ...def })
        ),
      },
    }
  }

  @logDuration('generating types from swagger')
  private async getTypes(): Promise<elementUtils.swagger.ParsedTypes> {
    return generateTypes(
      SAP,
      this.userConfig[API_DEFINITIONS_CONFIG],
    )
  }

  @logDuration('getting instances from service')
  private async getInstances(
    allTypes: TypeMap,
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>,
  ): Promise<elementUtils.FetchElements<InstanceElement[]>> {
    return getAllInstances({
      paginator: this.paginator,
      objectTypes: _.pickBy(allTypes, isObjectType),
      apiConfig: this.apiDefinitions(parsedConfigs),
      supportedTypes: this.userConfig[API_DEFINITIONS_CONFIG].supportedTypes,
      fetchQuery: this.fetchQuery,
    })
  }

  /**
   * Fetch configuration elements in the given sap account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch sap account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types' })
    const { allTypes, parsedConfigs } = await this.getTypes()
    progressReporter.reportProgress({ message: 'Fetching instances' })
    const { elements: instances } = await this.getInstances(allTypes, parsedConfigs)
    const elements = [
      ...Object.values(allTypes),
      ...instances,
    ]

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })

    await this.createFiltersRunner().onFetch(elements)
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
