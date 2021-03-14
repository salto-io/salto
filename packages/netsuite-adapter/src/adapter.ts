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
  ElemIdGetter, Element, getChangeElement, InstanceElement, ReadOnlyElementsSource,
  FetchOptions, Field, BuiltinTypes, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  createInstanceElement, getLookUpName, toCustomizationInfo,
} from './transformer'
import {
  customTypes, getAllTypes, fileCabinetTypes,
} from './types'
import { TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, DEPLOY_REFERENCED_ELEMENTS,
  INTEGRATION, FETCH_TARGET, SKIP_LIST, LAST_FETCH_TIME } from './constants'
import replaceInstanceReferencesFilter from './filters/instance_references'
import convertLists from './filters/convert_lists'
import consistentValues from './filters/consistent_values'
import { FilterCreator } from './filter'
import {
  getConfigFromConfigChanges, NetsuiteConfig, DEFAULT_DEPLOY_REFERENCED_ELEMENTS,
} from './config'
import { getAllReferencedInstances, getRequiredReferencedInstances } from './reference_dependencies'
import { andQuery, buildNetsuiteQuery, NetsuiteQuery, NetsuiteQueryParameters, notQuery } from './query'
import { createServerTimeElements, getLastServerTime } from './server_time'
import { getChangedObjects } from './changes_detector/changes_detector'
import NetsuiteClient from './client/client'
import { createDateRange } from './changes_detector/date_formats'
import { createElementsSourceIndex } from './elements_source_index/elements_source_index'
import { LazyElementsSourceIndex } from './elements_source_index/types'

const { makeArray } = collections.array

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
  private filtersCreators: FilterCreator[]
  private readonly typesToSkip: string[]
  private readonly filePathRegexSkipList: string[]
  private readonly deployReferencedElements: boolean
  private readonly userConfig: NetsuiteConfig
  private getElemIdFunc?: ElemIdGetter
  private readonly fetchTarget?: NetsuiteQueryParameters
  private readonly skipList?: NetsuiteQueryParameters

  public constructor({
    client,
    elementsSource,
    filtersCreators = [
      convertLists,
      consistentValues,
      replaceInstanceReferencesFilter,
    ],
    typesToSkip = [
      INTEGRATION, // The imported xml has no values, especially no SCRIPT_ID, for standard
      // integrations and contains only SCRIPT_ID attribute for custom ones.
      // There is no value in fetching them as they contain no data and are not deployable.
      // If we decide to fetch them we should set the SCRIPT_ID by the xml's filename upon fetch.
    ],
    filePathRegexSkipList = [],
    deployReferencedElements = DEFAULT_DEPLOY_REFERENCED_ELEMENTS,
    getElemIdFunc,
    config,
  }: NetsuiteAdapterParams) {
    this.client = client
    this.elementsSource = elementsSource
    this.filtersCreators = filtersCreators
    this.typesToSkip = typesToSkip.concat(makeArray(config[TYPES_TO_SKIP]))
    this.filePathRegexSkipList = filePathRegexSkipList
      .concat(makeArray(config[FILE_PATHS_REGEX_SKIP_LIST]))
    this.deployReferencedElements = config[DEPLOY_REFERENCED_ELEMENTS] ?? deployReferencedElements
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
    this.fetchTarget = config[FETCH_TARGET]
    this.skipList = config[SKIP_LIST]
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given Netsuite account.
   * Account credentials were given in the constructor.
   */
  public async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    const elementsSourceIndex = createElementsSourceIndex(this.elementsSource)

    const deprecatedSkipList = buildNetsuiteQuery({
      types: Object.fromEntries(this.typesToSkip.map(typeName => [typeName, ['.*']])),
      filePaths: this.filePathRegexSkipList.map(reg => `.*${reg}.*`),
    })

    let fetchQuery = [
      this.fetchTarget && buildNetsuiteQuery(this.fetchTarget),
      this.skipList && notQuery(buildNetsuiteQuery(this.skipList)),
      notQuery(deprecatedSkipList),
    ].filter(values.isDefined).reduce(andQuery)


    const {
      changedObjectsQuery,
      serverTime,
    } = await this.runSuiteAppOperations(fetchQuery, elementsSourceIndex)
    fetchQuery = changedObjectsQuery !== undefined
      ? andQuery(changedObjectsQuery, fetchQuery)
      : fetchQuery

    const serverTimeElements = this.fetchTarget === undefined && serverTime !== undefined
      ? createServerTimeElements(serverTime)
      : []

    const isPartial = this.fetchTarget !== undefined

    const getCustomObjectsResult = this.client.getCustomObjects(
      Object.keys(customTypes),
      fetchQuery
    )
    const importFileCabinetResult = this.client.importFileCabinetContent(fetchQuery)
    const {
      elements: fileCabinetContent,
      failedPaths: failedFilePaths,
    } = await importFileCabinetResult
    progressReporter.reportProgress({ message: 'Finished fetching file cabinet instances. Fetching custom object instances' })

    const {
      elements: customObjects,
      failedToFetchAllAtOnce,
      failedTypeToInstances,
    } = await getCustomObjectsResult
    progressReporter.reportProgress({ message: 'Finished fetching instances. Running filters for additional information' })

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
    const instances = customizationInfos.map(customizationInfo => {
      const type = customTypes[customizationInfo.typeName]
        ?? fileCabinetTypes[customizationInfo.typeName]
      return type
        ? createInstanceElement(customizationInfo, type, this.getElemIdFunc, serverTime)
        : undefined
    }).filter(isInstanceElement)
    const elements = [...getAllTypes(), ...instances, ...serverTimeElements]

    progressReporter.reportProgress({ message: 'Finished fetching instances. Running filters for additional information' })
    await this.runFiltersOnFetch(elements, elementsSourceIndex, isPartial)
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
    elementsSourceIndex: LazyElementsSourceIndex
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

  private getAllRequiredReferencedInstances(
    changedInstances: ReadonlyArray<InstanceElement>
  ): ReadonlyArray<InstanceElement> {
    if (this.deployReferencedElements) {
      return getAllReferencedInstances(changedInstances)
    }
    return getRequiredReferencedInstances(changedInstances)
  }

  public async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const changedInstances = changeGroup.changes.map(getChangeElement).filter(isInstanceElement)
    const customizationInfosToDeploy = this.getAllRequiredReferencedInstances(changedInstances)
      .map(instance => resolveValues(instance, getLookUpName))
      .map(toCustomizationInfo)
    try {
      await this.client.deploy(customizationInfosToDeploy)
    } catch (e) {
      return { errors: [e], appliedChanges: [] }
    }
    return { errors: [], appliedChanges: changeGroup.changes }
  }

  private async runFiltersOnFetch(
    elements: Element[],
    elementsSourceIndex: LazyElementsSourceIndex,
    isPartial: boolean
  ): Promise<void> {
    // Fetch filters order is important so they should run one after the other
    return this.filtersCreators.map(filterCreator => filterCreator()).reduce(
      (prevRes, filter) => prevRes.then(() =>
        filter.onFetch({ elements, elementsSourceIndex, isPartial })),
      Promise.resolve(),
    )
  }
}
