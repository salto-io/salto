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
import _, { isString } from 'lodash'
import {
  AdapterOperations,
  Change,
  DeployModifiers,
  DeployOptions,
  DeployResult,
  Element,
  ElemIdGetter,
  FetchOptions,
  FetchResult,
  FixElementsFunc,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression, isSaltoError,
  ReadOnlyElementsSource,
  SaltoError,
} from '@salto-io/adapter-api'
import { client as clientUtils, combineElementFixers, config as configUtils, definitions, elements as elementUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import {
  getElemIdFuncWrapper,
  inspectValue,
  logDuration,
  resolveChangeElement,
  resolveValues,
  restoreChangeElement,
} from '@salto-io/adapter-utils'
import { collections, objects } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import ZendeskClient from './client/client'
import { BrandIdToClient, Filter, FilterCreator, FilterResult, filtersRunner } from './filter'
import {
  API_DEFINITIONS_CONFIG,
  CLIENT_CONFIG,
  configType,
  DEPLOY_CONFIG,
  FETCH_CONFIG,
  GUIDE_BRAND_SPECIFIC_TYPES,
  GUIDE_SUPPORTED_TYPES,
  GUIDE_TYPES_TO_HANDLE_BY_BRAND,
  isGuideEnabled,
  isGuideThemesEnabled,
  ZendeskConfig,
} from './config'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  BRAND_LOGO_TYPE_NAME,
  BRAND_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME,
  DEFAULT_CUSTOM_STATUSES_TYPE_NAME,
  GUIDE_THEME_TYPE_NAME,
  THEME_SETTINGS_TYPE_NAME,
  ZENDESK,
} from './constants'
import { getBrandsForGuide } from './filters/utils'
import { GUIDE_ORDER_TYPES } from './filters/guide_order/guide_order_utils'
import createChangeValidator from './change_validator'
import { paginate } from './client/pagination'
import fetchCriteria from './fetch_criteria'
import { getChangeGroupIds } from './group_change'
import fieldReferencesFilter, { lookupFunc } from './filters/field_references'
import listValuesMissingReferencesFilter from './filters/references/list_values_missing_references'
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
import omitCollisionFilter from './filters/omit_collision'
import accountSettingsFilter from './filters/account_settings'
import ticketFieldFilter from './filters/custom_field_options/ticket_field'
import userFieldFilter from './filters/custom_field_options/user_field'
import dynamicContentFilter from './filters/dynamic_content'
import dynamicContentReferencesFilter from './filters/dynamic_content_references'
import restrictionFilter from './filters/restriction'
import organizationFieldFilter from './filters/custom_field_options/organization_field'
import removeDefinitionInstancesFilter from './filters/remove_definition_instances'
import hardcodedChannelFilter from './filters/hardcoded_channel'
import usersFilter from './filters/user'
import addFieldOptionsFilter from './filters/add_field_options'
import appOwnedConvertListToMapFilter from './filters/app_owned_convert_list_to_map'
import appInstallationsFilter from './filters/app_installations'
import routingAttributeFilter from './filters/routing_attribute'
import serviceUrlFilter from './filters/service_url'
import slaPolicyFilter from './filters/sla_policy'
import macroAttachmentsFilter from './filters/macro_attachments'
import tagsFilter from './filters/tag'
import guideLocalesFilter from './filters/guide_locale'
import webhookFilter from './filters/webhook'
import targetFilter from './filters/target'
import defaultDeployFilter from './filters/default_deploy'
import commonFilters from './filters/common'
import handleTemplateExpressionFilter from './filters/handle_template_expressions'
import handleAppInstallationsFilter from './filters/handle_app_installations'
import brandLogoFilter from './filters/brand_logo'
import articleFilter from './filters/article/article'
import articleBodyFilter from './filters/article/article_body'
import { dependencyChanger } from './dependency_changers'
import deployBrandedGuideTypesFilter from './filters/deploy_branded_guide_types'
import { Credentials } from './auth'
import guideSectionCategoryFilter from './filters/guide_section_and_category'
import guideTranslationFilter from './filters/guide_translation'
import guideThemeFilter from './filters/guide_theme'
import fetchCategorySection from './filters/guide_fetch_article_section_and_category'
import guideParentSection, { addParentFields } from './filters/guide_parent_to_section'
import guideGuideSettings from './filters/guide_guide_settings'
import removeBrandLogoFilter from './filters/remove_brand_logo_field'
import categoryOrderFilter from './filters/guide_order/category_order'
import sectionOrderFilter from './filters/guide_order/section_order'
import articleOrderFilter from './filters/guide_order/article_order'
import guideServiceUrl from './filters/guide_service_url'
import everyoneUserSegmentFilter from './filters/everyone_user_segment'
import guideArrangePaths from './filters/guide_arrange_paths'
import guideDefaultLanguage from './filters/guide_default_language_settings'
import guideAddBrandToArticleTranslation from './filters/guide_add_brand_to_translation'
import ticketFormDeploy from './filters/ticket_form'
import supportAddress from './filters/support_address'
import customStatus from './filters/custom_statuses'
import organizationsFilter from './filters/organizations'
import hideAccountFeatures from './filters/hide_account_features'
import auditTimeFilter from './filters/audit_logs'
import sideConversationsFilter from './filters/side_conversation'
import { isCurrentUserResponse } from './user_utils'
import addAliasFilter from './filters/add_alias'
import macroFilter from './filters/macro'
import customRoleDeployFilter from './filters/custom_role_deploy'
import routingAttributeValueDeployFilter from './filters/routing_attribute_value'
import localeFilter from './filters/locale'
import ticketStatusCustomStatusDeployFilter from './filters/ticket_status_custom_status'
import { filterOutInactiveInstancesForType } from './inactive'
import handleIdenticalAttachmentConflicts from './filters/handle_identical_attachment_conflicts'
import addImportantValuesFilter from './filters/add_important_values'
import customObjectFilter from './filters/custom_objects/custom_object'
import customObjectFieldFilter from './filters/custom_objects/custom_object_fields'
import customObjectFieldsOrderFilter from './filters/custom_objects/custom_object_fields_order'
import customObjectFieldOptionsFilter from './filters/custom_field_options/custom_object_field_options'
import { createFixElementFunctions } from './fix_elements'
import guideThemeSettingFilter from './filters/guide_theme_settings'

