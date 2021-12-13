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
  FetchResult, AdapterOperations, DeployResult, Element, DeployModifiers,
  FetchOptions, DeployOptions, Change, getChangeElement, isAdditionChange, isInstanceChange,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  elements as elementUtils,
  deployment as deploymentUtils,
  config as configUtils,
} from '@salto-io/adapter-components'
import { logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import ZendeskClient from './client/client'
import { FilterCreator, Filter, filtersRunner } from './filter'
import { ZendeskConfig } from './config'
import { ZENDESK_SUPPORT } from './constants'
import changeValidator from './change_validator'
import { paginate } from './client/pagination'
import fieldReferencesFilter from './filters/field_references'
import unorderedListsFilter from './filters/unordered_lists'

const log = logger(module)
const { createPaginator } = clientUtils
const { findDataField, simpleGetArgs } = elementUtils
const { getAllElements } = elementUtils.ducktype
const { deployChange } = deploymentUtils

export const DEFAULT_FILTERS = [
  fieldReferencesFilter,
  // unorderedListsFilter should run after fieldReferencesFilter
  unorderedListsFilter,
]

export interface ZendeskAdapterParams {
  filterCreators?: FilterCreator[]
  client: ZendeskClient
  config: ZendeskConfig
}

export default class ZendeskAdapter implements AdapterOperations {
  private createFiltersRunner: () => Promise<Required<Filter>>
  private client: ZendeskClient
  private paginator: clientUtils.Paginator
  private userConfig: ZendeskConfig

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    config,
  }: ZendeskAdapterParams) {
    this.userConfig = config
    this.client = client
    this.paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })
    this.createFiltersRunner = async () => (
      filtersRunner({
        client: this.client,
        paginator: this.paginator,
        config: {
          fetch: config.fetch,
          apiDefinitions: config.apiDefinitions,
        },
      }, filterCreators)
    )
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<Element[]> {
    return getAllElements({
      adapterName: ZENDESK_SUPPORT,
      types: this.userConfig.apiDefinitions.types,
      includeTypes: this.userConfig.fetch.includeTypes,
      paginator: this.paginator,
      nestedFieldFinder: findDataField,
      computeGetArgs: simpleGetArgs,
      typeDefaults: this.userConfig.apiDefinitions.typeDefaults,
    })
  }

  /**
   * Fetch configuration elements in the given account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch zendesk account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types and instances' })
    const elements = await this.getElements()


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
      .map(change => ({
        action: change.action,
        data: _.mapValues(change.data, (element: Element) => element.clone()),
      })) as Change[]

    const runner = await this.createFiltersRunner()
    await runner.preDeploy(changesToDeploy)
    const { apiDefinitions } = this.userConfig
    const result = await Promise.all(
      changesToDeploy.map(async (change: Change): Promise<Change | Error> => {
        const { deployRequests, transformation } = apiDefinitions
          .types[getChangeElement(change).elemID.typeName]
        try {
          const response = await deployChange(
            change,
            this.client,
            deployRequests,
          )
          if (isAdditionChange(change) && isInstanceChange(change) && !Array.isArray(response)) {
            const transformationConfig = configUtils.getConfigWithDefault(
              transformation,
              apiDefinitions.typeDefaults.transformation,
            )
            const idField = transformationConfig.serviceIdField ?? 'id'
            const dataField = deployRequests?.add?.dataField
            getChangeElement(change).value.id = dataField
              ? (response[dataField] as Record<string, unknown>)[idField]
              : response[idField]
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
  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator,
    }
  }
}
