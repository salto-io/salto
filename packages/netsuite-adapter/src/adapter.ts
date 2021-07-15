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
import {
  FetchResult, isInstanceElement, AdapterOperations, DeployResult, DeployOptions,
  ElemIdGetter, ReadOnlyElementsSource, Change,
  FetchOptions, Field, BuiltinTypes, CORE_ANNOTATIONS,
  DeployModifiers, InstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { filter } from '@salto-io/adapter-utils'
import {
  createInstanceElement,
} from './transformer'
import {
  customTypes, getMetadataTypes, fileCabinetTypes,
} from './types'
import { TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST,
  INTEGRATION, FETCH_TARGET, SKIP_LIST, LAST_FETCH_TIME, USE_CHANGES_DETECTION, FETCH, INCLUDE, EXCLUDE, DEPLOY, DEPLOY_REFERENCED_ELEMENTS } from './constants'
import replaceInstanceReferencesFilter from './filters/instance_references'
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
import rolesInternalId from './filters/roles_internal_id'
import { Filter, FilterCreator } from './filter'
import { getConfigFromConfigChanges, NetsuiteConfig, DEFAULT_DEPLOY_REFERENCED_ELEMENTS, DEFAULT_USE_CHANGES_DETECTION } from './config'
import { andQuery, buildNetsuiteQuery, NetsuiteQuery, NetsuiteQueryParameters, notQuery, QueryParams, convertToQueryParams } from './query'
import { createServerTimeElements, getLastServerTime } from './server_time'
import { getChangedObjects } from './changes_detector/changes_detector'
import NetsuiteClient from './client/client'
import { createDateRange } from './changes_detector/date_formats'
import { createElementsSourceIndex } from './elements_source_index/elements_source_index'
import { LazyElementsSourceIndexes } from './elements_source_index/types'
import getChangeValidator from './change_validator'
import { getChangeGroupIdsFunc } from './group_changes'
import { getDataTypes } from './data_elements/data_elements'

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
  private readonly userConfig: NetsuiteConfig
  private getElemIdFunc?: ElemIdGetter
  private readonly fetchInclude?: QueryParams
  private readonly fetchExclude?: QueryParams
  private readonly fetchTarget?: NetsuiteQueryParameters
  private readonly skipList?: NetsuiteQueryParameters // old version
  private readonly useChangesDetection: boolean
  private filtersRunner: Required<Filter>
  private elementsSourceIndex: LazyElementsSourceIndexes


  public constructor({
    client,
    elementsSource,
    filtersCreators = [
      // addParentFolder must run before replaceInstanceReferencesFilter
      addParentFolder,
      parseSavedSearch,
      convertLists,
      consistentValues,
      replaceInstanceReferencesFilter,
      serviceUrls,
      rolesInternalId,
      redundantFields,
      hiddenFields,
      replaceRecordRef,
      dataTypesCustomFields,
      dataInstancesCustomFields,
      removeUnsupportedTypes,
      dataInstancesReferences,
      dataInstancesInternalId,
    ],
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
    this.typesToSkip = typesToSkip.concat(makeArray(config[TYPES_TO_SKIP]))
    this.filePathRegexSkipList = filePathRegexSkipList
      .concat(makeArray(config[FILE_PATHS_REGEX_SKIP_LIST]))
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
    this.fetchInclude = config[FETCH]?.[INCLUDE]
    this.fetchExclude = config[FETCH]?.[EXCLUDE]
    this.fetchTarget = config[FETCH_TARGET]
    this.skipList = config[SKIP_LIST] // old version
    this.useChangesDetection = config[USE_CHANGES_DETECTION] ?? DEFAULT_USE_CHANGES_DETECTION
    this.deployReferencedElements = config[DEPLOY]?.[DEPLOY_REFERENCED_ELEMENTS]
     ?? config[DEPLOY_REFERENCED_ELEMENTS]
    this.elementsSourceIndex = createElementsSourceIndex(this.elementsSource)
    this.filtersRunner = filter.filtersRunner({
      client: this.client,
      elementsSourceIndex: this.elementsSourceIndex,
      elementsSource: this.elementsSource,
      isPartial: this.fetchTarget !== undefined,
    },
    filtersCreators)
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

    let fetchQuery = [
      this.fetchInclude && buildNetsuiteQuery(this.fetchInclude),
      this.fetchTarget && buildNetsuiteQuery(convertToQueryParams(this.fetchTarget)),
      this.fetchExclude && notQuery(buildNetsuiteQuery(this.fetchExclude)),
      this.skipList && notQuery(buildNetsuiteQuery(convertToQueryParams(this.skipList))),
      notQuery(deprecatedSkipList),
    ].filter(values.isDefined).reduce(andQuery)


    const {
      changedObjectsQuery,
      serverTime,
    } = await this.runSuiteAppOperations(fetchQuery, this.elementsSourceIndex)
    fetchQuery = changedObjectsQuery !== undefined
      ? andQuery(changedObjectsQuery, fetchQuery)
      : fetchQuery

    const serverTimeElements = this.fetchTarget === undefined && serverTime !== undefined
      ? createServerTimeElements(serverTime)
      : []

    const isPartial = this.fetchTarget !== undefined

    // TODO: Replace when data instances are ready
    // const dataElementsPromise = await getDataElements(this.client, fetchQuery)
    const dataElementsPromise = await getDataTypes(this.client)

    const getCustomObjectsResult = this.client.getCustomObjects(
      Object.keys(customTypes),
      fetchQuery
    )
    const importFileCabinetResult = this.client.importFileCabinetContent(fetchQuery)
    progressReporter.reportProgress({ message: 'Fetching file cabinet items' })

    const {
      elements: fileCabinetContent,
      failedPaths: failedFilePaths,
    } = await importFileCabinetResult

    progressReporter.reportProgress({ message: 'Fetching instances' })
    const {
      elements: customObjects,
      failedToFetchAllAtOnce,
      failedTypeToInstances,
    } = await getCustomObjectsResult

    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    _(Object.values(customTypes))
      .concat(Object.values(fileCabinetTypes))
      .forEach(type => {
        type.fields[LAST_FETCH_TIME] = new Field(
          type,
          LAST_FETCH_TIME,
          BuiltinTypes.STRING,
          { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
        )
      })

    const customizationInfos = [...customObjects, ...fileCabinetContent]
    const instances = await awu(customizationInfos).map(customizationInfo => {
      const type = customTypes[customizationInfo.typeName]
        ?? fileCabinetTypes[customizationInfo.typeName]
      return type
        ? createInstanceElement(customizationInfo, type, this.getElemIdFunc, serverTime)
        : undefined
    }).filter(isInstanceElement).toArray()

    const dataElements = await dataElementsPromise

    const elements = [
      ...getMetadataTypes(),
      ...dataElements,
      ...instances,
      ...serverTimeElements,
    ]

    await this.filtersRunner.onFetch(elements)
    const updatedConfig = getConfigFromConfigChanges(
      failedToFetchAllAtOnce, failedFilePaths, failedTypeToInstances, this.userConfig
    )

    if (_.isUndefined(updatedConfig)) {
      return { elements, isPartial }
    }
    return { elements, updatedConfig, isPartial }
  }

  private async runSuiteAppOperations(
    fetchQuery: NetsuiteQuery,
    elementsSourceIndex: LazyElementsSourceIndexes
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

    if (this.fetchTarget === undefined) {
      return {
        serverTime: sysInfo.time,
      }
    }

    if (!this.useChangesDetection) {
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

    const changedObjectsQuery = await getChangedObjects(
      this.client,
      fetchQuery,
      createDateRange(lastFetchTime, sysInfo.time),
      elementsSourceIndex,
    )

    return { changedObjectsQuery, serverTime: sysInfo.time }
  }


  public async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const changes = changeGroup.changes
      .map(change => ({
        action: change.action,
        data: _.mapValues(change.data, (element: InstanceElement) => element.clone()),
      })) as Change[]
    await this.filtersRunner.preDeploy(changes)
    return this.client.deploy(changes, changeGroup.groupID, this.deployReferencedElements
      ?? DEFAULT_DEPLOY_REFERENCED_ELEMENTS)
    // const changedInstances = changeGroup.changes.map(getChangeElement).filter(isInstanceElement)
    // const customizationInfosToDeploy = await awu(
    //   await this.getAllRequiredReferencedInstances(changedInstances)
    // ).map(async instance => resolveValues(instance, getLookUpName))
    //   .map(toCustomizationInfo)
    //   .toArray()
    // try {
    //   await this.client.deploy(customizationInfosToDeploy, this.deployReferencedElements)
    // } catch (e) {
    //   return { errors: [e], appliedChanges: [] }
    // }
    // return { errors: [], appliedChanges: changeGroup.changes }
  }

  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator: getChangeValidator(this.client.isSuiteAppConfigured()),
      getChangeGroupIds: getChangeGroupIdsFunc(this.client.isSuiteAppConfigured()),
    }
  }
}
