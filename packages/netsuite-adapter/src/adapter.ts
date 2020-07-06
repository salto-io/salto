/*
*                      Copyright 2020 Salto Labs Ltd.
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
  FetchResult, InstanceElement, isInstanceElement, ObjectType, AdapterOperations, DeployResult,
  ChangeGroup, ElemIdGetter, Element, isReferenceExpression, getChangeElement, getFieldType,
  BuiltinTypes, ElemID, isPrimitiveType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { resolveValues, transformElement, TransformFunc } from '@salto-io/adapter-utils'
import wu from 'wu'
import NetsuiteClient, { CustomizationInfo } from './client/client'
import {
  createInstanceElement, getLookUpName, toCustomizationInfo,
} from './transformer'
import {
  customTypes, getAllTypes, fileCabinetTypes,
} from './types'
import {
  SAVED_SEARCH, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST, FETCH_ALL_TYPES_AT_ONCE, NETSUITE,
} from './constants'
import replaceInstanceReferencesFilter from './filters/instance_references'
import { FilterCreator } from './filter'
import {
  getConfigFromConfigChanges, STOP_MANAGING_ITEMS_MSG, NetsuiteConfig,
} from './config'

const log = logger(module)
const { makeArray } = collections.array

export interface NetsuiteAdapterParams {
  client: NetsuiteClient
  // Filters to support special cases upon fetch
  filtersCreators?: FilterCreator[]
  // Types that we skip their deployment and fetch
  typesToSkip?: string[]
  // File paths regular expression that we skip their fetch
  filePathRegexSkipList?: string[]
  // Determines whether to attempt fetching all custom objects in a single call or type by type
  fetchAllTypesAtOnce?: boolean
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
  // config that is determined by the user
  config: NetsuiteConfig
}

export const findDependingInstancesFromRefs = (instance: InstanceElement): InstanceElement[] => {
  const visitedIdToInstance = new Map<string, InstanceElement>()
  const isRefToServiceId = (topLevelParent: InstanceElement, elemId: ElemID): boolean => {
    const fieldType = getFieldType(topLevelParent.type, [...elemId.createTopLevelParentID().path])
    return isPrimitiveType(fieldType) && fieldType.isEqual(BuiltinTypes.SERVICE_ID)
  }

  const createDependingElementsCallback: TransformFunc = ({ value }) => {
    if (isReferenceExpression(value)) {
      const { topLevelParent, elemId } = value
      if (isInstanceElement(topLevelParent)
        && !visitedIdToInstance.has(topLevelParent.elemID.getFullName())
        && isRefToServiceId(topLevelParent, elemId)
        && elemId.adapter === NETSUITE) {
        visitedIdToInstance.set(topLevelParent.elemID.getFullName(), topLevelParent)
      }
    }
    return value
  }

  transformElement({
    element: instance,
    transformFunc: createDependingElementsCallback,
    strict: true,
  })
  return wu(visitedIdToInstance.values()).toArray()
}

/**
 * This method runs recursively on all references of the changedInstance to identify dependencies
 * and then deploy the depending instances as well as part of the SDF project
 */
const getAllDependingInstances = (changedInstance: InstanceElement,
  visitedDependingIds: Set<string>): InstanceElement[] => {
  const dependingInstances = findDependingInstancesFromRefs(changedInstance)
    .filter(instance => !visitedDependingIds.has(instance.elemID.getFullName()))
  dependingInstances.forEach(instance => visitedDependingIds.add(instance.elemID.getFullName()))
  return _.flatten(dependingInstances.map(instance =>
    [instance, ...getAllDependingInstances(instance, visitedDependingIds)]))
}

export default class NetsuiteAdapter implements AdapterOperations {
  private readonly client: NetsuiteClient
  private filtersCreators: FilterCreator[]
  private readonly typesToSkip: string[]
  private readonly filePathRegexSkipList: RegExp[]
  private readonly fetchAllTypesAtOnce: boolean
  private readonly userConfig: NetsuiteConfig
  private getElemIdFunc?: ElemIdGetter

