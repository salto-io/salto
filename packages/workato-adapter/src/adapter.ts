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
import {
  FetchResult, AdapterOperations, DeployResult, Element, PostFetchOptions,
} from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import WorkatoClient from './client/client'
import { FilterCreator, Filter, filtersRunner } from './filter'
import { WorkatoConfig } from './config'
import extractFieldsFilter from './filters/extract_fields'
import fieldReferencesFilter from './filters/field_references'
import recipeCrossServiceReferencesFilter from './filters/cross_service/recipe_references'
import { WORKATO } from './constants'

const log = logger(module)
const {
  returnFullEntry, simpleGetArgs, getAllElements,
} = elementUtils.ducktype

export const DEFAULT_FILTERS = [
  extractFieldsFilter,
  fieldReferencesFilter,
  recipeCrossServiceReferencesFilter,
]

export interface WorkatoAdapterParams {
  filterCreators?: FilterCreator[]
  client: WorkatoClient
  config: WorkatoConfig
}

export default class WorkatoAdapter implements AdapterOperations {
  private filtersRunner: Required<Filter>
  private client: WorkatoClient
  private userConfig: WorkatoConfig

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    config,
  }: WorkatoAdapterParams) {
    this.userConfig = config
    this.client = client
    this.filtersRunner = filtersRunner(
      this.client,
      {
        fetch: config.fetch,
        apiDefinitions: config.apiDefinitions,
      },
      filterCreators,
    )
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<Element[]> {
    return getAllElements({
      adapterName: WORKATO,
      types: this.userConfig.apiDefinitions.types,
      includeTypes: this.userConfig.fetch.includeTypes,
      client: this.client,
      nestedFieldFinder: returnFullEntry,
      computeGetArgs: simpleGetArgs,
      typeDefaults: this.userConfig.apiDefinitions.typeDefaults,
    })
  }

  /**
   * Fetch configuration elements in the given account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch(): Promise<FetchResult> {
    log.debug('going to fetch workato account configuration..')
    const elements = await this.getElements()

    log.debug('going to run filters on %d fetched elements', elements.length)
    await this.filtersRunner.onFetch(elements)
    return { elements }
  }

  @logDuration('updating cross-service references')
  async postFetch(args: PostFetchOptions): Promise<void> {
    await this.filtersRunner.onPostFetch(args)
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  // eslint-disable-next-line class-methods-use-this
  async deploy(): Promise<DeployResult> {
    throw new Error('Not implemented.')
  }
}