const { makeArray } = collections.array
const log = logger(module)
const { createPaginator } = clientUtils
const { findDataField } = elementUtils
const { computeGetArgs } = fetchUtils.resource
const {
  getAllElements,
  replaceInstanceTypeForDeploy,
  restoreInstanceTypeFromDeploy,
  getEntriesResponseValues,
  addRemainingTypes,
} = elementUtils.ducktype
const { awu } = collections.asynciterable
const { concatObjects } = objects
const SECTIONS_TYPE_NAME = 'sections'

export const DEFAULT_FILTERS = [
  ticketStatusCustomStatusDeployFilter,
  ticketFieldFilter,
  userFieldFilter,
  viewFilter,
  workspaceFilter,
  ticketFormOrderFilter,
  userFieldOrderFilter,
  organizationFieldOrderFilter,
  workspaceOrderFilter,
  slaPolicyOrderFilter,
  automationOrderFilter,
  triggerOrderFilter,
  viewOrderFilter,
  businessHoursScheduleFilter,
  accountSettingsFilter,
  dynamicContentFilter,
  restrictionFilter,
  organizationFieldFilter,
  hardcodedChannelFilter,
  auditTimeFilter, // needs to be before userFilter as it uses the ids of the users
  // removeDefinitionInstancesFilter should be after hardcodedChannelFilter
  removeDefinitionInstancesFilter,
  usersFilter,
  organizationsFilter,
  tagsFilter,
  localeFilter,
  // supportAddress should run before referencedIdFieldsFilter
  supportAddress,
  customStatus,
  guideAddBrandToArticleTranslation,
  macroFilter,
  macroAttachmentsFilter,
  ticketFormDeploy,
  customRoleDeployFilter,
  sideConversationsFilter,
  brandLogoFilter,
  // removeBrandLogoFilter should be after brandLogoFilter
  removeBrandLogoFilter,
  categoryOrderFilter,
  sectionOrderFilter,
  articleOrderFilter,
  // help center filters need to be before fieldReferencesFilter (assume fields are strings)
  // everyoneUserSegmentFilter needs to be before articleFilter
  everyoneUserSegmentFilter,
  articleFilter,
  guideSectionCategoryFilter,
  guideTranslationFilter,
  guideGuideSettings,
  guideDefaultLanguage, // needs to be after guideGuideSettings
  guideServiceUrl,
  guideLocalesFilter, // Needs to be after guideServiceUrl
  customObjectFilter,
  customObjectFieldsOrderFilter,
  customObjectFieldOptionsFilter,
  customObjectFieldFilter, // need to be after customObjectFieldOptionsFilter
  // fieldReferencesFilter should be after:
  // usersFilter, macroAttachmentsFilter, tagsFilter, guideLocalesFilter, customObjectFilter, customObjectFieldFilter
  fieldReferencesFilter,
  // listValuesMissingReferencesFilter should be after fieldReferencesFilter
  listValuesMissingReferencesFilter,
  appInstallationsFilter,
  appOwnedConvertListToMapFilter,
  slaPolicyFilter,
  routingAttributeFilter,
  routingAttributeValueDeployFilter,
  addFieldOptionsFilter,
  webhookFilter,
  targetFilter,
  // unorderedListsFilter should run after fieldReferencesFilter
  unorderedListsFilter,
  dynamicContentReferencesFilter,
  guideParentSection,
  serviceUrlFilter,
  // referencedIdFieldsFilter and queryFilter should run after element references are resolved
  ...Object.values(commonFilters),
  handleAppInstallationsFilter,
  handleTemplateExpressionFilter,
  articleBodyFilter, // needs to be after handleTemplateExpressionFilter
  // handleIdenticalAttachmentConflicts needs to be before collisionErrorsFilter and after referencedIdFieldsFilter
  // and articleBodyFilter
  handleIdenticalAttachmentConflicts,
  omitCollisionFilter, // needs to be after referencedIdFieldsFilter (which is part of the common filters)
  deployBrandedGuideTypesFilter,
  guideThemeFilter, // fetches a lot of data, so should be after omitCollisionFilter to remove theme collisions
  guideThemeSettingFilter, // needs to be after guideThemeFilter as it depends on successful theme fetches
  addAliasFilter, // should run after fieldReferencesFilter and guideThemeSettingFilter
  guideArrangePaths,
  hideAccountFeatures,
  fetchCategorySection, // need to be after arrange paths as it uses the 'name'/'title' field
  addImportantValuesFilter,
  // defaultDeployFilter should be last!
  defaultDeployFilter,
]

