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
import _, { isString } from 'lodash'
import {
  FetchResult, AdapterOperations, DeployResult, DeployModifiers, FetchOptions,
  DeployOptions, Change, isInstanceChange, InstanceElement, getChangeData, ElemIdGetter,
  isInstanceElement, Element,
  ReadOnlyElementsSource, isReferenceExpression,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  config as configUtils,
  elements as elementUtils,
} from '@salto-io/adapter-components'
import { logDuration, resolveChangeElement, resolveValues, restoreChangeElement } from '@salto-io/adapter-utils'
import { collections, objects } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import ZendeskClient from './client/client'
import { FilterCreator, Filter, filtersRunner, FilterResult, BrandIdToClient } from './filter'
import {
  API_DEFINITIONS_CONFIG,
  FETCH_CONFIG,
  ZendeskConfig,
  CLIENT_CONFIG,
  GUIDE_TYPES_TO_HANDLE_BY_BRAND,
  GUIDE_BRAND_SPECIFIC_TYPES, GUIDE_SUPPORTED_TYPES, isGuideEnabled,
} from './config'
import {
  ZENDESK,
  BRAND_LOGO_TYPE_NAME,
  BRAND_TYPE_NAME,
  ARTICLE_ATTACHMENT_TYPE_NAME,
} from './constants'
import { getBrandsForGuide } from './filters/utils'
import { GUIDE_ORDER_TYPES } from './filters/guide_order/guide_order_utils'
import createChangeValidator from './change_validator'
import { paginate } from './client/pagination'
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
import guideLocalesFilter from './filters/guide_locale'
import webhookFilter from './filters/webhook'
import targetFilter from './filters/target'
import defaultDeployFilter from './filters/default_deploy'
import ducktypeCommonFilters from './filters/ducktype_common'
import handleTemplateExpressionFilter from './filters/handle_template_expressions'
import handleAppInstallationsFilter from './filters/handle_app_installations'
import referencedIdFieldsFilter from './filters/referenced_id_fields'
import brandLogoFilter from './filters/brand_logo'
import articleFilter from './filters/article/article'
import articleBodyFilter from './filters/article/article_body'
import { getConfigFromConfigChanges } from './config_change'
import { dependencyChanger } from './dependency_changers'
import customFieldOptionsFilter from './filters/add_restriction'
import deployBrandedGuideTypesFilter from './filters/deploy_branded_guide_types'
import { Credentials } from './auth'
import guideSectionCategoryFilter from './filters/guide_section_and_category'
import guideTranslationFilter from './filters/guide_translation'
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

const { makeArray } = collections.array
const log = logger(module)
const { createPaginator } = clientUtils
const { findDataField, computeGetArgs } = elementUtils
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
  accountSettingsFilter,
  dynamicContentFilter,
  restrictionFilter,
  organizationFieldFilter,
  hardcodedChannelFilter,
  // removeDefinitionInstancesFilter should be after hardcodedChannelFilter
  removeDefinitionInstancesFilter,
  usersFilter,
  tagsFilter,
  guideAddBrandToArticleTranslation,
  macroAttachmentsFilter,
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
  // fieldReferencesFilter should be after usersFilter, macroAttachmentsFilter, tagsFilter and guideLocalesFilter
  fieldReferencesFilter,
  // listValuesMissingReferencesFilter should be after fieldReferencesFilter
  listValuesMissingReferencesFilter,
  appsFilter,
  customFieldOptionsFilter,
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
  articleBodyFilter,
  guideParentSection,
  serviceUrlFilter,
  ...ducktypeCommonFilters,
  handleAppInstallationsFilter,
  handleTemplateExpressionFilter,
  collisionErrorsFilter, // needs to be after referencedIdFieldsFilter
  deployBrandedGuideTypesFilter,
  guideArrangePaths,
  fetchCategorySection, // need to be after arrange paths as it uses the 'name'/'title' field
  // defaultDeployFilter should be last!
  defaultDeployFilter,
]

