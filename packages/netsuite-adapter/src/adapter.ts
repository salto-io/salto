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
import {
  FetchResult, isInstanceElement, AdapterOperations, DeployResult, DeployOptions,
  ElemIdGetter, ReadOnlyElementsSource,
  FetchOptions, Field, BuiltinTypes, DeployModifiers, Change, getChangeData,
  Element, ProgressReporter,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { filter } from '@salto-io/adapter-utils'
import {
  createInstanceElement,
} from './transformer'
import { getMetadataTypes, getTopLevelStandardTypes, metadataTypesToList } from './types'
import { INTEGRATION, APPLICATION_ID, CUSTOM_RECORD_TYPE } from './constants'
import convertListsToMaps from './filters/convert_lists_to_maps'
import replaceElementReferences from './filters/element_references'
import parseSavedSearch from './filters/parse_saved_searchs'
import convertLists from './filters/convert_lists'
import consistentValues from './filters/consistent_values'
import addParentFolder from './filters/add_parent_folder'
import serviceUrls from './filters/service_urls'
import redundantFields from './filters/remove_redundant_fields'
import hiddenFields from './filters/hidden_fields'
import replaceRecordRef from './filters/replace_record_ref'
import removeUnsupportedTypes from './filters/remove_unsupported_types'
import dataInstancesInternalId from './filters/data_instances_internal_id'
import dataInstancesReferences from './filters/data_instances_references'
import dataTypesCustomFields from './filters/data_types_custom_fields'
import dataInstancesCustomFields from './filters/data_instances_custom_fields'
import dataInstancesAttributes from './filters/data_instances_attributes'
import dataInstancesNullFields from './filters/data_instances_null_fields'
import dataInstancesDiff from './filters/data_instances_diff'
import dataInstancesIdentifiers from './filters/data_instances_identifiers'
import suiteAppInternalIds from './filters/internal_ids/suite_app_internal_ids'
import SDFInternalIds from './filters/internal_ids/sdf_internal_ids'
import accountSpecificValues from './filters/account_specific_values'
import translationConverter from './filters/translation_converter'
import systemNoteAuthorInformation from './filters/author_information/system_note'
import savedSearchesAuthorInformation from './filters/author_information/saved_searches'
import suiteAppConfigElementsFilter from './filters/suiteapp_config_elements'
import configFeaturesFilter from './filters/config_features'
import omitSdfUntypedValues from './filters/omit_sdf_untyped_values'
import omitFieldsFilter from './filters/omit_fields'
import currencyExchangeRate from './filters/currency_exchange_rate'
import customRecordTypesType from './filters/custom_record_types'
import customRecordsFilter from './filters/custom_records'
import currencyUndeployableFieldsFilter from './filters/currency_omit_fields'
import { createFilterCreatorsWithLogs, Filter, FilterCreator } from './filter'
import { getConfigFromConfigChanges, NetsuiteConfig, DEFAULT_DEPLOY_REFERENCED_ELEMENTS, DEFAULT_WARN_STALE_DATA, DEFAULT_USE_CHANGES_DETECTION, DEFAULT_VALIDATE } from './config'
import { andQuery, buildNetsuiteQuery, NetsuiteQuery, NetsuiteQueryParameters, notQuery, QueryParams, convertToQueryParams, getFixedTargetFetch } from './query'
import { getLastServerTime, getOrCreateServerTimeElements, getLastServiceIdToFetchTime } from './server_time'
import { getChangedObjects } from './changes_detector/changes_detector'
import NetsuiteClient from './client/client'
import { createDateRange } from './changes_detector/date_formats'
import { createElementsSourceIndex } from './elements_source_index/elements_source_index'
import { LazyElementsSourceIndexes } from './elements_source_index/types'
import getChangeValidator from './change_validator'
import { FetchByQueryFunc, FetchByQueryReturnType } from './change_validators/safe_deploy'
import { getChangeGroupIdsFunc } from './group_changes'
import { getCustomRecords } from './custom_records/custom_records'
import { getDataElements } from './data_elements/data_elements'
import { getStandardTypesNames, isStandardTypeName } from './autogen/types'
import { getConfigTypes, toConfigElements } from './suiteapp_config_elements'
import { AdditionalDependencies } from './client/types'
import { createCustomRecordTypes } from './custom_records/custom_record_type'

const { makeArray } = collections.array
const { awu } = collections.asynciterable

const log = logger(module)

export interface NetsuiteAdapterParams {
  client: NetsuiteClient
  elementsSource: ReadOnlyElementsSource
  // Filters to support special cases upon fetch
  filtersCreators?: FilterCreator[]
  // Types that we skip their deployment and fetch
  typesToSkip?: string[]
  // File paths regular expression that we skip their fetch
  filePathRegexSkipList?: string[]
  // Determines whether to attempt deploying all the elements that are referenced by the changed
  // elements. It's needed as a workaround in cases deploy fails due to SDF inconsistent behavior
  deployReferencedElements?: boolean
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
  // config that is determined by the user
  config: NetsuiteConfig
}

export default class NetsuiteAdapter implements AdapterOperations {
  private readonly client: NetsuiteClient
  private readonly elementsSource: ReadOnlyElementsSource
  private readonly typesToSkip: string[]
  private readonly filePathRegexSkipList: string[]
  private readonly deployReferencedElements?: boolean
  private readonly warnStaleData?: boolean
  private readonly validateBeforeDeploy: boolean
  private readonly additionalDependencies: AdditionalDependencies
  private readonly userConfig: NetsuiteConfig
  private getElemIdFunc?: ElemIdGetter
  private readonly fetchInclude?: QueryParams
  private readonly fetchExclude?: QueryParams
  private readonly lockedElements?: QueryParams
  private readonly fetchTarget?: NetsuiteQueryParameters
  private readonly skipList?: NetsuiteQueryParameters // old version
  private readonly useChangesDetection: boolean
  private createFiltersRunner: (isPartial: boolean) => Required<Filter>
  private elementsSourceIndex: LazyElementsSourceIndexes


  public constructor({
    client,
    elementsSource,
    filtersCreators = createFilterCreatorsWithLogs({
      customRecordTypesType,
      omitSdfUntypedValues,
      omitFieldsFilter,
      dataInstancesIdentifiers,
      dataInstancesDiff,
      // addParentFolder must run before replaceInstanceReferencesFilter
      addParentFolder,
      parseSavedSearch,
      convertLists,
      consistentValues,
      // convertListsToMaps must run after convertLists and consistentValues
      // and must run before replaceInstanceReferencesFilter
      convertListsToMaps,
      replaceElementReferences,
      currencyUndeployableFieldsFilter,
      SDFInternalIds,
      dataInstancesAttributes,
      redundantFields,
      hiddenFields,
      replaceRecordRef,
      dataTypesCustomFields,
      dataInstancesCustomFields,
      dataInstancesNullFields,
      removeUnsupportedTypes,
      dataInstancesReferences,
      dataInstancesInternalId,
      suiteAppInternalIds,
      currencyExchangeRate,
      // AuthorInformation filters must run after SDFInternalIds filter
      systemNoteAuthorInformation,
      // savedSearchesAutorInformation must run before suiteAppConfigElementsFilter
      savedSearchesAuthorInformation,
      translationConverter,
      accountSpecificValues,
      suiteAppConfigElementsFilter,
      configFeaturesFilter,
      customRecordsFilter,
      // serviceUrls must run after suiteAppInternalIds filter
      serviceUrls,
    }),
    typesToSkip = [
      INTEGRATION, // The imported xml has no values, especially no SCRIPT_ID, for standard
      // integrations and contains only SCRIPT_ID attribute for custom ones.
      // There is no value in fetching them as they contain no data and are not deployable.
      // If we decide to fetch them we should set the SCRIPT_ID by the xml's filename upon fetch.
    ],
    filePathRegexSkipList = [],
    getElemIdFunc,
    config,
  }: NetsuiteAdapterParams) {
    this.client = client
    this.elementsSource = elementsSource
    this.typesToSkip = typesToSkip.concat(makeArray(config.typesToSkip))
    this.filePathRegexSkipList = filePathRegexSkipList
      .concat(makeArray(config.filePathRegexSkipList))
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
    this.fetchInclude = config.fetch?.include
    this.fetchExclude = config.fetch?.exclude
    this.lockedElements = config.fetch?.lockedElementsToExclude
    this.fetchTarget = getFixedTargetFetch(config.fetchTarget)
    this.skipList = config.skipList // old version
    this.useChangesDetection = config.useChangesDetection ?? DEFAULT_USE_CHANGES_DETECTION
    this.deployReferencedElements = config.deploy?.deployReferencedElements
     ?? config.deployReferencedElements
    this.warnStaleData = config.deploy?.warnOnStaleWorkspaceData
    this.validateBeforeDeploy = config.deploy?.validate ?? DEFAULT_VALIDATE
    this.additionalDependencies = {
      include: {
        features: config.deploy?.additionalDependencies?.include?.features ?? [],
        objects: config.deploy?.additionalDependencies?.include?.objects ?? [],
      },
      exclude: {
        features: config.deploy?.additionalDependencies?.exclude?.features ?? [],
        objects: config.deploy?.additionalDependencies?.exclude?.objects ?? [],
      },
    }
    this.elementsSourceIndex = createElementsSourceIndex(this.elementsSource)
    this.createFiltersRunner = isPartial => filter.filtersRunner(
      {
        client: this.client,
        elementsSourceIndex: this.elementsSourceIndex,
        elementsSource: this.elementsSource,
        isPartial,
        config,
      },
      filtersCreators,
    )
  }

  private isPartialFetch(): boolean { return this.fetchTarget !== undefined }

  public fetchByQuery: FetchByQueryFunc = async (
    fetchQuery: NetsuiteQuery,
    progressReporter: ProgressReporter,
    useChangesDetection: boolean,
    isPartial: boolean
  ): Promise<FetchByQueryReturnType> => {
    const { standardTypes, enums, additionalTypes, fieldTypes } = getMetadataTypes()
    const {
      changedObjectsQuery,
      serverTime,
    } = await this.runSuiteAppOperations(
      fetchQuery,
      useChangesDetection,
    )
    const updatedFetchQuery = changedObjectsQuery !== undefined
      ? andQuery(changedObjectsQuery, fetchQuery)
      : fetchQuery

    const serverTimeElements = serverTime !== undefined
      ? await getOrCreateServerTimeElements(
        serverTime,
        this.elementsSource,
        this.isPartialFetch(),
      )
      : undefined

    const dataElementsPromise = getDataElements(this.client, fetchQuery, this.getElemIdFunc)
    const configRecordsPromise = this.client.getConfigRecords()

    const getCustomObjectsResult = this.client.getCustomObjects(
      getStandardTypesNames(),
      updatedFetchQuery
    )
    const importFileCabinetResult = this.client.importFileCabinetContent(updatedFetchQuery)
    progressReporter.reportProgress({ message: 'Fetching file cabinet items' })

    const {
      elements: fileCabinetContent,
      failedPaths: failedFilePaths,
    } = await importFileCabinetResult
    log.debug('importFileCabinetContent: fetched %d fileCabinet elements', fileCabinetContent.length)

    progressReporter.reportProgress({ message: 'Fetching instances' })
    const {
      elements: customObjects,
      failedToFetchAllAtOnce,
      failedTypes,
    } = await getCustomObjectsResult

    const topLevelStandardTypes = getTopLevelStandardTypes(standardTypes)
    progressReporter.reportProgress({ message: 'Running filters for additional information' });

    [...topLevelStandardTypes, ...Object.values(additionalTypes)].forEach(type => {
      type.fields[APPLICATION_ID] = new Field(type, APPLICATION_ID, BuiltinTypes.STRING)
    })

    const customizationInfos = [...customObjects, ...fileCabinetContent]

    const [customRecordTypeInstances, instances] = _.partition(
      await awu(customizationInfos).map(customizationInfo => {
        const type = isStandardTypeName(customizationInfo.typeName)
          ? standardTypes[customizationInfo.typeName].type
          : additionalTypes[customizationInfo.typeName]
        return type
          ? createInstanceElement(
            customizationInfo,
            type,
            this.getElemIdFunc,
            serverTime,
            serverTimeElements?.instance,
          )
          : undefined
      }).filter(isInstanceElement).toArray(),
      instance => instance.elemID.typeName === CUSTOM_RECORD_TYPE
    )

    const customRecordTypes = createCustomRecordTypes(
      customRecordTypeInstances,
      standardTypes.customrecordtype.type
    )

    const customRecordsPromise = getCustomRecords(
      this.client,
      customRecordTypes,
      fetchQuery,
      this.getElemIdFunc
    )

    const dataElements = await dataElementsPromise
    const suiteAppConfigElements = this.client.isSuiteAppConfigured()
      ? toConfigElements(await configRecordsPromise, fetchQuery).concat(getConfigTypes())
      : []
    const customRecords = await customRecordsPromise

    const elements = [
      ...metadataTypesToList({ standardTypes, enums, additionalTypes, fieldTypes }),
      ...dataElements,
      ...suiteAppConfigElements,
      ...instances,
      ...(serverTimeElements ? [serverTimeElements.type, serverTimeElements.instance] : []),
      ...customRecordTypes,
      ...customRecords,
    ]

    await this.createFiltersRunner(isPartial).onFetch(elements)

    return {
      failedToFetchAllAtOnce,
      failedFilePaths,
      failedTypes,
      elements,
    }
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given Netsuite account.
   * Account credentials were given in the constructor.
   */

  public async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    const deprecatedSkipList = buildNetsuiteQuery(convertToQueryParams({
      types: Object.fromEntries(this.typesToSkip.map(typeName => [typeName, ['.*']])),
      filePaths: this.filePathRegexSkipList.map(reg => `.*${reg}.*`),
    }))

    const fetchQuery = [
      this.fetchInclude && buildNetsuiteQuery(this.fetchInclude),
      this.fetchTarget && buildNetsuiteQuery(convertToQueryParams(this.fetchTarget)),
      this.fetchExclude && notQuery(buildNetsuiteQuery(this.fetchExclude)),
      this.lockedElements && notQuery(buildNetsuiteQuery(this.lockedElements)),
      this.skipList && notQuery(buildNetsuiteQuery(convertToQueryParams(this.skipList))),
      notQuery(deprecatedSkipList),
    ].filter(values.isDefined).reduce(andQuery)

    const isPartial = this.isPartialFetch()

    const {
      failedToFetchAllAtOnce,
      failedFilePaths,
      failedTypes,
      elements,
    } = await this.fetchByQuery(fetchQuery, progressReporter, this.useChangesDetection, isPartial)

    const updatedConfig = getConfigFromConfigChanges(
      failedToFetchAllAtOnce, failedFilePaths, failedTypes, this.userConfig
    )

    if (_.isUndefined(updatedConfig)) {
      return { elements, isPartial }
    }
    return { elements, updatedConfig, isPartial }
  }

  private async runSuiteAppOperations(
    fetchQuery: NetsuiteQuery,
    useChangesDetection: boolean,
  ):
    Promise<{
      changedObjectsQuery?: NetsuiteQuery
      serverTime?: Date
    }> {
    const sysInfo = await this.client.getSystemInformation()
    if (sysInfo === undefined) {
      log.debug('Did not get sysInfo, skipping SuiteApp operations')
      return {}
    }

    if (!this.isPartialFetch()) {
      return {
        serverTime: sysInfo.time,
      }
    }

    if (!useChangesDetection) {
      log.debug('Changes detection is disabled')
      return {
        serverTime: sysInfo.time,
      }
    }

    const lastFetchTime = await getLastServerTime(this.elementsSource)
    if (lastFetchTime === undefined) {
      log.debug('Failed to get last fetch time')
      return { serverTime: sysInfo.time }
    }
    const serviceIdToLastFetchDate = await getLastServiceIdToFetchTime(this.elementsSource)
    const changedObjectsQuery = await getChangedObjects(
      this.client,
      fetchQuery,
      createDateRange(lastFetchTime, sysInfo.time),
      serviceIdToLastFetchDate,
    )

    return { changedObjectsQuery, serverTime: sysInfo.time }
  }


  public async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const changesToDeploy = changeGroup.changes
      .map(change => ({
        action: change.action,
        data: _.mapValues(change.data, (element: Element) => element.clone()),
      })) as Change[]

    const filtersRunner = this.createFiltersRunner(this.isPartialFetch())
    await filtersRunner.preDeploy(changesToDeploy)

    const deployResult = await this.client.deploy(
      changesToDeploy,
      changeGroup.groupID,
      this.deployReferencedElements ?? DEFAULT_DEPLOY_REFERENCED_ELEMENTS,
      this.additionalDependencies,
      this.elementsSourceIndex,
    )

    const ids = deployResult.appliedChanges.map(
      change => getChangeData(change).elemID.getFullName()
    )

    const appliedChanges = changeGroup.changes
      .filter(change => ids.includes(getChangeData(change).elemID.getFullName()))
      .map(change => ({
        action: change.action,
        data: _.mapValues(change.data, (element: Element) => element.clone()),
      } as Change))

    await filtersRunner.onDeploy(appliedChanges, deployResult)

    return {
      errors: deployResult.errors,
      appliedChanges,
    }
  }

  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator: getChangeValidator({
        client: this.client,
        withSuiteApp: this.client.isSuiteAppConfigured(),
        warnStaleData: this.warnStaleData ?? DEFAULT_WARN_STALE_DATA,
        fetchByQuery: this.fetchByQuery,
        deployReferencedElements: this.deployReferencedElements
          ?? DEFAULT_DEPLOY_REFERENCED_ELEMENTS,
        validate: this.validateBeforeDeploy,
        additionalDependencies: this.additionalDependencies,
        filtersRunner: this.createFiltersRunner(this.isPartialFetch()),
        elementsSourceIndex: this.elementsSourceIndex,
      }),
      getChangeGroupIds: getChangeGroupIdsFunc(this.client.isSuiteAppConfigured()),
    }
  }
}