const SKIP_RESOLVE_TYPE_NAMES = [
  'organization_field__custom_field_options',
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  'macro',
  'macro_attachment',
  'brand_logo',
  ...GUIDE_ORDER_TYPES,
]

/**
 * Fetch Guide (help_center) elements of brand.
*/
const zendeskGuideEntriesFunc = (
  brandInstance: InstanceElement,
): elementUtils.ducktype.EntriesRequester => {
  const getZendeskGuideEntriesResponseValues = async ({
    paginator,
    args,
    typeName,
    typesConfig,
  }: {
    paginator: clientUtils.Paginator
    args: clientUtils.ClientGetWithPaginationParams
    typeName?: string
    typesConfig?: Record<string, configUtils.TypeDuckTypeConfig>
  }): Promise<clientUtils.ResponseValue[]> => {
    if (typeName === undefined || typesConfig === undefined) {
      return []
    }
    log.debug(`Fetching type ${typeName} entries for brand ${brandInstance.elemID.name}`)
    const brandPaginatorResponseValues = (await getEntriesResponseValues({
      paginator,
      args,
      typeName,
      typesConfig,
    })).flat()
    const responseEntryName = typesConfig[typeName].transformation?.dataField
    return brandPaginatorResponseValues.flatMap(response => {
      if (responseEntryName === undefined) {
        return makeArray(response)
      }
      const responseEntries = makeArray(
        (responseEntryName !== definitions.DATA_FIELD_ENTIRE_OBJECT)
          ? response[responseEntryName]
          : response
      ) as clientUtils.ResponseValue[]
      // Defining Zendesk Guide element to its corresponding brand (= subdomain)
      responseEntries.forEach(entry => {
        entry.brand = brandInstance.value.id
      })
      // need to add direct parent to a section as it is possible to have a section inside
      // a section and therefore the elemeID will change accordingly.
      if (responseEntryName === SECTIONS_TYPE_NAME) {
        responseEntries.forEach(entry => {
          addParentFields(entry)
        })
      }
      if (responseEntryName === definitions.DATA_FIELD_ENTIRE_OBJECT) {
        return responseEntries
      }
      return {
        ...response,
        [responseEntryName]: responseEntries,
      }
    }) as clientUtils.ResponseValue[]
  }

  return getZendeskGuideEntriesResponseValues
}

