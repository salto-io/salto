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
  Element,
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
import ZuoraClient from './client/client'
import {
  ZuoraConfig,
  API_DEFINITIONS_CONFIG,
  FETCH_CONFIG,
  ZuoraApiConfig,
  SETTING_TYPES,
  SUPPORTED_TYPES,
} from './config'
import fetchCriteria from './fetch_criteria'
import { FilterCreator, Filter, filtersRunner } from './filter'
import commonFilters from './filters/common'
import fieldReferencesFilter from './filters/field_references'
import objectDefsFilter from './filters/object_defs'
import objectDefSplitFilter from './filters/object_def_split'
import workflowAndTaskReferencesFilter from './filters/workflow_and_task_references'
import objectReferencesFilter from './filters/object_references'
import financeInformationReferencesFilter from './filters/finance_information_references'
import unorderedListsFilter from './filters/unordered_lists'
import changeValidator from './change_validator'
import { ZUORA_BILLING, LIST_ALL_SETTINGS_TYPE, CUSTOM_OBJECT_DEFINITION_TYPE } from './constants'
import { generateBillingSettingsTypes } from './transformers/billing_settings'
import { getStandardObjectElements, getStandardObjectTypeName } from './transformers/standard_objects'
import { paginate } from './client/pagination'

const { createPaginator } = clientUtils
const { generateTypes, getAllInstances } = elementUtils.swagger
const log = logger(module)

const { hideTypes: hideTypesFilter, ...otherCommonFilters } = commonFilters

export const DEFAULT_FILTERS = [
  // hideTypes should run before creating custom objects, so that it doesn't hide them
  hideTypesFilter,
  // objectDefsFilter should run before everything else
  objectDefsFilter,
  // unorderedLists should run before references are created
  unorderedListsFilter,
  workflowAndTaskReferencesFilter,
  // fieldReferencesFilter should run after all elements were created
  fieldReferencesFilter,
  objectReferencesFilter,
  financeInformationReferencesFilter,
  ...Object.values(otherCommonFilters),
  // objectDefSplitFilter should run at the end - splits elements to divide to multiple files
  objectDefSplitFilter,
]

export interface ZuoraAdapterParams {
  filterCreators?: FilterCreator[]
  client: ZuoraClient
  config: ZuoraConfig
}

export default class ZuoraAdapter implements AdapterOperations {
  private createFiltersRunner: () => Required<Filter>
  private client: ZuoraClient
  private paginator: clientUtils.Paginator
  private userConfig: ZuoraConfig
  private fetchQuery: elementUtils.query.ElementQuery

  public constructor({ filterCreators = DEFAULT_FILTERS, client, config }: ZuoraAdapterParams) {
    this.userConfig = config
    this.client = client
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })
    this.paginator = paginator
    this.fetchQuery = elementUtils.query.createElementQuery(this.userConfig[FETCH_CONFIG], fetchCriteria)
    this.createFiltersRunner = () =>
      filtersRunner({ client, paginator, config, fetchQuery: this.fetchQuery }, filterCreators)
  }

  private apiDefinitions(parsedConfigs: Record<string, configUtils.RequestableTypeSwaggerConfig>): ZuoraApiConfig {
    return {
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
  }

  @logDuration('generating types from swagger')
  private async getSwaggerTypes(): Promise<elementUtils.swagger.ParsedTypes> {
    const config = _.cloneDeep(this.userConfig[API_DEFINITIONS_CONFIG])
    config.supportedTypes[LIST_ALL_SETTINGS_TYPE] = [LIST_ALL_SETTINGS_TYPE]
    return generateTypes(ZUORA_BILLING, config)
  }

  @logDuration('generating types for billing settings')
  private async getBillingSettingsTypes({
    parsedConfigs,
    allTypes,
  }: elementUtils.swagger.ParsedTypes): Promise<elementUtils.swagger.ParsedTypes> {
    if (!Object.keys(SETTING_TYPES).some(this.fetchQuery.isTypeMatch)) {
      return { allTypes: {}, parsedConfigs: {} }
    }

    const apiDefs = this.apiDefinitions(parsedConfigs)
    const settingsOpInfoInstances = await getAllInstances({
      paginator: this.paginator,
      objectTypes: _.pickBy(allTypes, isObjectType),
      apiConfig: apiDefs,
      supportedTypes: { ...SUPPORTED_TYPES, [LIST_ALL_SETTINGS_TYPE]: [LIST_ALL_SETTINGS_TYPE] },
      fetchQuery: { isTypeMatch: typeName => typeName === LIST_ALL_SETTINGS_TYPE },
    })
    if (_.isEmpty(settingsOpInfoInstances.elements)) {
      throw new Error('could not find any settings definitions - remove settingsFetchTypes and fetch again')
    }
    return generateBillingSettingsTypes(settingsOpInfoInstances.elements, apiDefs)
  }

  @logDuration('generating type and instances for standard objects')
  private async getStandardObjectElements({
    parsedConfigs,
    allTypes,
  }: elementUtils.swagger.ParsedTypes): Promise<Element[]> {
    const apiConfig = this.apiDefinitions(parsedConfigs)
    const standardObjectTypeName = getStandardObjectTypeName(apiConfig)
    if (standardObjectTypeName === undefined || !this.fetchQuery.isTypeMatch(standardObjectTypeName)) {
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
  ): Promise<fetchUtils.FetchElements<InstanceElement[]>> {
    // standard objects are not included in the swagger and need special handling - done in a filter
    const standardObjectTypeName = getStandardObjectTypeName(this.apiDefinitions(parsedConfigs))

    return getAllInstances({
      paginator: this.paginator,
      objectTypes: _.pickBy(allTypes, isObjectType),
      apiConfig: this.apiDefinitions(parsedConfigs),
      supportedTypes: this.userConfig[API_DEFINITIONS_CONFIG].supportedTypes,
      fetchQuery: {
        isTypeMatch: typeName => typeName !== standardObjectTypeName && this.fetchQuery.isTypeMatch(typeName),
      },
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

    const { elements: instances } = await this.getInstances(allTypes, parsedConfigs)
    const standardObjectElements = await this.getStandardObjectElements({ allTypes, parsedConfigs })

    const elements = [...Object.values(allTypes), ...instances, ...standardObjectElements]

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