  public constructor({
    client,
    filtersCreators = [
      replaceInstanceReferencesFilter,
    ],
    typesToSkip = [
      SAVED_SEARCH, // Due to https://github.com/oracle/netsuite-suitecloud-sdk/issues/127 we receive changes each fetch
    ],
    filePathRegexSkipList = [],
    getElemIdFunc,
    config,
  }: NetsuiteAdapterParams) {
    this.client = client
    this.filtersCreators = filtersCreators
    this.typesToSkip = typesToSkip.concat(makeArray(config[TYPES_TO_SKIP]))
    this.filePathRegexSkipList = filePathRegexSkipList
      .concat(makeArray(config[FILE_PATHS_REGEX_SKIP_LIST]))
      .map(e => new RegExp(e))
    this.fetchAllTypesAtOnce = config[FETCH_ALL_TYPES_AT_ONCE] ?? true
    this.userConfig = config
    this.getElemIdFunc = getElemIdFunc
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given Netsuite account.
   * Account credentials were given in the constructor.
   */
  public async fetch(): Promise<FetchResult> {
    const customTypesToFetch = _.pull(Object.keys(customTypes), ...this.typesToSkip)
    const getCustomObjectsResult = this.client.getCustomObjects(customTypesToFetch,
      this.fetchAllTypesAtOnce)
    const fileCabinetContent = this.client.importFileCabinetContent(this.filePathRegexSkipList)
      .catch(e => {
        log.error('failed to import file cabinet content. reason: %o', e)
        return [] as CustomizationInfo[]
      })
    const {
      elements: customObjects,
      failedTypes,
      failedToFetchAllAtOnce,
    } = await getCustomObjectsResult

    const customizationInfos = _.flatten(await Promise.all([customObjects, fileCabinetContent]))
    const instances = customizationInfos.map(customizationInfo => {
      const type = customTypes[customizationInfo.typeName]
        ?? fileCabinetTypes[customizationInfo.typeName]
      return type && !this.shouldSkipType(type)
        ? createInstanceElement(customizationInfo, type, this.getElemIdFunc) : undefined
    }).filter(isInstanceElement)
    const elements = [...getAllTypes(), ...instances]
    this.runFiltersOnFetch(elements)
    const config = getConfigFromConfigChanges({
      ...(failedToFetchAllAtOnce ? { [FETCH_ALL_TYPES_AT_ONCE]: false } : {}),
      ...(!_.isEmpty(failedTypes) ? { [TYPES_TO_SKIP]: failedTypes } : {}),
    }, this.userConfig)

    if (_.isUndefined(config)) {
      return { elements }
    }
    return { elements, updatedConfig: { config, message: STOP_MANAGING_ITEMS_MSG } }
  }

  private shouldSkipType(type: ObjectType): boolean {
    return this.typesToSkip.includes(type.elemID.name)
  }

  public async deploy(changeGroup: ChangeGroup): Promise<DeployResult> {
    const changedInstances = changeGroup.changes.map(getChangeElement) as InstanceElement[]
    const visitedDependingIds = new Set(changedInstances.map(inst => inst.elemID.getFullName()))
    const instancesToDeploy = _.flatten(changedInstances.map(changedInstance =>
      [changedInstance, ...getAllDependingInstances(changedInstance, visitedDependingIds)]))
    const customizationInfosToDeploy = instancesToDeploy.map(instance => {
      const resAfter = resolveValues(instance, getLookUpName)
      return toCustomizationInfo(resAfter)
    })

    try {
      await this.client.deploy(customizationInfosToDeploy)
    } catch (e) {
      return { errors: [e], appliedChanges: [] }
    }
    return { errors: [], appliedChanges: changeGroup.changes }
  }

  private async runFiltersOnFetch(elements: Element[]): Promise<void> {
    // Fetch filters order is important so they should run one after the other
    return this.filtersCreators.map(filterCreator => filterCreator()).reduce(
      (prevRes, filter) => prevRes.then(() => filter.onFetch(elements)),
      Promise.resolve(),
    )
  }
}
