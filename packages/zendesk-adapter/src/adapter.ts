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
  FetchResult, AdapterOperations, DeployResult, DeployModifiers, FetchOptions,
  DeployOptions, Change, isInstanceChange, InstanceElement, getChangeData, ElemIdGetter,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  elements as elementUtils,
} from '@salto-io/adapter-components'
import { logDuration, resolveChangeElement, resolveValues, restoreChangeElement, restoreValues } from '@salto-io/adapter-utils'
import { collections, objects } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import ZendeskClient from './client/client'
import { FilterCreator, Filter, filtersRunner, FilterResult } from './filter'
import { API_DEFINITIONS_CONFIG, FETCH_CONFIG, ZendeskConfig } from './config'
import { ZENDESK } from './constants'
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
import slaPolicyOrderFilter from './filters/reorder/sla_policy'
import automationOrderFilter from './filters/reorder/automation'
import triggerOrderFilter from './filters/reorder/trigger'
import viewOrderFilter from './filters/reorder/view'
import businessHoursScheduleFilter from './filters/business_hours_schedule'
import collisionErrorsFilter from './filters/collision_errors'
import accountSettingsFilter from './filters/account_settings'
import ticketFieldFilter from './filters/custom_field_options/ticket_field'
import userFieldFilter from './filters/custom_field_options/user_field'
import dynamicContentFilter from './filters/dynamic_content'
import dynamicContentReferencesFilter from './filters/dynamic_content_references'
import restrictionFilter from './filters/restriction'
import organizationFieldFilter from './filters/organization_field'
import removeDefinitionInstancesFilter from './filters/remove_definition_instances'
import hardcodedChannelFilter from './filters/hardcoded_channel'
import usersFilter from './filters/user'
import addFieldOptionsFilter from './filters/add_field_options'
import appOwnedConvertListToMapFilter from './filters/app_owned_convert_list_to_map'
import appsFilter from './filters/app'
import routingAttributeFilter from './filters/routing_attribute'
import serviceUrlFilter from './filters/service_url'
import slaPolicyFilter from './filters/sla_policy'
import macroAttachmentsFilter from './filters/macro_attachments'
import omitInactiveFilter from './filters/omit_inactive'
import tagsFilter from './filters/tag'
import webhookFilter from './filters/webhook'
import targetFilter from './filters/target'
import defaultDeployFilter from './filters/default_deploy'
import ducktypeCommonFilters from './filters/ducktype_common'
import handleTemplateExpressionFilter from './filters/handle_template_expressions'
import handleAppInstallationsFilter from './filters/handle_app_installations'
import referencedIdFieldsFilter from './filters/referenced_id_fields'
import brandLogoFilter from './filters/brand_logo'
import removeBrandLogoFieldFilter from './filters/remove_brand_logo_field'
import { getConfigFromConfigChanges } from './config_change'
import { dependencyChanger } from './dependency_changers'

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
  // omitInactiveFilter should be before:
  //  order filters, collisionErrorsFilter and fieldReferencesFilter
  omitInactiveFilter,
  ticketFormOrderFilter,
  userFieldOrderFilter,
  organizationFieldOrderFilter,
  workspaceOrderFilter,
  slaPolicyOrderFilter,
  automationOrderFilter,
  triggerOrderFilter,
  viewOrderFilter,
  businessHoursScheduleFilter,
  collisionErrorsFilter,
  accountSettingsFilter,
  dynamicContentFilter,
  restrictionFilter,
  organizationFieldFilter,
  hardcodedChannelFilter,
  // removeDefinitionInstancesFilter should be after hardcodedChannelFilter
  removeDefinitionInstancesFilter,
  // fieldReferencesFilter should be after usersFilter, macroAttachmentsFilter and tagsFilter
  usersFilter,
  tagsFilter,
  macroAttachmentsFilter,
  brandLogoFilter,
  // removeBrandLogoFieldFilter should be after brandLogoFilter
  removeBrandLogoFieldFilter,
  fieldReferencesFilter,
  appsFilter,
  appOwnedConvertListToMapFilter,
  slaPolicyFilter,
  routingAttributeFilter,
  addFieldOptionsFilter,
  webhookFilter,
  targetFilter,
  // unorderedListsFilter should run after fieldReferencesFilter
  unorderedListsFilter,
  dynamicContentReferencesFilter,
  referencedIdFieldsFilter,
  serviceUrlFilter,
  ...ducktypeCommonFilters,
  handleAppInstallationsFilter,
  handleTemplateExpressionFilter,
  // defaultDeployFilter should be last!
  defaultDeployFilter,
]

