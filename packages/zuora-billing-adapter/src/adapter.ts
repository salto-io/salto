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
import {
  FetchResult, AdapterOperations, DeployResult, InstanceElement, TypeMap, isObjectType,
  DeployModifiers,
} from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import ZuoraClient from './client/client'
import { ZuoraConfig, API_DEFINITIONS_CONFIG, FETCH_CONFIG, ZuoraFetchConfig } from './config'
import { FilterCreator, Filter, filtersRunner } from './filter'
import fieldReferencesFilter from './filters/field_references'
import objectDefsFilter from './filters/object_defs'
import objectDefSplitFilter from './filters/object_def_split'
import standardObjectsFilter, { getStandardObjectTypeName } from './filters/standard_objects'
import workflowAndTaskReferences from './filters/workflow_and_task_references'
import changeValidator from './change_validator'
import { ZUORA_BILLING } from './constants'

const { createPaginator, getWithCursorPagination } = clientUtils
const { generateTypes, getAllInstances } = elementUtils.swagger
const log = logger(module)

export const DEFAULT_FILTERS = [
  // standardObjectsFilter and objectDefsFilter should run before everything else
  standardObjectsFilter,
  objectDefsFilter,
  workflowAndTaskReferences,
  // fieldReferencesFilter should run after all elements were created
  fieldReferencesFilter,
  // objectDefSplitFilter should run at the end - splits elements to divide to multiple files
  objectDefSplitFilter,
]

export interface ZuoraAdapterParams {
  filterCreators?: FilterCreator[]
  client: ZuoraClient
  config: ZuoraConfig
}

export default class ZuoraAdapter implements AdapterOperations {
  private filtersRunner: Required<Filter>
  private client: ZuoraClient
  private paginator: clientUtils.Paginator
  private userConfig: ZuoraConfig

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    config,
  }: ZuoraAdapterParams) {
    this.userConfig = config
    this.client = client
    this.paginator = createPaginator({
      client: this.client,
      paginationFunc: getWithCursorPagination,
    })
    this.filtersRunner = filtersRunner(
      this.client,
      this.paginator,
      config,
      filterCreators
    )
  }

  @logDuration('generating types from swagger')
  // eslint-disable-next-line class-methods-use-this
  private async getAllTypes(): Promise<{
    allTypes: TypeMap
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>
  }> {
    // TODO add billing-settings types
    return generateTypes(
      ZUORA_BILLING,
      this.userConfig[API_DEFINITIONS_CONFIG]
    )
  }

  @logDuration('generating instances from service')
  private async getInstances(
    allTypes: TypeMap,
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>,
    fetchConfig: ZuoraFetchConfig,
  ): Promise<InstanceElement[]> {
    const updatedApiDefinitionsConfig = {
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
    return getAllInstances({
      paginator: this.paginator,
      objectTypes: _.pickBy(allTypes, isObjectType),
      apiConfig: updatedApiDefinitionsConfig,
      fetchConfig,
    })
  }

  /**
   * Fetch configuration elements in the given zuora account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch(): Promise<FetchResult> {
    log.debug('going to fetch zuora account configuration..')
    const { allTypes, parsedConfigs } = await this.getAllTypes()

    // standard objects are not included in the swagger and need special handling - done in a filter
    const standardObjectTypeName = getStandardObjectTypeName(this.userConfig)
    const fetchIncludeTypes = this.userConfig[FETCH_CONFIG].includeTypes.filter(
      t => t !== standardObjectTypeName
    )
    const instances = await this.getInstances(
      allTypes,
      parsedConfigs,
      {
        ...this.userConfig[FETCH_CONFIG],
        includeTypes: fetchIncludeTypes,
      },
    )

    const elements = [
      ...Object.values(allTypes),
      ...instances,
    ]

    log.debug('going to run filters on %d fetched elements', elements.length)
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
