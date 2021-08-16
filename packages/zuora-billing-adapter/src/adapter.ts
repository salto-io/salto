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
  DeployModifiers, Element, FetchOptions,
} from '@salto-io/adapter-api'
import { client as clientUtils, config as configUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import ZuoraClient from './client/client'
import { ZuoraConfig, API_DEFINITIONS_CONFIG, FETCH_CONFIG, ZuoraApiConfig } from './config'
import { FilterCreator, Filter, filtersRunner } from './filter'
import fieldReferencesFilter from './filters/field_references'
import objectDefsFilter from './filters/object_defs'
import objectDefSplitFilter from './filters/object_def_split'
import workflowAndTaskReferencesFilter from './filters/workflow_and_task_references'
import unorderedListsFilter from './filters/unordered_lists'
import changeValidator from './change_validator'
import { ZUORA_BILLING, LIST_ALL_SETTINGS_TYPE, SETTINGS_TYPE_PREFIX, CUSTOM_OBJECT_DEFINITION_TYPE } from './constants'
import { generateBillingSettingsTypes } from './transformers/billing_settings'
import { getStandardObjectElements, getStandardObjectTypeName } from './transformers/standard_objects'
import { paginate } from './client/pagination'

const { createPaginator } = clientUtils
const { generateTypes, getAllInstances } = elementUtils.swagger
const log = logger(module)

export const DEFAULT_FILTERS = [
  // objectDefsFilter should run before everything else
  objectDefsFilter,

  // unorderedLists should run before references are created
  unorderedListsFilter,

  workflowAndTaskReferencesFilter,

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
      paginationFunc: paginate,
    })
    this.filtersRunner = filtersRunner(
      {
        client: this.client,
        paginator: this.paginator,
        config,
      },
      filterCreators,
    )
  }

  private apiDefinitions(
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>,
  ): ZuoraApiConfig {
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
  private async getSwaggerTypes(): Promise<elementUtils.swagger.ParsedTypes> {
    return generateTypes(
      ZUORA_BILLING,
      this.userConfig[API_DEFINITIONS_CONFIG]
    )
  }

  @logDuration('generating types for billing settings')
  private async getBillingSettingsTypes({
    parsedConfigs, allTypes,
  }: elementUtils.swagger.ParsedTypes): Promise<elementUtils.swagger.ParsedTypes> {
    if (this.userConfig[FETCH_CONFIG].settingsIncludeTypes === undefined) {
      return { allTypes: {}, parsedConfigs: {} }
    }

    const apiDefs = this.apiDefinitions(parsedConfigs)
    const settingsOpInfoInstances = await getAllInstances({
      paginator: this.paginator,
      objectTypes: _.pickBy(allTypes, isObjectType),
      apiConfig: apiDefs,
      fetchConfig: { includeTypes: [LIST_ALL_SETTINGS_TYPE] },
    })
    if (_.isEmpty(settingsOpInfoInstances)) {
      throw new Error('could not find any settings definitions - remove settingsFetchTypes and fetch again')
    }
    return generateBillingSettingsTypes(settingsOpInfoInstances, apiDefs)
  }

  @logDuration('generating type and instances for standard objects')
  private async getStandardObjectElements({
    parsedConfigs, allTypes,
  }: elementUtils.swagger.ParsedTypes): Promise<Element[]> {
    const apiConfig = this.apiDefinitions(parsedConfigs)
    const standardObjectTypeName = getStandardObjectTypeName(apiConfig)
    if (
      standardObjectTypeName === undefined
      || !this.userConfig[FETCH_CONFIG].includeTypes.includes(standardObjectTypeName)
    ) {
      return []
    }
    const standardObjectWrapperType = allTypes[standardObjectTypeName]
    const customObjectDefType = allTypes[CUSTOM_OBJECT_DEFINITION_TYPE]
    if (!isObjectType(standardObjectWrapperType) || !isObjectType(customObjectDefType)) {
      log.warn('Could not find object types %s / %s', standardObjectTypeName, CUSTOM_OBJECT_DEFINITION_TYPE)
      return []
    }
    return getStandardObjectElements({
      standardObjectWrapperType,
      customObjectDefType,
      paginator: this.paginator,
      apiConfig,
    })
  }

  @logDuration('getting instances from service')
  private async getInstances(
    allTypes: TypeMap,
    parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>,
  ): Promise<InstanceElement[]> {
    // standard objects are not included in the swagger and need special handling - done in a filter
    const standardObjectTypeName = getStandardObjectTypeName(this.apiDefinitions(parsedConfigs))
    const swaggerIncludeTypes = this.userConfig[FETCH_CONFIG].includeTypes.filter(
      t => t !== standardObjectTypeName
    )
    // settings include types can be fetched with the regular include types, since their types
    // were already generatedטוב
    const settingsIncludeTypes = (this.userConfig[FETCH_CONFIG].settingsIncludeTypes ?? []).map(
      t => `${SETTINGS_TYPE_PREFIX}${t}`
    )
    const fetchConfig = {
      ...this.userConfig[FETCH_CONFIG],
      includeTypes: [...swaggerIncludeTypes, ...settingsIncludeTypes],
    }

    return getAllInstances({
      paginator: this.paginator,
      objectTypes: _.pickBy(allTypes, isObjectType),
      apiConfig: this.apiDefinitions(parsedConfigs),
      fetchConfig,
    })
  }

  /**
   * Fetch configuration elements in the given zuora account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch zuora account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types' })
    const swaggerTypes = await this.getSwaggerTypes()
    // the billing settings types are not listed in the swagger, so we fetch them separately
    // and give them a custom prefix to avoid conflicts
    const settingsTypes = await this.getBillingSettingsTypes(swaggerTypes)


    const { allTypes, parsedConfigs } = {
      allTypes: { ...swaggerTypes.allTypes, ...settingsTypes.allTypes },
      parsedConfigs: { ...swaggerTypes.parsedConfigs, ...settingsTypes.parsedConfigs },
    }
    progressReporter.reportProgress({ message: 'Fetching instances' })

    const instances = await this.getInstances(allTypes, parsedConfigs)
    const standardObjectElements = await this.getStandardObjectElements({ allTypes, parsedConfigs })

    const elements = [
      ...Object.values(allTypes),
      ...instances,
      ...standardObjectElements,
    ]

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