const SKIP_RESOLVE_TYPE_NAMES = [
  'organization_field__custom_field_options',
  'macro',
  'macro_attachment',
]

export interface ZendeskAdapterParams {
  filterCreators?: FilterCreator[]
  client: ZendeskClient
  config: ZendeskConfig
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
  configInstance?: InstanceElement
}

export default class ZendeskAdapter implements AdapterOperations {
  private createFiltersRunner: () => Promise<Required<Filter>>
  private client: ZendeskClient
  private paginator: clientUtils.Paginator
  private userConfig: ZendeskConfig
  private getElemIdFunc?: ElemIdGetter
  private configInstance?: InstanceElement
  private fetchQuery: elementUtils.query.ElementQuery

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    config,
    configInstance,
  }: ZendeskAdapterParams) {
    this.userConfig = config
    this.configInstance = configInstance
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    this.paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })

    this.fetchQuery = elementUtils.query.createElementQuery(this.userConfig[FETCH_CONFIG])

    this.createFiltersRunner = async () => (
      filtersRunner(
        {
          client: this.client,
          paginator: this.paginator,
          config: {
            fetch: config.fetch,
            apiDefinitions: config.apiDefinitions,
          },
          getElemIdFunc,
          fetchQuery: this.fetchQuery,
        },
        filterCreators,
        concatObjects,
      )
    )
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<ReturnType<typeof getAllElements>> {
    return getAllElements({
      adapterName: ZENDESK,
      types: this.userConfig.apiDefinitions.types,
      supportedTypes: this.userConfig.apiDefinitions.supportedTypes,
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
    log.debug('going to fetch zendesk account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types and instances' })
    const { elements, configChanges } = await this.getElements()

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    const result = await (await this.createFiltersRunner()).onFetch(elements) as FilterResult
    const updatedConfig = this.configInstance
      ? getConfigFromConfigChanges(configChanges, this.configInstance)
      : undefined
    return { elements, errors: result ? result.errors : [], updatedConfig }
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
          : resolveChangeElement(
            change,
            lookupFunc,
            async (element, getLookUpName, elementsSource) =>
              resolveValues(element, getLookUpName, elementsSource, true),
          )))
      .toArray()
    await runner.preDeploy(resolvedChanges)
    const { deployResult } = await runner.deploy(resolvedChanges)
    const appliedChangesBeforeRestore = [...deployResult.appliedChanges]
    await runner.onDeploy(appliedChangesBeforeRestore)

    const sourceChanges = _.keyBy(
      changesToDeploy,
      change => getChangeData(change).elemID.getFullName(),
    )

    const appliedChanges = await awu(appliedChangesBeforeRestore)
      .map(change => restoreChangeElement(
        change,
        sourceChanges,
        lookupFunc,
        async (source, targetElement, getLookUpName) =>
          restoreValues(source, targetElement, getLookUpName, true),
      ))
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
      changeValidator: createChangeValidator({
        client: this.client,
        apiConfig: this.userConfig[API_DEFINITIONS_CONFIG],
        typesDeployedViaParent: ['organization_field__custom_field_options', 'macro_attachment', 'brand_logo'],
        typesWithNoDeploy: ['tag'],
      }),
      dependencyChanger,
      getChangeGroupIds,
    }
  }
}