const getBrandsFromElementsSourceNoCache = async (
  elementsSource: ReadOnlyElementsSource
): Promise<InstanceElement[]> => (
  awu(await elementsSource.list())
    .filter(id => id.typeName === BRAND_TYPE_NAME && id.idType === 'instance')
    .map(id => elementsSource.get(id))
    .filter(isInstanceElement)
    .toArray()
)

/**
 * Fetch Guide (help_center) elements for the given brands.
 * Each help_center requires a different paginator.
*/
const getGuideElements = async ({
  brandsList,
  brandToPaginator,
  apiDefinitions,
  fetchQuery,
  getElemIdFunc,
}: {
  brandsList: InstanceElement[]
  brandToPaginator: Record<string, clientUtils.Paginator>
  apiDefinitions: configUtils.AdapterDuckTypeApiConfig
  fetchQuery: elementUtils.query.ElementQuery
  getElemIdFunc?: ElemIdGetter
}): Promise<elementUtils.FetchElements<Element[]>> => {
  const transformationDefaultConfig = apiDefinitions.typeDefaults.transformation
  const transformationConfigByType = configUtils.getTransformationConfigByType(apiDefinitions.types)

  // Omit standaloneFields from config to avoid creating types from references
  const typesConfigWithNoStandaloneFields = _.mapValues(apiDefinitions.types, config => _.omit(config, ['transformation.standaloneFields']))
  const fetchResultWithDuplicateTypes = await Promise.all(brandsList.map(async brandInstance => {
    const brandsPaginator = brandToPaginator[brandInstance.elemID.name]
    log.debug(`Fetching elements for brand ${brandInstance.elemID.name}`)
    return getAllElements({
      adapterName: ZENDESK,
      types: typesConfigWithNoStandaloneFields,
      shouldAddRemainingTypes: false,
      supportedTypes: GUIDE_BRAND_SPECIFIC_TYPES,
      fetchQuery,
      paginator: brandsPaginator,
      nestedFieldFinder: findDataField,
      computeGetArgs,
      typeDefaults: apiDefinitions.typeDefaults,
      getElemIdFunc,
      getEntriesResponseValuesFunc: zendeskGuideEntriesFunc(brandInstance),
    })
  }))

  const typeNameToGuideInstances = _.groupBy(
    fetchResultWithDuplicateTypes.flatMap(result => result.elements).filter(isInstanceElement),
    instance => instance.elemID.typeName
  )
  // Create new types based on the created instances from all brands,
  // then create new instances with the corresponding type as refType
  const zendeskGuideElements = Object.entries(typeNameToGuideInstances).flatMap(([typeName, instances]) => {
    const guideElements = elementUtils.ducktype.getNewElementsFromInstances({
      adapterName: ZENDESK,
      typeName,
      instances,
      transformationConfigByType,
      transformationDefaultConfig,
    })
    return _.concat(guideElements.instances as Element[], guideElements.nestedTypes, guideElements.type)
  })

  // Create instances from standalone fields that were not created in previous steps
  await elementUtils.ducktype.extractStandaloneFields({
    adapterName: ZENDESK,
    elements: zendeskGuideElements,
    transformationConfigByType,
    transformationDefaultConfig,
    getElemIdFunc,
  })

  const allConfigChangeSuggestions = fetchResultWithDuplicateTypes
    .flatMap(fetchResult => fetchResult.configChanges ?? [])
  const guideErrors = fetchResultWithDuplicateTypes.flatMap(fetchResult => fetchResult.errors ?? [])
  return {
    elements: zendeskGuideElements,
    configChanges: elementUtils.ducktype.getUniqueConfigSuggestions(allConfigChangeSuggestions),
    errors: guideErrors,
  }
}

