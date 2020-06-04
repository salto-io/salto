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
  BuiltinTypes, Element, FetchResult, Field, InstanceElement, isInstanceElement, ObjectType,
} from '@salto-io/adapter-api'
import { naclCase, resolveValues, restoreValues } from '@salto-io/adapter-utils'
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
import { IS_NAME, SCRIPT_ID, SCRIPT_ID_PREFIX, SAVED_SEARCH } from './constants'

const log = logger(module)

export interface NetsuiteAdapterParams {
  client: NetsuiteClient
  // Types that we skip their deployment and fetch
  typesToSkip?: string[]
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

const nameField = (type: ObjectType): Field =>
  Object.values(type.fields).find(field => field.annotations[IS_NAME]) as Field

const addCustomTypeDefaults = (instance: InstanceElement): void => {
  if (_.isUndefined(instance.value[SCRIPT_ID])) {
    const { type } = instance
    const scriptIdPrefix = type.annotations[SCRIPT_ID_PREFIX]
    const name = naclCase(instance.value[nameField(type).name]).toLowerCase()
    instance.value[SCRIPT_ID] = `${scriptIdPrefix}${name}`
  }
}

export default class NetsuiteAdapter {
  private readonly client: NetsuiteClient
  private readonly typesToSkip: string[]

  public constructor({
    client,
    typesToSkip = [
      SAVED_SEARCH, // Due to https://github.com/oracle/netsuite-suitecloud-sdk/issues/127 we receive changes each fetch
    ],
  }: NetsuiteAdapterParams) {
    this.client = client
    this.typesToSkip = typesToSkip
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
    const fileCabinetContent = this.client.importFileCabinet().catch(e => {
      log.error('failed to import file cabinet content. reason: %o', e)
      return [] as CustomizationInfo[]
    })
    const customizationInfos = _.flatten(await Promise.all([customObjects, fileCabinetContent]))
    const instances = customizationInfos.map(customizationInfo => {
      const type = customTypes[customizationInfo.typeName]
        ?? fileCabinetTypes[customizationInfo.typeName]
      return type && !this.shouldSkipType(type)
        ? createInstanceElement(customizationInfo, type) : undefined
    }).filter(isInstanceElement)
    return { elements: [...getAllTypes(), ...instances] }
  }

  private shouldSkipType(type: ObjectType): boolean {
    return this.typesToSkip.includes(type.elemID.name)
  }

  public async add(instance: InstanceElement): Promise<InstanceElement> {
    if (!isCustomType(instance.type) && !isFileCabinetType(instance.type)) {
      throw Error('Salto currently supports adding instances of customTypes and fileCabinet only')
    }
    if (this.shouldSkipType(instance.type)) {
      throw Error(`Salto skips adding ${instance.type.elemID.name} instances`)
    }
    const resolved = resolveValues(instance, getLookUpName)
    if (isCustomType(instance.type)) {
      addCustomTypeDefaults(resolved)
    }
    await this.addOrUpdateCustomizationInstance(resolved)
    return restoreValues(instance, resolved, getLookUpName)
  }

  public async remove(_element: Element): Promise<void> { // todo: implement
    // eslint-disable-next-line no-console
    console.log(this.client)
  }

  public async update(before: InstanceElement, after: InstanceElement): Promise<InstanceElement> {
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
}
