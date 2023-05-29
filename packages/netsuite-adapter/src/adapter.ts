/*
*                      Copyright 2023 Salto Labs Ltd.
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
  FetchResult, AdapterOperations, DeployResult, DeployOptions,
  ElemIdGetter, ReadOnlyElementsSource, ProgressReporter,
  FetchOptions, DeployModifiers, getChangeData, isObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { filter } from '@salto-io/adapter-utils'
import { createElements } from './transformer'
import { isCustomRecordType } from './types'
import { INTEGRATION } from './constants'
import convertListsToMaps from './filters/convert_lists_to_maps'
import replaceElementReferences from './filters/element_references'
import parseReportTypes from './filters/parse_report_types'
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
import additionalChanges from './filters/additional_changes'
import addInstancesFetchTime from './filters/add_instances_fetch_time'
import { Filter, LocalFilterCreator, LocalFilterCreatorDefinition, RemoteFilterCreator, RemoteFilterCreatorDefinition } from './filter'
import { getConfigFromConfigChanges, NetsuiteConfig, DEFAULT_DEPLOY_REFERENCED_ELEMENTS, DEFAULT_WARN_STALE_DATA, DEFAULT_VALIDATE, AdditionalDependencies, DEFAULT_MAX_FILE_CABINET_SIZE_IN_GB } from './config'
import { andQuery, buildNetsuiteQuery, NetsuiteQuery, NetsuiteQueryParameters, notQuery, QueryParams, convertToQueryParams, getFixedTargetFetch } from './query'
import { getLastServerTime, getOrCreateServerTimeElements, getLastServiceIdToFetchTime } from './server_time'
import { getChangedObjects } from './changes_detector/changes_detector'
import NetsuiteClient from './client/client'
import { createDateRange, getTimeDateFormat, TimeZoneAndFormat } from './changes_detector/date_formats'
import { createElementsSourceIndex } from './elements_source_index/elements_source_index'
import getChangeValidator from './change_validator'
import dependencyChanger from './dependency_changer'
import { cloneChange } from './change_validators/utils'
import { FetchByQueryFunc, FetchByQueryReturnType } from './change_validators/safe_deploy'
import { getChangeGroupIdsFunc } from './group_changes'
import { getCustomRecords } from './custom_records/custom_records'
import { getDataElements } from './data_elements/data_elements'
import { getStandardTypesNames } from './autogen/types'
import { getConfigTypes, toConfigElements } from './suiteapp_config_elements'
import { ConfigRecord } from './client/suiteapp_client/types'


const { makeArray } = collections.array
const { awu } = collections.asynciterable

const log = logger(module)

export const allFilters: (LocalFilterCreatorDefinition | RemoteFilterCreatorDefinition)[] = [
  { creator: customRecordTypesType },
  { creator: omitSdfUntypedValues },
  { creator: dataInstancesIdentifiers },
  { creator: dataInstancesDiff },
  // addParentFolder must run before replaceInstanceReferencesFilter
  { creator: addParentFolder },
  { creator: parseReportTypes },
  { creator: convertLists },
  { creator: consistentValues },
  // convertListsToMaps must run after convertLists and consistentValues
  // and must run before replaceInstanceReferencesFilter
  { creator: convertListsToMaps },
  { creator: replaceElementReferences },
  { creator: currencyUndeployableFieldsFilter },
  { creator: SDFInternalIds, addsNewInformation: true },
  { creator: dataInstancesAttributes },
  { creator: redundantFields },
  { creator: hiddenFields },
  { creator: replaceRecordRef },
  { creator: dataTypesCustomFields },
  { creator: dataInstancesCustomFields },
  { creator: dataInstancesNullFields },
  { creator: removeUnsupportedTypes },
  { creator: dataInstancesReferences },
  { creator: dataInstancesInternalId },
  { creator: suiteAppInternalIds },
  { creator: currencyExchangeRate },
  // AuthorInformation filters must run after SDFInternalIds filter
  { creator: systemNoteAuthorInformation, addsNewInformation: true },
  // savedSearchesAuthorInformation must run before suiteAppConfigElementsFilter
  { creator: savedSearchesAuthorInformation, addsNewInformation: true },
  { creator: translationConverter },
  { creator: accountSpecificValues },
  { creator: suiteAppConfigElementsFilter },
  { creator: configFeaturesFilter },
  { creator: customRecordsFilter },
  { creator: addInstancesFetchTime },
  // serviceUrls must run after suiteAppInternalIds and SDFInternalIds filter
  { creator: serviceUrls, addsNewInformation: true },
  // omitFieldsFilter should be the last onFetch filter to run
  { creator: omitFieldsFilter },
  // additionalChanges should be the first preDeploy filter to run
  { creator: additionalChanges },
]

// By default we run all filters and provide a client
const defaultFilters = allFilters.map(({ creator }) => creator)

export interface NetsuiteAdapterParams {
  client: NetsuiteClient
  elementsSource: ReadOnlyElementsSource
  // Filters to support special cases upon fetch
  filtersCreators?: Array<LocalFilterCreator | RemoteFilterCreator>
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
  private readonly useChangesDetection: boolean | undefined // TODO remove this from config SALTO-3676
  private createFiltersRunner: (params: {
    isPartial?: boolean
    changesGroupId?: string
    fetchTime?: Date
    timeZoneAndFormat?: TimeZoneAndFormat
  }) => Required<Filter>

  public constructor({
    client,
    elementsSource,
    filtersCreators = defaultFilters,
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
    this.useChangesDetection = config.useChangesDetection
    this.deployReferencedElements = config.deploy?.deployReferencedElements
     ?? config.deployReferencedElements
    this.warnStaleData = config.deploy?.warnOnStaleWorkspaceData
    this.validateBeforeDeploy = config.deploy?.validate ?? DEFAULT_VALIDATE
    this.additionalDependencies = {
      include: {
        features: config.deploy?.additionalDependencies?.include?.features ?? [],
        objects: config.deploy?.additionalDependencies?.include?.objects ?? [],
        files: config.deploy?.additionalDependencies?.include?.files ?? [],
      },
      exclude: {
        features: config.deploy?.additionalDependencies?.exclude?.features ?? [],
        objects: config.deploy?.additionalDependencies?.exclude?.objects ?? [],
        files: config.deploy?.additionalDependencies?.exclude?.files ?? [],
      },
    }
    this.createFiltersRunner = ({ isPartial = false, changesGroupId, fetchTime, timeZoneAndFormat }) =>
      filter.filtersRunner(
        {
          client: this.client,
          elementsSourceIndex: createElementsSourceIndex(this.elementsSource, isPartial),
          elementsSource: this.elementsSource,
          isPartial,
          config,
          timeZoneAndFormat,
          changesGroupId,
          fetchTime,
        },
        filtersCreators,
      )
  }

  public fetchByQuery: FetchByQueryFunc = async (
    fetchQuery: NetsuiteQuery,
    progressReporter: ProgressReporter,
    useChangesDetection: boolean,
    isPartial: boolean
  ): Promise<FetchByQueryReturnType> => {
    const configRecords = await this.client.getConfigRecords()
    const {
      changedObjectsQuery,
      serverTime,
      timeZoneAndFormat,
    } = await this.runSuiteAppOperations(
      fetchQuery,
      useChangesDetection,
      configRecords,
    )
    const updatedFetchQuery = changedObjectsQuery !== undefined
      ? andQuery(changedObjectsQuery, fetchQuery)
      : fetchQuery

    const serverTimeElements = serverTime !== undefined
      ? await getOrCreateServerTimeElements(
        serverTime,
        this.elementsSource,
        isPartial,
      )
      : []

    const dataElementsPromise = getDataElements(this.client, fetchQuery, this.getElemIdFunc)

    const getCustomObjectsResult = this.client.getCustomObjects(
      getStandardTypesNames(),
      updatedFetchQuery
    )
    const importFileCabinetResult = this.client.importFileCabinetContent(
      updatedFetchQuery,
      this.userConfig.client?.maxFileCabinetSizeInGB ?? DEFAULT_MAX_FILE_CABINET_SIZE_IN_GB
    )
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

    progressReporter.reportProgress({ message: 'Running filters for additional information' })

    const baseElements = await createElements(
      [...customObjects, ...fileCabinetContent],
      this.getElemIdFunc,
    )

    const customRecordsPromise = getCustomRecords(
      this.client,
      baseElements.filter(isObjectType).filter(isCustomRecordType),
      fetchQuery,
      this.getElemIdFunc
    )

    const { elements: dataElements, largeTypesError: dataTypeError } = await dataElementsPromise
    failedTypes.excludedTypes = failedTypes.excludedTypes.concat(dataTypeError)
    const suiteAppConfigElements = this.client.isSuiteAppConfigured()
      ? toConfigElements(configRecords, fetchQuery).concat(getConfigTypes())
      : []
    const { elements: customRecords, largeTypesError: failedCustomRecords } = await customRecordsPromise

    const elements = [
      ...baseElements,
      ...dataElements,
      ...suiteAppConfigElements,
      ...serverTimeElements,
      ...customRecords,
    ]

    await this.createFiltersRunner({ isPartial, fetchTime: serverTime, timeZoneAndFormat }).onFetch(elements)

    return {
      failures: {
        failedToFetchAllAtOnce,
        failedFilePaths,
        failedTypes,
        failedCustomRecords,
      },
      elements,
    }
  }

  private shouldFetchWithChangesDetection(shouldFetchWithChangesDetectionParams : {
    withChangesDetection: boolean
    hasFetchTarget: boolean
    isFirstFetch: boolean
  }) : boolean {
    return !shouldFetchWithChangesDetectionParams.isFirstFetch && (
      this.useChangesDetection === true
      || shouldFetchWithChangesDetectionParams.withChangesDetection
      // by default when having fetch target we prefer to fetch with change detection (unless explicitly disabled)
      || (shouldFetchWithChangesDetectionParams.hasFetchTarget && this.useChangesDetection !== false))
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given Netsuite account.
   * Account credentials were given in the constructor.
   */

  public async fetch({ progressReporter, withChangesDetection = false }: FetchOptions): Promise<FetchResult> {
    const isFirstFetch = !(await awu(await this.elementsSource.list()).find(e => !e.isConfigType()))
    const hasFetchTarget = this.fetchTarget !== undefined
    if (hasFetchTarget && isFirstFetch) {
      throw new Error('Can\'t define fetchTarget for the first fetch. Remove fetchTarget from adapter config file')
    }

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

    const fetchWithChangesDetection = this.shouldFetchWithChangesDetection({
      withChangesDetection, hasFetchTarget, isFirstFetch,
    })
    const isPartial = fetchWithChangesDetection || hasFetchTarget

    const { failures, elements } = await this.fetchByQuery(
      fetchQuery,
      progressReporter,
      fetchWithChangesDetection,
      isPartial,
    )

    const updatedConfig = getConfigFromConfigChanges(failures, this.userConfig)

    if (_.isUndefined(updatedConfig)) {
      return { elements, isPartial }
    }
    return { elements, updatedConfig, isPartial }
  }

  private async runSuiteAppOperations(
    fetchQuery: NetsuiteQuery,
    useChangesDetection: boolean,
    configRecords: ConfigRecord[],
  ):
    Promise<{
      changedObjectsQuery?: NetsuiteQuery
      serverTime?: Date
      timeZoneAndFormat?: TimeZoneAndFormat
    }> {
    const sysInfo = await this.client.getSystemInformation()
    if (sysInfo === undefined) {
      log.debug('Did not get sysInfo, skipping SuiteApp operations')
      return {}
    }

    if (!useChangesDetection) {
      log.debug('Changes detection is disabled')
      return { serverTime: sysInfo.time }
    }

    const lastFetchTime = await getLastServerTime(this.elementsSource)
    if (lastFetchTime === undefined) {
      log.debug('Failed to get last fetch time')
      return { serverTime: sysInfo.time }
    }
    const timeZoneAndFormat = getTimeDateFormat(configRecords)
    if (timeZoneAndFormat?.format === undefined) {
      log.debug('Failed to get date format, skipping SuiteApp operations')
      return { serverTime: sysInfo.time, timeZoneAndFormat }
    }
    const serviceIdToLastFetchDate = await getLastServiceIdToFetchTime(this.elementsSource)
    const changedObjectsQuery = await getChangedObjects(
      this.client,
      fetchQuery,
      createDateRange(lastFetchTime, sysInfo.time, timeZoneAndFormat.format),
      serviceIdToLastFetchDate,
    )

    return { changedObjectsQuery, serverTime: sysInfo.time, timeZoneAndFormat }
  }


  public async deploy({ changeGroup: { changes, groupID } }: DeployOptions): Promise<DeployResult> {
    const changesToDeploy = changes.map(cloneChange)
    const filtersRunner = this.createFiltersRunner({ changesGroupId: groupID })
    await filtersRunner.preDeploy(changesToDeploy)

    const deployResult = await this.client.deploy(
      changesToDeploy,
      groupID,
      this.additionalDependencies,
      elemID => this.elementsSource.has(elemID),
    )

    const ids = new Set(deployResult.appliedChanges.map(
      change => getChangeData(change).elemID.getFullName()
    ))

    const appliedChanges = changes
      .filter(change => ids.has(getChangeData(change).elemID.getFullName()))
      .map(cloneChange)

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
        filtersRunner: changesGroupId => this.createFiltersRunner({ changesGroupId }),
        elementsSource: this.elementsSource,
      }),
      getChangeGroupIds: getChangeGroupIdsFunc(this.client.isSuiteAppConfigured()),
      dependencyChanger,
    }
  }
}
