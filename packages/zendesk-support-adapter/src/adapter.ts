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
import {
  FetchResult, AdapterOperations, DeployResult, Element, DeployModifiers, FetchOptions,
  DeployOptions, Change, isInstanceChange, InstanceElement, getChangeData, ElemIdGetter,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  elements as elementUtils,
  deployment as deploymentUtils,
} from '@salto-io/adapter-components'
import { logDuration, resolveChangeElement, restoreChangeElement } from '@salto-io/adapter-utils'
import { collections, objects } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import ZendeskClient from './client/client'
import { FilterCreator, Filter, filtersRunner, FilterResult } from './filter'
import { API_DEFINITIONS_CONFIG, ZendeskConfig } from './config'
import { ZENDESK_SUPPORT } from './constants'
import createChangeValidator from './change_validator'
import { paginate } from './client/pagination'
import { getChangeGroupIds } from './group_change'
import fieldReferencesFilter, { lookupFunc } from './filters/field_references'
import unorderedListsFilter from './filters/unordered_lists'
import viewFilter from './filters/view'
import workspaceFilter from './filters/workspace'
import ticketFormOrderFilter from './filters/reorder/ticket_form'
import userFieldOrderFilter from './filters/reorder/user_field'
import organizationFieldOrderFilter from './filters/reorder/organization_field'
import workspaceOrderFilter from './filters/reorder/workspace'
import businessHoursScheduleFilter from './filters/business_hours_schedule'
import collisionErrorsFilter from './filters/collision_errors'
import accountSettingsFilter from './filters/account_settings'
import ticketFieldFilter from './filters/custom_field_options/ticket_field'
import userFieldFilter from './filters/custom_field_options/user_field'
import dynamicContentFilter from './filters/dynamic_content'
import restrictionFilter from './filters/restriction'
import organizationFieldFilter from './filters/organization_field'
import removeDefinitionInstancesFilter from './filters/remove_definition_instances'
import hardcodedChannelFilter from './filters/hardcoded_channel'
import usersFilter from './filters/user'
import addFieldOptionsFilter from './filters/add_field_options'
import appsFilter from './filters/app'
import routingAttributeFilter from './filters/routing_attribute'
import defaultDeployFilter from './filters/default_deploy'

const log = logger(module)
const { createPaginator } = clientUtils
const { findDataField, computeGetArgs } = elementUtils
const {
  getAllElements,
  replaceInstanceTypeForDeploy,
  restoreInstanceTypeFromDeploy,
} = elementUtils.ducktype
const { awu } = collections.asynciterable
const { concatObjects } = objects

export const DEFAULT_FILTERS = [
  ticketFieldFilter,
  userFieldFilter,
  viewFilter,
  workspaceFilter,
  ticketFormOrderFilter,
  userFieldOrderFilter,
  organizationFieldOrderFilter,
  workspaceOrderFilter,
  businessHoursScheduleFilter,
  collisionErrorsFilter,
  accountSettingsFilter,
  dynamicContentFilter,
  restrictionFilter,
  organizationFieldFilter,
  hardcodedChannelFilter,
  fieldReferencesFilter,
  appsFilter,
  usersFilter,
  routingAttributeFilter,
  addFieldOptionsFilter,
  // removeDefinitionInstancesFilter should be after hardcodedChannelFilter
  removeDefinitionInstancesFilter,
  // unorderedListsFilter should run after fieldReferencesFilter
  unorderedListsFilter,
  // defaultDeployFilter should be last!
  defaultDeployFilter,
]

const SKIP_RESOLVE_TYPE_NAMES = [
  'organization_field__custom_field_options',
]

export interface ZendeskAdapterParams {
  filterCreators?: FilterCreator[]
  client: ZendeskClient
  config: ZendeskConfig
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
}

export default class ZendeskAdapter implements AdapterOperations {
  private createFiltersRunner: () => Promise<Required<Filter>>
  private client: ZendeskClient
  private paginator: clientUtils.Paginator
  private userConfig: ZendeskConfig
  private getElemIdFunc?: ElemIdGetter

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    config,
  }: ZendeskAdapterParams) {
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    this.paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })
    this.createFiltersRunner = async () => (
      filtersRunner(
        {
          client: this.client,
          paginator: this.paginator,
          config: {
            fetch: config.fetch,
            apiDefinitions: config.apiDefinitions,
          },
        },
        filterCreators,
        concatObjects,
      )
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
      computeGetArgs,
      typeDefaults: this.userConfig.apiDefinitions.typeDefaults,
      getElemIdFunc: this.getElemIdFunc,
      hideTypes: this.userConfig.fetch.hideTypes,
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
    const result = await (await this.createFiltersRunner()).onFetch(elements) as FilterResult
    return { elements, errors: result ? result.errors : [] }
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const [instanceChanges, nonInstanceChanges] = _.partition(changeGroup.changes, isInstanceChange)
    if (nonInstanceChanges.length > 0) {
      log.warn(`We currently can't deploy types. Therefore, the following changes will not be deployed: ${
        nonInstanceChanges.map(elem => getChangeData(elem).elemID.getFullName()).join(', ')}`)
    }
    const changesToDeploy = instanceChanges
      .map(change => ({
        action: change.action,
        data: _.mapValues(change.data, (instance: InstanceElement) =>
          replaceInstanceTypeForDeploy({
            instance,
            config: this.userConfig[API_DEFINITIONS_CONFIG],
          })),
      })) as Change<InstanceElement>[]
    const runner = await this.createFiltersRunner()
    const resolvedChanges = await awu(changesToDeploy)
      .map(async change =>
        (SKIP_RESOLVE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName)
          ? change
          : resolveChangeElement(change, lookupFunc)))
      .toArray()
    await runner.preDeploy(resolvedChanges)
    const { deployResult } = await runner.deploy(resolvedChanges)
    const appliedChangesBeforeRestore = [...deployResult.appliedChanges]
    await runner.onDeploy(appliedChangesBeforeRestore)

    const sourceElements = _.keyBy(
      changesToDeploy.map(getChangeData),
      elem => elem.elemID.getFullName(),
    )

    const appliedChanges = await awu(appliedChangesBeforeRestore)
      .map(change => restoreChangeElement(change, sourceElements, lookupFunc))
      .toArray()
    const restoredAppliedChanges = restoreInstanceTypeFromDeploy({
      appliedChanges,
      originalInstanceChanges: instanceChanges,
    })
    return { appliedChanges: restoredAppliedChanges, errors: deployResult.errors }
  }

  // eslint-disable-next-line class-methods-use-this
  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator: createChangeValidator(
        this.userConfig[API_DEFINITIONS_CONFIG], ['organization_field__custom_field_options']
      ),
      dependencyChanger: deploymentUtils.dependency.removeStandaloneFieldDependency,
      getChangeGroupIds,
    }
  }
}