export interface ZendeskAdapterParams {
  filterCreators?: FilterCreator[]
  client: ZendeskClient
  credentials: Credentials
  config: ZendeskConfig
  elementsSource: ReadOnlyElementsSource
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
  configInstance?: InstanceElement
}

export default class ZendeskAdapter implements AdapterOperations {
  private client: ZendeskClient
  private paginator: clientUtils.Paginator
  private userConfig: ZendeskConfig
  private getElemIdFunc?: ElemIdGetter
  private configInstance?: InstanceElement
  private elementsSource: ReadOnlyElementsSource
  private fetchQuery: elementUtils.query.ElementQuery
  private logIdsFunc?: () => void
  private fixElementsFunc: FixElementsFunc
  private createClientBySubdomain: (subdomain: string, deployRateLimit?: boolean) => ZendeskClient
  private getClientBySubdomain: (subdomain: string, deployRateLimit?: boolean) => ZendeskClient
  private brandsList: Promise<InstanceElement[]> | undefined
  private createFiltersRunner: ({
    filterRunnerClient,
    paginator,
    brandIdToClient,
  }: {
    filterRunnerClient?: ZendeskClient
    paginator?: clientUtils.Paginator
    brandIdToClient?: BrandIdToClient
  }) => Promise<Required<Filter>>