const SKIP_RESOLVE_TYPE_NAMES = [
  'organization_field__custom_field_options',
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
  } : {
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
        (responseEntryName !== configUtils.DATA_FIELD_ENTIRE_OBJECT)
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
      if (responseEntryName === configUtils.DATA_FIELD_ENTIRE_OBJECT) {
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

const getBrandsFromElementsSource = async (
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
}:{
  brandsList: InstanceElement[]
  brandToPaginator: Record<string, clientUtils.Paginator>
  apiDefinitions: configUtils.AdapterDuckTypeApiConfig
  fetchQuery: elementUtils.query.ElementQuery
  getElemIdFunc?: ElemIdGetter
}): Promise<elementUtils.ducktype.FetchElements<Element[]>> => {
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

  const allConfigChangeSuggestions = fetchResultWithDuplicateTypes.flatMap(fetchResult => fetchResult.configChanges)
  return {
    elements: zendeskGuideElements,
    configChanges: elementUtils.ducktype.getUniqueConfigSuggestions(allConfigChangeSuggestions),
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
  private createClientBySubdomain: (subdomain: string) => ZendeskClient
  private createFiltersRunner: ({
    filterRunnerClient,
    paginator,
    brandIdToClient,
  } : {
    filterRunnerClient?: ZendeskClient
    paginator?: clientUtils.Paginator
    brandIdToClient?: BrandIdToClient
  }) => Promise<Required<Filter>>

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    credentials,
    getElemIdFunc,
    config,
    configInstance,
    elementsSource,
  }: ZendeskAdapterParams) {
    this.userConfig = config
    this.configInstance = configInstance
    this.getElemIdFunc = getElemIdFunc
    this.client = client
    this.elementsSource = elementsSource
    this.paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })

    this.createClientBySubdomain = (subdomain: string): ZendeskClient => (
      new ZendeskClient({
        credentials: { ...credentials, subdomain },
        config: this.userConfig[CLIENT_CONFIG],
      })
    )

    this.fetchQuery = elementUtils.query.createElementQuery(this.userConfig[FETCH_CONFIG])

    this.createFiltersRunner = async ({
      filterRunnerClient,
      paginator,
      brandIdToClient = {},
    } : {
      filterRunnerClient?: ZendeskClient
      paginator?: clientUtils.Paginator
      brandIdToClient?: BrandIdToClient
    }) => (
      filtersRunner(
        {
          client: filterRunnerClient ?? this.client,
          paginator: paginator ?? this.paginator,
          config: {
            fetch: config.fetch,
            apiDefinitions: config.apiDefinitions,
          },
          getElemIdFunc,
          fetchQuery: this.fetchQuery,
          elementsSource,
          brandIdToClient,
        },
        filterCreators,
        concatObjects,
      )
    )
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<ReturnType<typeof getAllElements>> {
    const isGuideDisabled = !isGuideEnabled(this.userConfig[FETCH_CONFIG])
    const { supportedTypes: allSupportedTypes } = this.userConfig.apiDefinitions
    const supportedTypes = isGuideDisabled
      ? _.omit(allSupportedTypes, ...Object.keys(GUIDE_SUPPORTED_TYPES))
      : _.omit(allSupportedTypes, ...Object.keys(GUIDE_BRAND_SPECIFIC_TYPES))
    // Zendesk Support and (if enabled) global Zendesk Guide types
    const defaultSubdomainElements = await getAllElements({
      adapterName: ZENDESK,
      types: this.userConfig.apiDefinitions.types,
      shouldAddRemainingTypes: isGuideDisabled,
      supportedTypes,
      fetchQuery: this.fetchQuery,
      paginator: this.paginator,
      nestedFieldFinder: findDataField,
      computeGetArgs,
      typeDefaults: this.userConfig.apiDefinitions.typeDefaults,
      getElemIdFunc: this.getElemIdFunc,
    })

    if (isGuideDisabled) {
      return defaultSubdomainElements
    }

    const brandsList = getBrandsForGuide(
      defaultSubdomainElements.elements.filter(isInstanceElement),
      this.userConfig[FETCH_CONFIG]
    )

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

    // Remaining types should be added once to avoid overlaps between the generated elements,
    // so we add them once after all elements are generated
    const zendeskElements = defaultSubdomainElements.elements.concat(zendeskGuideElements.elements)
    addRemainingTypes({
      adapterName: ZENDESK,
      elements: zendeskElements,
      typesConfig: this.userConfig.apiDefinitions.types,
      supportedTypes: _.merge(supportedTypes, GUIDE_BRAND_SPECIFIC_TYPES),
      typeDefaultConfig: this.userConfig.apiDefinitions.typeDefaults,
    })

    return {
      configChanges: defaultSubdomainElements.configChanges
        .concat(zendeskGuideElements.configChanges),
      elements: zendeskElements,
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
    const { elements, configChanges } = await this.getElements()

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
    await runner.preDeploy(supportResolvedChanges)
    const { deployResult } = await runner.deploy(supportResolvedChanges)
    const appliedChangesBeforeRestore = [...deployResult.appliedChanges]
    await runner.onDeploy(appliedChangesBeforeRestore)

    const brandsList = _.uniq(await getBrandsFromElementsSource(this.elementsSource))
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
    const subdomainToPaginator = Object.fromEntries(subdomainsList.map(subdomain => (
      [
        subdomain,
        createPaginator({
          client: this.createClientBySubdomain(subdomain),
          paginationFuncCreator: paginate,
        }),
      ]
    )))
    const guideDeployResults = await awu(Object.entries(subdomainToPaginator))
      .filter(([subdomain]) => subdomainToGuideChanges[subdomain] !== undefined)
      .map(async ([subdomain, paginator]) => {
        const brandRunner = await this.createFiltersRunner({
          filterRunnerClient: this.createClientBySubdomain(subdomain),
          paginator,
        })
        await brandRunner.preDeploy(subdomainToGuideChanges[subdomain])
        const { deployResult: brandDeployResults } = await brandRunner.deploy(
          subdomainToGuideChanges[subdomain]
        )
        const guideChangesBeforeRestore = [...brandDeployResults.appliedChanges]
        await brandRunner.onDeploy(guideChangesBeforeRestore)

        return {
          appliedChanges: guideChangesBeforeRestore,
          errors: brandDeployResults.errors,
        }
      })
      .toArray()

    const sourceChanges = _.keyBy(
      changesToDeploy,
      change => getChangeData(change).elemID.getFullName(),
    )

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
      errors: deployResult.errors.concat(guideDeployResults.flatMap(result => result.errors)),
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator: createChangeValidator({
        client: this.client,
        apiConfig: this.userConfig[API_DEFINITIONS_CONFIG],
        typesDeployedViaParent: ['organization_field__custom_field_options', 'macro_attachment', BRAND_LOGO_TYPE_NAME],
        // article_attachment additions supported in a filter
        typesWithNoDeploy: ['tag', ARTICLE_ATTACHMENT_TYPE_NAME, ...GUIDE_ORDER_TYPES],
      }),
      dependencyChanger,
      getChangeGroupIds,
    }
  }
}
