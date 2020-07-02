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
  ChangeGroup, ElemIdGetter, Element,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-utils'
import { AdditionDiff, ModificationDiff } from '@salto-io/dag'
import NetsuiteClient, { CustomizationInfo } from './client/client'
import {
  createInstanceElement, getLookUpName, toCustomizationInfo,
} from './transformer'
import {
  customTypes, getAllTypes, fileCabinetTypes,
} from './types'
import { SAVED_SEARCH, TYPES_TO_SKIP, FILE_PATHS_REGEX_SKIP_LIST } from './constants'
import replaceInstanceReferencesFilter from './filters/instance_references'
import { FilterCreator } from './filter'

const log = logger(module)
const { makeArray } = collections.array

export type NetsuiteConfig = {
  [TYPES_TO_SKIP]?: string[]
  [FILE_PATHS_REGEX_SKIP_LIST]?: string[]
}

export interface NetsuiteAdapterParams {
  client: NetsuiteClient
  // Filters to support special cases upon fetch
  filtersCreators?: FilterCreator[]
  // Types that we skip their deployment and fetch
  typesToSkip?: string[]
  // File paths regular expression that we skip their fetch
  filePathRegexSkipList?: string[]
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
  // config that is determined by the user
  config: NetsuiteConfig
}

export default class NetsuiteAdapter implements AdapterOperations {
  private readonly client: NetsuiteClient
  private filtersCreators: FilterCreator[]
  private readonly typesToSkip: string[]
  private readonly filePathRegexSkipList: RegExp[]
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
    this.getElemIdFunc = getElemIdFunc
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given Netsuite account.
   * Account credentials were given in the constructor.
   */
  public async fetch(): Promise<FetchResult> {
    const customObjects = this.client.listCustomObjects().catch(e => {
      log.error('failed to list custom objects. reason: %o', e)
      return [] as CustomizationInfo[]
    })
    const fileCabinetContent = this.client.importFileCabinetContent(this.filePathRegexSkipList)
      .catch(e => {
        log.error('failed to import file cabinet content. reason: %o', e)
        return [] as CustomizationInfo[]
      })
    const customizationInfos = _.flatten(await Promise.all([customObjects, fileCabinetContent]))
    const instances = customizationInfos.map(customizationInfo => {
      const type = customTypes[customizationInfo.typeName]
        ?? fileCabinetTypes[customizationInfo.typeName]
      return type && !this.shouldSkipType(type)
        ? createInstanceElement(customizationInfo, type, this.getElemIdFunc) : undefined
    }).filter(isInstanceElement)
    const elements = [...getAllTypes(), ...instances]
    this.runFiltersOnFetch(elements)
    return { elements }
  }

  private shouldSkipType(type: ObjectType): boolean {
    return this.typesToSkip.includes(type.elemID.name)
  }

  public async deploy(changeGroup: ChangeGroup): Promise<DeployResult> {
    const customizationInfosToDeploy = (changeGroup.changes as (AdditionDiff<InstanceElement>
      | ModificationDiff<InstanceElement>)[])
      .map(change => {
        const resAfter = resolveValues(change.data.after, getLookUpName)
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