  public constructor({
    filterCreators = DEFAULT_FILTERS as FilterCreator[],
    client,
    credentials,
    getElemIdFunc,
    config,
    configInstance,
    elementsSource,
  }: ZendeskAdapterParams) {
    const wrapper = getElemIdFunc ? getElemIdFuncWrapper(getElemIdFunc) : undefined
    this.userConfig = config
    this.configInstance = configInstance
    this.getElemIdFunc = wrapper?.getElemIdFunc
    this.logIdsFunc = wrapper?.logIdsFunc
    this.client = client
    this.elementsSource = elementsSource
    this.brandsList = undefined
    this.paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })

    this.createClientBySubdomain = (subdomain: string, deployRateLimit = false): ZendeskClient => {
      const clientConfig = { ...this.userConfig[CLIENT_CONFIG] }
      if (deployRateLimit) {
        // Concurrent requests with Guide elements may cause 409 errors (SALTO-2961)
        Object.assign(clientConfig, { rateLimit: { deploy: 1 } })
      }
      return new ZendeskClient({
        credentials: { ...credentials, subdomain },
        config: clientConfig,
        allowOrganizationNames: this.userConfig[FETCH_CONFIG].resolveOrganizationIDs,
      })
    }

    const clientsBySubdomain: Record<string, ZendeskClient> = {}
    this.getClientBySubdomain = (subdomain: string, deployRateLimit = false): ZendeskClient => {
      if (clientsBySubdomain[subdomain] === undefined) {
        clientsBySubdomain[subdomain] = this.createClientBySubdomain(subdomain, deployRateLimit)
      }
      return clientsBySubdomain[subdomain]
    }


    this.fetchQuery = elementUtils.query.createElementQuery(
      this.userConfig[FETCH_CONFIG],
      fetchCriteria,
    )

    this.createFiltersRunner = async ({
      filterRunnerClient,
      paginator,
      brandIdToClient = {},
    }: {
      filterRunnerClient?: ZendeskClient
      paginator?: clientUtils.Paginator
      brandIdToClient?: BrandIdToClient
    }) => (
      filtersRunner(
        {
          client: filterRunnerClient ?? this.client,
          paginator: paginator ?? this.paginator,
          config,
          getElemIdFunc: this.getElemIdFunc,
          fetchQuery: this.fetchQuery,
          elementsSource,
          brandIdToClient,
        },
        filterCreators,
        concatObjects,
      )
    )

    this.fixElementsFunc = combineElementFixers(createFixElementFunctions({
      client,
      config,
      elementsSource,
    }))
  }

  private filterSupportedTypes(): Record<string, string[]> {
    const isGuideEnabledInConfig = isGuideEnabled(this.userConfig[FETCH_CONFIG])
    const isGuideThemesEnabledInConfig = isGuideThemesEnabled(this.userConfig[FETCH_CONFIG])
    const keysToOmit = isGuideEnabledInConfig
      ? Object.keys(GUIDE_BRAND_SPECIFIC_TYPES) : Object.keys(GUIDE_SUPPORTED_TYPES)
    if (!isGuideThemesEnabledInConfig) {
      keysToOmit.push(GUIDE_THEME_TYPE_NAME)
    }
    const { supportedTypes: allSupportedTypes } = this.userConfig.apiDefinitions
    return _.omit(allSupportedTypes, ...keysToOmit)
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<ReturnType<typeof getAllElements>> {
    const isGuideEnabledInConfig = isGuideEnabled(this.userConfig[FETCH_CONFIG])
    const isGuideInFetch = isGuideEnabledInConfig && !_.isEmpty(this.userConfig[FETCH_CONFIG].guide?.brands)
    const supportedTypes = this.filterSupportedTypes()
    // Zendesk Support and (if enabled) global Zendesk Guide types
    const defaultSubdomainResult = await getAllElements({
      adapterName: ZENDESK,
      types: this.userConfig.apiDefinitions.types,
      shouldAddRemainingTypes: !isGuideInFetch,
      // tags are "fetched" in a filter
      supportedTypes: _.omit(supportedTypes, 'tag'),
      fetchQuery: this.fetchQuery,
      paginator: this.paginator,
      nestedFieldFinder: findDataField,
      computeGetArgs,
      typeDefaults: this.userConfig.apiDefinitions.typeDefaults,
      getElemIdFunc: this.getElemIdFunc,
      customInstanceFilter: filterOutInactiveInstancesForType(this.userConfig),
    })

    if (!isGuideInFetch) {
      return defaultSubdomainResult
    }

    const combinedRes = {
      configChanges: (defaultSubdomainResult.configChanges ?? []),
      elements: defaultSubdomainResult.elements,
      errors: (defaultSubdomainResult.errors ?? []),
    }

    const brandsList = getBrandsForGuide(
      defaultSubdomainResult.elements.filter(isInstanceElement),
      this.userConfig[FETCH_CONFIG]
    )

    if (_.isEmpty(brandsList)) {
      const brandPatterns = Array.from(this.userConfig[FETCH_CONFIG].guide?.brands ?? []).join(', ')
      const message = `Could not find any brands matching the included patterns: [${brandPatterns}]. Please update the configuration under fetch.guide.brands in the configuration file`
      log.warn(message)
      combinedRes.errors = (combinedRes.errors).concat([{
        message,
        severity: 'Warning',
      }])
    } else {
      const brandToPaginator = Object.fromEntries(brandsList.map(brandInstance => (
        [
          brandInstance.elemID.name,
          createPaginator({
            client: this.createClientBySubdomain(brandInstance.value.subdomain),
            paginationFuncCreator: paginate,
          }),
        ]
      )))

      const zendeskGuideElements = await getGuideElements({
        brandsList,
        brandToPaginator,
        apiDefinitions: this.userConfig[API_DEFINITIONS_CONFIG],
        fetchQuery: this.fetchQuery,
        getElemIdFunc: this.getElemIdFunc,
      })

      combinedRes.configChanges = combinedRes.configChanges.concat(zendeskGuideElements.configChanges ?? [])
      combinedRes.elements = combinedRes.elements.concat(zendeskGuideElements.elements)
      combinedRes.errors = combinedRes.errors.concat(zendeskGuideElements.errors ?? [])
    }

    // Remaining types should be added once to avoid overlaps between the generated elements,
    // so we add them once after all elements are generated
    addRemainingTypes({
      adapterName: ZENDESK,
      elements: combinedRes.elements,
      typesConfig: this.userConfig.apiDefinitions.types,
      supportedTypes: _.merge(supportedTypes, GUIDE_BRAND_SPECIFIC_TYPES),
      typeDefaultConfig: this.userConfig.apiDefinitions.typeDefaults,
    })

    return combinedRes
  }

  private async isLocaleEnUs(): Promise<SaltoError | undefined> {
    try {
      const res = (await this.client.get({
        url: '/api/v2/users/me',
      })).data
      if (isCurrentUserResponse(res)) {
        if (res.user.locale !== 'en-US') {
          return {
            message: 'You are fetching zendesk with a user whose locale is set to a language different than US English. This may affect Salto\'s behavior in some cases. Therefore, it is highly recommended to set the user\'s language to "English (United States)" or to create another user with English as its Zendesk language and change Salto‘s credentials to use it. For help on how to change a Zendesk user\'s language, go to https://support.zendesk.com/hc/en-us/articles/4408835022490-Viewing-and-editing-your-user-profile-in-Zendesk-Support',
            severity: 'Warning',
          }
        }
        return undefined
      }
      log.error('could not verify fetching user\'s locale is set to en-US. received invalid response')
    } catch (e) {
      log.error(`could not verify fetching user's locale is set to en-US'. error: ${e}`)
    }
    return undefined
  }

  private async logSubscriptionData(): Promise<void> {
    try {
      const { data } = await this.client.get({ url: '/api/v2/account/subscription.json' })
      const subscriptionData = !_.isArray(data) ? data.subscription : undefined
      if (subscriptionData) {
        log.info(`Account subscription data: ${inspectValue(subscriptionData)}`)
      } else {
        log.info(`Account subscription data invalid: ${inspectValue(data)}`)
      }
      // This log is not crucial for the fetch to succeed, so we don't want to fail the fetch if it fails
    } catch (e) {
      if (e.response?.status === 422) {
        log.info('Account subscription data unavailable because this is a sandbox environment')
      } else {
        log.info(`Account subscription data unavailable because of an error ${inspectValue(e)}`)
      }
    }
  }

  /**
   * Fetch configuration elements in the given account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch zendesk account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types and instances' })
    await this.logSubscriptionData()
    const localeError = await this.isLocaleEnUs()
    const { elements, configChanges, errors } = await this.getElements()
    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    const brandsWithHelpCenter = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
      .filter(brandInstance => brandInstance.value.has_help_center)
    const brandIdToClient = Object.fromEntries(brandsWithHelpCenter.map(
      brandInstance => [
        brandInstance.value.id,
        this.createClientBySubdomain(brandInstance.value.subdomain),
      ]
    ))
    // This exposes different subdomain clients for Guide related types filters
    const result = await (await this.createFiltersRunner({ brandIdToClient }))
      .onFetch(elements) as FilterResult
    const updatedConfig = this.configInstance && configChanges
      ? configUtils.getUpdatedCofigFromConfigChanges({
        configChanges,
        currentConfig: this.configInstance,
        configType,
      }) : undefined

    const fetchErrors = (errors ?? []).concat(result.errors ?? []).concat(localeError ?? [])
    if (this.logIdsFunc !== undefined) {
      this.logIdsFunc()
    }
    return { elements, errors: fetchErrors, updatedConfig }
  }

  private getBrandsFromElementsSource(): Promise<InstanceElement[]> {
    if (this.brandsList === undefined) {
      this.brandsList = getBrandsFromElementsSourceNoCache(this.elementsSource)
    }
    return this.brandsList
  }

  private async deployGuideChanges(guideResolvedChanges: Change<InstanceElement>[]): Promise<DeployResult[]> {
    if (_.isEmpty(guideResolvedChanges)) {
      return []
    }
    const brandsList = await this.getBrandsFromElementsSource()
    log.debug('Found %d brands to handle %d guide changes', brandsList.length, guideResolvedChanges.length)
    const resolvedBrandIdToSubdomain = Object.fromEntries(brandsList.map(
      brandInstance => [brandInstance.value.id, brandInstance.value.subdomain]
    ))
    const subdomainToGuideChanges = _.groupBy(
      guideResolvedChanges,
      change => {
        const { brand } = getChangeData(change).value
        // If the change was in SKIP_RESOLVE_TYPE_NAMES, brand is a reference expression
        return resolvedBrandIdToSubdomain[isReferenceExpression(brand) ? brand.value.value.id : brand]
      }
    )
    const subdomainsList = brandsList
      .map(brandInstance => brandInstance.value.subdomain)
      .filter(isString)
    const subdomainToClient = Object.fromEntries(subdomainsList
      .filter(subdomain => subdomainToGuideChanges[subdomain] !== undefined)
      .map(subdomain => ([subdomain, this.getClientBySubdomain(subdomain, true)])))
    try {
      return await awu(Object.entries(subdomainToClient))
        .map(async ([subdomain, client]) => {
          const brandRunner = await this.createFiltersRunner({
            filterRunnerClient: client,
            paginator: createPaginator({
              client,
              paginationFuncCreator: paginate,
            }),
          })
          await brandRunner.preDeploy(subdomainToGuideChanges[subdomain])
          const { deployResult: brandDeployResults } = await brandRunner.deploy(
            subdomainToGuideChanges[subdomain]
          )
          const guideChangesBeforeRestore = [...brandDeployResults.appliedChanges]
          try {
            await brandRunner.onDeploy(guideChangesBeforeRestore)
          } catch (e) {
            if (!isSaltoError(e)) {
              throw e
            }
            brandDeployResults.errors = brandDeployResults.errors.concat([e])
          }
          return {
            appliedChanges: guideChangesBeforeRestore,
            errors: brandDeployResults.errors,
          }
        })
        .toArray()
    } catch (e) {
      if (!isSaltoError(e)) {
        throw e
      }
      return [{
        appliedChanges: [],
        errors: [e],
      }]
    }
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const [instanceChanges, nonInstanceChanges] = _.partition(changeGroup.changes, isInstanceChange)
    if (nonInstanceChanges.length > 0) {
      log.warn(`We currently can't deploy types. Therefore, the following changes will not be deployed: ${nonInstanceChanges.map(elem => getChangeData(elem).elemID.getFullName()).join(', ')}`)
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
    const sourceChanges = _.keyBy(
      changesToDeploy,
      change => getChangeData(change).elemID.getFullName(),
    )
    const runner = await this.createFiltersRunner({})
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
    const [guideResolvedChanges, supportResolvedChanges] = _.partition(
      resolvedChanges,
      change => GUIDE_TYPES_TO_HANDLE_BY_BRAND.includes(getChangeData(change).elemID.typeName)
    )
    const saltoErrors: SaltoError[] = []
    try {
      await runner.preDeploy(supportResolvedChanges)
    } catch (e) {
      if (!isSaltoError(e)) {
        throw e
      }
      return {
        appliedChanges: [],
        errors: [e],
      }
    }
    const { deployResult } = await runner.deploy(supportResolvedChanges)
    const appliedChangesBeforeRestore = [...deployResult.appliedChanges]
    try {
      await runner.onDeploy(appliedChangesBeforeRestore)
    } catch (e) {
      if (!isSaltoError(e)) {
        throw e
      }
      saltoErrors.push(e)
    }


    const guideDeployResults = await this.deployGuideChanges(guideResolvedChanges)
    const allChangesBeforeRestore = appliedChangesBeforeRestore.concat(
      guideDeployResults.flatMap(result => result.appliedChanges)
    )
    const appliedChanges = await awu(allChangesBeforeRestore)
      .map(change => restoreChangeElement(
        change,
        sourceChanges,
        lookupFunc,
      ))
      .toArray()
    const restoredAppliedChanges = restoreInstanceTypeFromDeploy({
      appliedChanges,
      originalInstanceChanges: instanceChanges,
    })
    return {
      appliedChanges: restoredAppliedChanges,
      errors: deployResult.errors.concat(guideDeployResults.flatMap(result => result.errors)).concat(saltoErrors),
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator: createChangeValidator({
        client: this.client,
        config: this.userConfig,
        apiConfig: this.userConfig[API_DEFINITIONS_CONFIG],
        fetchConfig: this.userConfig[FETCH_CONFIG],
        deployConfig: this.userConfig[DEPLOY_CONFIG],
        typesDeployedViaParent: ['organization_field__custom_field_options', 'macro_attachment', BRAND_LOGO_TYPE_NAME, CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME],
        // article_attachment and guide themes additions supported in a filter
        typesWithNoDeploy: ['tag', ARTICLE_ATTACHMENT_TYPE_NAME, GUIDE_THEME_TYPE_NAME, THEME_SETTINGS_TYPE_NAME, ...GUIDE_ORDER_TYPES, DEFAULT_CUSTOM_STATUSES_TYPE_NAME, CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME],
      }),
      dependencyChanger,
      getChangeGroupIds,
    }
  }

  fixElements: FixElementsFunc = elements => this.fixElementsFunc(elements)
}
