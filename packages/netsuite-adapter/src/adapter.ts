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
  BuiltinTypes, Element, FetchResult, InstanceElement, isInstanceElement, ObjectType,
  AdapterOperations, DeployResult, ChangeGroup, ElemIdGetter,
} from '@salto-io/adapter-api'
import { resolveValues, restoreValues, deployInstance } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import NetsuiteClient, {
  CustomizationInfo, isFileCustomizationInfo, isFolderCustomizationInfo,
} from './client/client'
import {
  createInstanceElement, getLookUpName, toCustomizationInfo,
} from './transformer'
import {
  customTypes, isCustomType, getAllTypes, fileCabinetTypes, isFileCabinetType,
} from './types'
import { SCRIPT_ID, SAVED_SEARCH } from './constants'

const log = logger(module)

export interface NetsuiteAdapterParams {
  client: NetsuiteClient
  // Types that we skip their deployment and fetch
  typesToSkip?: string[]
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
}

const validateServiceIds = (before: InstanceElement, after: InstanceElement): void => {
  const serviceIdsFields = Object.values(after.type.fields)
    .filter(field => field.type === BuiltinTypes.SERVICE_ID)
  serviceIdsFields.forEach(field => {
    if (before.value[field.name] !== after.value[field.name]) {
      throw Error(
        `Failed to update element as ${field.name} values prev=${before.value[field.name]} and new=${after.value[field.name]} are different`
      )
    }
  })
}

export default class NetsuiteAdapter implements AdapterOperations {
  private readonly client: NetsuiteClient
  private readonly typesToSkip: string[]
  private getElemIdFunc?: ElemIdGetter

  public constructor({
    client,
    typesToSkip = [
      SAVED_SEARCH, // Due to https://github.com/oracle/netsuite-suitecloud-sdk/issues/127 we receive changes each fetch
    ],
    getElemIdFunc,
  }: NetsuiteAdapterParams) {
    this.client = client
    this.typesToSkip = typesToSkip
    this.getElemIdFunc = getElemIdFunc
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given Netsuite account.
   * Account credentials were given in the constructor.
   */
  public async fetch(): Promise<FetchResult> {
    const customTypesToFetch = _.pull(Object.keys(customTypes), ...this.typesToSkip)
    const customObjects = this.client.listCustomObjects(customTypesToFetch).catch(e => {
      log.error('failed to list custom objects. reason: %o', e)
      return [] as CustomizationInfo[]
    })
    const fileCabinetContent = this.client.importFileCabinet().catch(e => {
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
    return { elements: [...getAllTypes(), ...instances] }
  }

  private shouldSkipType(type: ObjectType): boolean {
    return this.typesToSkip.includes(type.elemID.name)
  }

  private async add(instance: InstanceElement): Promise<InstanceElement> {
    if (!isCustomType(instance.type) && !isFileCabinetType(instance.type)) {
      throw Error('Salto currently supports adding instances of customTypes and fileCabinet only')
    }
    if (this.shouldSkipType(instance.type)) {
      throw Error(`Salto skips adding ${instance.type.elemID.name} instances`)
    }
    const resolved = resolveValues(instance, getLookUpName)
    await this.addOrUpdateCustomizationInstance(resolved)
    return restoreValues(instance, resolved, getLookUpName)
  }

  private async remove(_element: Element): Promise<void> { // todo: implement
    // eslint-disable-next-line no-console
    console.log(this.client)
  }

  private async update(before: InstanceElement, after: InstanceElement): Promise<InstanceElement> {
    if (!isCustomType(after.type) && !isFileCabinetType(after.type)) {
      throw Error('Salto currently supports updating instances of customTypes and fileCabinet only')
    }
    if (this.shouldSkipType(after.type)) {
      throw Error(`Salto skips updating ${after.type.elemID.name} instances`)
    }
    const resBefore = resolveValues(before, getLookUpName)
    const resAfter = resolveValues(after, getLookUpName)
    validateServiceIds(resBefore, resAfter)
    await this.addOrUpdateCustomizationInstance(resAfter)
    return restoreValues(after, resAfter, getLookUpName)
  }

  private async addOrUpdateCustomizationInstance(instance: InstanceElement): Promise<void> {
    const customizationInfo = toCustomizationInfo(instance)
    if (isFileCustomizationInfo(customizationInfo)) {
      return this.client.deployFile(customizationInfo)
    }
    if (isFolderCustomizationInfo(customizationInfo)) {
      return this.client.deployFolder(customizationInfo)
    }
    return this.client.deployCustomObject(instance.value[SCRIPT_ID], customizationInfo)
  }

  public async deploy(changeGroup: ChangeGroup): Promise<DeployResult> {
    const operations = {
      add: this.add.bind(this),
      remove: this.remove.bind(this),
      update: this.update.bind(this),
    }
    return deployInstance(operations, changeGroup)
  }
}
