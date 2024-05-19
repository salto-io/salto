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
import {
  FetchResult,
  AdapterOperations,
  DeployOptions,
  ElemIdGetter,
  ReadOnlyElementsSource,
  ProgressReporter,
  FetchOptions,
  DeployModifiers,
  getChangeData,
  isObjectType,
  isInstanceElement,
  ElemID,
  isSaltoElementError,
  setPartialFetchData,
  InstanceElement,
  ObjectType,
  TypeElement,
  ChangeDataType,
  FixElementsFunc,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { filter, logDuration } from '@salto-io/adapter-utils'
import { combineElementFixers } from '@salto-io/adapter-components'
import { createElements } from './transformer'
import { DeployResult, TYPES_TO_SKIP, isCustomRecordType } from './types'
import { BUNDLE } from './constants'
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
import dataAccountSpecificValues from './filters/data_account_specific_values'
import dataInstancesReferences from './filters/data_instances_references'
import dataTypesCustomFields from './filters/data_types_custom_fields'
import dataInstancesCustomFields from './filters/data_instances_custom_fields'
import dataInstancesAttributes from './filters/data_instances_attributes'
import dataInstancesNullFields from './filters/data_instances_null_fields'
import dataInstancesDiff from './filters/data_instances_diff'
import dataInstancesIdentifiers from './filters/data_instances_identifiers'
import addReferencingWorkbooks from './filters/add_referencing_workbooks'
import analyticsDefinitionHandle from './filters/analytics_definition_handle'
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
import addAliasFilter from './filters/add_alias'
import addImportantValuesFilter from './filters/add_important_values'
import addBundleReferences from './filters/bundle_ids'
import fixOrderProblemsInWorkbooks from './filters/fix_order_problems_in_workbooks'
import excludeCustomRecordTypes from './filters/exclude_by_criteria/exclude_custom_record_types'
import excludeInstances from './filters/exclude_by_criteria/exclude_instances'
import workflowAccountSpecificValues from './filters/workflow_account_specific_values'
import alignFieldNamesFilter from './filters/align_field_names'
import {
  Filter,
  LocalFilterCreator,
  LocalFilterCreatorDefinition,
  RemoteFilterCreator,
  RemoteFilterCreatorDefinition,
  RemoteFilterOpts,
} from './filter'
import restoreDeletedListItemsWithoutScriptId from './filters/restore_deleted_list_items_without_scriptid'
import restoreDeletedListItems from './filters/restore_deleted_list_items'
import addPermissionsToCustomRecordAndRole from './filters/add_permissions_to_cutomRecord_and_roles'
import { getLastServerTime, getOrCreateServerTimeElements, getLastServiceIdToFetchTime } from './server_time'
import { getChangedObjects } from './changes_detector/changes_detector'
import { FetchDeletionResult, getDeletedElements } from './deletion_calculator'
import NetsuiteClient from './client/client'
import { createDateRange, getTimeDateFormat, TimeZoneAndFormat } from './changes_detector/date_formats'
import { createElementsSourceIndex } from './elements_source_index/elements_source_index'
import getChangeValidator from './change_validator'
import dependencyChanger from './dependency_changer'
import { cloneChange } from './change_validators/utils'
import { getChangeGroupIdsFunc } from './group_changes'
import { getCustomRecords } from './custom_records/custom_records'
import { getDataElements } from './data_elements/data_elements'
import { getSuiteQLTableElements } from './data_elements/suiteql_table_elements'
import { getStandardTypesNames } from './autogen/types'
import { getConfigTypes, toConfigElements } from './suiteapp_config_elements'
import { ImportFileCabinetResult } from './client/types'
import {
  DEFAULT_VALIDATE,
  DEFAULT_MAX_FILE_CABINET_SIZE_IN_GB,
  ALL_TYPES_REGEX,
  DEFAULT_WARN_STALE_DATA,
  DEFAULT_DEPLOY_REFERENCED_ELEMENTS,
} from './config/constants'
import {
  FetchByQueryFunc,
  NetsuiteQuery,
  FetchByQueryReturnType,
  andQuery,
  FetchByQueryFailures,
  buildNetsuiteQuery,
  convertToQueryParams,
  notQuery,
} from './config/query'
import { getConfigFromConfigChanges } from './config/suggestions'
import { NetsuiteConfig, AdditionalDependencies, QueryParams, NetsuiteQueryParameters, ObjectID } from './config/types'
import { buildNetsuiteBundlesQuery } from './config/bundle_query'
import { customReferenceHandlers } from './custom_references'

const { makeArray } = collections.array
const { awu } = collections.asynciterable

const log = logger(module)

export const allFilters: (LocalFilterCreatorDefinition | RemoteFilterCreatorDefinition)[] = [
  { creator: restoreDeletedListItems },
  { creator: restoreDeletedListItemsWithoutScriptId },
  { creator: customRecordTypesType },
  { creator: omitSdfUntypedValues },
  { creator: dataInstancesIdentifiers },
  { creator: dataInstancesDiff },
  // addParentFolder must run before replaceElementReferences
  { creator: addParentFolder },
  { creator: convertLists },
  { creator: parseReportTypes },
  // analyticsDefinitionHandle must run after convertLists
  // and before translationConverter and replaceElementReferences
  { creator: analyticsDefinitionHandle },
  { creator: consistentValues },
  // convertListsToMaps must run after convertLists and consistentValues
  // and must run before replaceElementReferences
  { creator: convertListsToMaps },
  // alignFieldNamesFilter should run before excludeInstances on fetch and before
  // convertListsToMaps on deploy, because convertListsToMaps replace the type of the change
  { creator: alignFieldNamesFilter },
  // excludeCustomRecordTypes & excludeInstances should run after parsing & transforming filters,
  // so users will be able to exclude elements based on parsed/transformed values.
  { creator: excludeCustomRecordTypes },
  { creator: excludeInstances },
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
  { creator: dataAccountSpecificValues },
  { creator: suiteAppInternalIds },
  { creator: currencyExchangeRate },
  // AuthorInformation filters must run after SDFInternalIds filter
  { creator: systemNoteAuthorInformation, addsNewInformation: true },
  // savedSearchesAuthorInformation must run before suiteAppConfigElementsFilter
  { creator: savedSearchesAuthorInformation, addsNewInformation: true },
  { creator: translationConverter },
  { creator: accountSpecificValues },
  // the preDeploy of workflowAccountSpecificValues should run before accountSpecificValues
  { creator: workflowAccountSpecificValues, addsNewInformation: true },
  { creator: suiteAppConfigElementsFilter },
  { creator: configFeaturesFilter },
  { creator: customRecordsFilter },
  { creator: addInstancesFetchTime },
  { creator: addAliasFilter },
  { creator: addImportantValuesFilter },
  { creator: fixOrderProblemsInWorkbooks },
  // serviceUrls must run after suiteAppInternalIds and SDFInternalIds filter
  { creator: serviceUrls, addsNewInformation: true },
  { creator: addBundleReferences },
  { creator: addPermissionsToCustomRecordAndRole },
  // omitFieldsFilter should be the last onFetch filter to run
  { creator: omitFieldsFilter },
  // additionalChanges should be right after addReferencingWorkbooks
  // (adds required referenced elements to the deployent)
  { creator: additionalChanges },
  // addReferencingWorkbooks should be the first preDeploy filter to run (adds workbooks to the deployment)
  { creator: addReferencingWorkbooks },
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
  private fixElementsFunc: FixElementsFunc
  private readonly fetchInclude: QueryParams
  private readonly fetchExclude: QueryParams
  private readonly lockedElements?: QueryParams
  private readonly fetchTarget?: NetsuiteQueryParameters
  private readonly withPartialDeletion?: boolean
  private readonly skipList?: NetsuiteQueryParameters // old version
  private readonly useChangesDetection: boolean | undefined // TODO remove this from config SALTO-3676
  private createFiltersRunner: (
    params:
      | {
          operation: 'fetch'
          isPartial: boolean
          fetchTime: Date | undefined
          timeZoneAndFormat: TimeZoneAndFormat
          deletedElements: ElemID[]
        }
      | {
          operation: 'deploy'
          changesGroupId: string
        },
  ) => Required<Filter>

  public constructor({
    client,
    elementsSource,
    filtersCreators = defaultFilters,
    typesToSkip = TYPES_TO_SKIP,
    filePathRegexSkipList = [],
    getElemIdFunc,
    config,
  }: NetsuiteAdapterParams) {
    this.client = client
    this.elementsSource = elementsSource
    this.typesToSkip = typesToSkip.concat(makeArray(config.typesToSkip))
    this.filePathRegexSkipList = filePathRegexSkipList.concat(makeArray(config.filePathRegexSkipList))
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
    this.fetchInclude = config.fetch.include
    this.fetchExclude = config.fetch.exclude
    this.lockedElements = config.fetch.lockedElementsToExclude
    this.fetchTarget = config.fetchTarget
    this.withPartialDeletion = config.withPartialDeletion
    this.skipList = config.skipList // old version
    this.useChangesDetection = config.useChangesDetection
    this.deployReferencedElements = config.deploy?.deployReferencedElements ?? config.deployReferencedElements
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
    this.createFiltersRunner = params => {
      const getFilterOpts = (): RemoteFilterOpts => {
        switch (params.operation) {
          case 'fetch':
            return {
              client: this.client,
              elementsSourceIndex: createElementsSourceIndex(
                this.elementsSource,
                params.isPartial,
                params.deletedElements,
              ),
              elementsSource: this.elementsSource,
              isPartial: params.isPartial,
              config,
              timeZoneAndFormat: params.timeZoneAndFormat,
              fetchTime: params.fetchTime,
            }
          case 'deploy':
            return {
              client: this.client,
              elementsSourceIndex: createElementsSourceIndex(this.elementsSource, false),
              elementsSource: this.elementsSource,
              isPartial: false,
              config,
              changesGroupId: params.changesGroupId,
            }
          default:
            throw new Error('unknown operation param')
        }
      }
      return filter.filtersRunner(getFilterOpts(), filtersCreators)
    }

    this.fixElementsFunc = combineElementFixers(
      _.mapValues(customReferenceHandlers, handler => handler.removeWeakReferences({ elementsSource })),
    )
  }

  public fetchByQuery: FetchByQueryFunc = async (
    fetchQuery: NetsuiteQuery,
    progressReporter: ProgressReporter,
    useChangesDetection: boolean,
    isPartial: boolean,
  ): Promise<FetchByQueryReturnType> => {
    const [configRecords, installedBundles] = await Promise.all([
      this.client.getConfigRecords(),
      this.client.getInstalledBundles(),
    ])
    const { query: netsuiteBundlesQuery, bundlesToInclude } = buildNetsuiteBundlesQuery(
      installedBundles,
      this.userConfig.excludeBundles ?? [],
    )
    const fetchQueryWithBundles = andQuery(fetchQuery, netsuiteBundlesQuery)
    const timeZoneAndFormat = getTimeDateFormat(configRecords)
    const { changedObjectsQuery, serverTime } = await this.runSuiteAppOperations(
      fetchQueryWithBundles,
      useChangesDetection,
      timeZoneAndFormat,
    )
    const updatedFetchQuery =
      changedObjectsQuery !== undefined ? andQuery(changedObjectsQuery, fetchQueryWithBundles) : fetchQueryWithBundles

    const importFileCabinetContent = async (): Promise<ImportFileCabinetResult> => {
      progressReporter.reportProgress({ message: 'Fetching file cabinet items' })
      const result = await this.client.importFileCabinetContent(
        updatedFetchQuery,
        this.userConfig.client?.maxFileCabinetSizeInGB ?? DEFAULT_MAX_FILE_CABINET_SIZE_IN_GB,
      )
      progressReporter.reportProgress({ message: 'Fetching instances' })
      return result
    }

    const getStandardAndCustomElements = async (): Promise<{
      standardInstances: InstanceElement[]
      standardTypes: TypeElement[]
      customRecordTypes: ObjectType[]
      customRecords: InstanceElement[]
      instancesIds: ObjectID[]
      failures: Omit<FetchByQueryFailures, 'largeSuiteQLTables'>
    }> => {
      const [
        { elements: fileCabinetContent, failedPaths: failedFilePaths },
        { elements: customObjects, instancesIds, failedToFetchAllAtOnce, failedTypes },
      ] = await Promise.all([
        importFileCabinetContent(),
        this.client.getCustomObjects(getStandardTypesNames(), {
          updatedFetchQuery,
          originFetchQuery: fetchQueryWithBundles,
        }),
      ])
      const bundlesCustomInfo = bundlesToInclude.map(bundle => ({
        typeName: BUNDLE,
        values: { ...bundle, id: bundle.id.toString() },
      }))
      const elementsToCreate = [
        ...customObjects,
        ...fileCabinetContent,
        ...(this.userConfig.fetch.addBundles !== false ? bundlesCustomInfo : []),
      ]
      const elements = await createElements(elementsToCreate, this.getElemIdFunc)
      const [standardInstances, types] = _.partition(elements, isInstanceElement)
      const [objectTypes, otherTypes] = _.partition(types, isObjectType)
      const [customRecordTypes, standardTypes] = _.partition(objectTypes, isCustomRecordType)
      const { elements: customRecords, largeTypesError: failedCustomRecords } = await getCustomRecords(
        this.client,
        customRecordTypes,
        fetchQueryWithBundles,
        this.getElemIdFunc,
      )
      return {
        standardInstances,
        standardTypes: [...standardTypes, ...otherTypes],
        customRecordTypes,
        customRecords,
        instancesIds,
        failures: { failedCustomRecords, failedFilePaths, failedToFetchAllAtOnce, failedTypes },
      }
    }

    const [
      { standardInstances, standardTypes, customRecordTypes, customRecords, instancesIds, failures },
      { elements: dataElements, requestedTypes: requestedDataTypes, largeTypesError: dataTypeError },
      { elements: suiteQLTableElements, largeSuiteQLTables },
    ] = await Promise.all([
      getStandardAndCustomElements(),
      getDataElements(this.client, fetchQueryWithBundles, this.getElemIdFunc),
      getSuiteQLTableElements(this.userConfig, this.client, this.elementsSource, isPartial),
    ])

    progressReporter.reportProgress({ message: 'Running filters for additional information' })

    failures.failedTypes.excludedTypes = failures.failedTypes.excludedTypes.concat(dataTypeError)
    const suiteAppConfigElements = this.client.isSuiteAppConfigured()
      ? toConfigElements(configRecords, fetchQueryWithBundles).concat(getConfigTypes())
      : []

    // we calculate deleted elements only in partial-fetch mode
    const { deletedElements = [], errors: deletedElementErrors }: FetchDeletionResult =
      isPartial && this.withPartialDeletion !== false
        ? await getDeletedElements({
            client: this.client,
            elementsSource: this.elementsSource,
            fetchQuery: fetchQueryWithBundles,
            serviceInstanceIds: instancesIds,
            requestedCustomRecordTypes: customRecordTypes,
            serviceCustomRecords: customRecords,
            requestedDataTypes,
            serviceDataElements: dataElements.filter(isInstanceElement),
          })
        : {}

    const serverTimeElements =
      serverTime !== undefined ? await getOrCreateServerTimeElements(serverTime, this.elementsSource, isPartial) : []

    const elements = ([] as ChangeDataType[])
      .concat(standardInstances)
      .concat(standardTypes)
      .concat(customRecordTypes)
      .concat(customRecords)
      .concat(dataElements)
      .concat(suiteQLTableElements)
      .concat(suiteAppConfigElements)
      .concat(serverTimeElements)

    await this.createFiltersRunner({
      operation: 'fetch',
      isPartial,
      fetchTime: serverTime,
      timeZoneAndFormat,
      deletedElements,
    }).onFetch(elements)

    return {
      failures: { ...failures, largeSuiteQLTables },
      elements,
      deletedElements,
      deletedElementErrors,
    }
  }

  private shouldFetchWithChangesDetection(shouldFetchWithChangesDetectionParams: {
    withChangesDetection: boolean
    hasFetchTarget: boolean
    isFirstFetch: boolean
  }): boolean {
    return (
      !shouldFetchWithChangesDetectionParams.isFirstFetch &&
      (this.useChangesDetection === true ||
        shouldFetchWithChangesDetectionParams.withChangesDetection ||
        // by default when having fetch target we prefer to fetch with change detection (unless explicitly disabled)
        (shouldFetchWithChangesDetectionParams.hasFetchTarget && this.useChangesDetection !== false))
    )
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given Netsuite account.
   * Account credentials were given in the constructor.
   */

  @logDuration('fetching account configuration')
  public async fetch({ progressReporter, withChangesDetection = false }: FetchOptions): Promise<FetchResult> {
    const isFirstFetch = !(await awu(await this.elementsSource.list()).find(e => !e.isConfigType()))
    const hasFetchTarget = this.fetchTarget !== undefined
    if (hasFetchTarget && isFirstFetch) {
      throw new Error("Can't define fetchTarget for the first fetch. Remove fetchTarget from adapter config file")
    }

    const deprecatedSkipList = buildNetsuiteQuery(
      convertToQueryParams({
        types: Object.fromEntries(this.typesToSkip.map(typeName => [typeName, [ALL_TYPES_REGEX]])),
        filePaths: this.filePathRegexSkipList.map(reg => `.*${reg}.*`),
      }),
    )
    const fetchQuery = [
      buildNetsuiteQuery(this.fetchInclude),
      this.fetchTarget && buildNetsuiteQuery(convertToQueryParams(this.fetchTarget)),
      notQuery(buildNetsuiteQuery(this.fetchExclude)),
      this.lockedElements && notQuery(buildNetsuiteQuery(this.lockedElements)),
      this.skipList && notQuery(buildNetsuiteQuery(convertToQueryParams(this.skipList))),
      notQuery(deprecatedSkipList),
    ]
      .filter(values.isDefined)
      .reduce(andQuery)

    const fetchWithChangesDetection = this.shouldFetchWithChangesDetection({
      withChangesDetection,
      hasFetchTarget,
      isFirstFetch,
    })
    const isPartial = fetchWithChangesDetection || hasFetchTarget

    const { failures, elements, deletedElements, deletedElementErrors } = await this.fetchByQuery(
      fetchQuery,
      progressReporter,
      fetchWithChangesDetection,
      isPartial,
    )

    const updatedConfig = getConfigFromConfigChanges(failures, this.userConfig)

    const partialFetchData = setPartialFetchData(isPartial, deletedElements)

    if (_.isUndefined(updatedConfig)) {
      return { elements, errors: deletedElementErrors, partialFetchData }
    }
    return { elements, updatedConfig, errors: deletedElementErrors, partialFetchData }
  }

  private async runSuiteAppOperations(
    fetchQuery: NetsuiteQuery,
    useChangesDetection: boolean,
    timeZoneAndFormat: TimeZoneAndFormat,
  ): Promise<{
    changedObjectsQuery?: NetsuiteQuery
    serverTime?: Date
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
    if (timeZoneAndFormat?.format === undefined) {
      log.warn('Failed to get date format, skipping changes detection')
      return { serverTime: sysInfo.time }
    }
    const serviceIdToLastFetchDate = await getLastServiceIdToFetchTime(this.elementsSource)
    const changedObjectsQuery = await getChangedObjects(
      this.client,
      fetchQuery,
      createDateRange(lastFetchTime, sysInfo.time, timeZoneAndFormat.format),
      serviceIdToLastFetchDate,
    )

    return { changedObjectsQuery, serverTime: sysInfo.time }
  }

  private static getDeployErrors(
    originalChanges: DeployOptions['changeGroup']['changes'],
    deployResult: DeployResult,
  ): DeployResult['errors'] {
    const originalChangesElemIds = new Set(originalChanges.map(change => getChangeData(change).elemID.getFullName()))

    const [saltoElementErrors, saltoErrors] = _.partition(deployResult.errors, isSaltoElementError)
    const [originalChangesErrors, additionalChangesErrors] = _.partition(saltoElementErrors, error =>
      originalChangesElemIds.has(error.elemID.createBaseID().parent.getFullName()),
    )

    const errorsOnCustomFieldsByParents = _(originalChangesErrors)
      .filter(error => error.elemID.idType === 'field')
      .groupBy(error => error.elemID.createTopLevelParentID().parent.getFullName())
      .mapValues(errors => new Set(errors.map(error => error.message)))
      .value()

    additionalChangesErrors.forEach(error => {
      const errorsOnFields = errorsOnCustomFieldsByParents[error.elemID.createBaseID().parent.getFullName()]
      if (!errorsOnFields?.has(error.message)) {
        saltoErrors.push({ message: error.message, severity: error.severity })
      }
    })

    return [...originalChangesErrors, ...saltoErrors]
  }

  @logDuration('deploying account configuration')
  public async deploy({ changeGroup: { changes, groupID } }: DeployOptions): Promise<DeployResult> {
    const changesToDeploy = changes.map(cloneChange)
    const filtersRunner = this.createFiltersRunner({ operation: 'deploy', changesGroupId: groupID })
    await filtersRunner.preDeploy(changesToDeploy)

    const deployResult = await this.client.deploy(changesToDeploy, groupID, this.additionalDependencies, elemID =>
      this.elementsSource.has(elemID),
    )

    const ids = new Set(deployResult.appliedChanges.map(change => getChangeData(change).elemID.getFullName()))

    const appliedChanges = changes
      .filter(change => ids.has(getChangeData(change).elemID.getFullName()))
      .map(cloneChange)

    await filtersRunner.onDeploy(appliedChanges, deployResult)

    return {
      errors: NetsuiteAdapter.getDeployErrors(changes, deployResult),
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
        deployReferencedElements: this.deployReferencedElements ?? DEFAULT_DEPLOY_REFERENCED_ELEMENTS,
        validate: this.validateBeforeDeploy,
        additionalDependencies: this.additionalDependencies,
        filtersRunner: changesGroupId => this.createFiltersRunner({ operation: 'deploy', changesGroupId }),
        elementsSource: this.elementsSource,
        userConfig: this.userConfig,
      }),
      getChangeGroupIds: getChangeGroupIdsFunc(this.client.isSuiteAppConfigured()),
      dependencyChanger,
    }
  }

  fixElements: FixElementsFunc = elements => this.fixElementsFunc(elements)
}
