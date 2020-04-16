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
import { naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { Element as XmlElement } from 'xml-js'
import NetsuiteClient from './client/client'
import { createInstanceElement, createXmlElement } from './transformer'
import { Types } from './types'
import { IS_NAME, SCRIPT_ID, SCRIPT_ID_PREFIX } from './constants'

const log = logger(module)

export interface NetsuiteAdapterParams {
  client: NetsuiteClient
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

const isCustomType = (type: ObjectType): boolean =>
  !_.isUndefined(Types.customTypes[type.elemID.name.toLowerCase()])

const nameField = (type: ObjectType): Field =>
  Object.values(type.fields).find(field => field.annotations[IS_NAME]) as Field

const addDefaults = (instance: InstanceElement): void => {
  if (_.isUndefined(instance.value[SCRIPT_ID])) {
    const { type } = instance
    const scriptIdPrefix = type.annotations[SCRIPT_ID_PREFIX]
    const name = naclCase(instance.value[nameField(type).name]).toLowerCase()
    instance.value[SCRIPT_ID] = `${scriptIdPrefix}${name}`
  }
}

export default class NetsuiteAdapter {
  private readonly client: NetsuiteClient

  public constructor({ client }: NetsuiteAdapterParams) {
    this.client = client
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given Netsuite account.
   * Account credentials were given in the constructor.
   */
  public async fetch(): Promise<FetchResult> {
    const customObjectXmls = await this.client.listCustomObjects().catch(e => {
      log.error('failed to list custom objects reason: %o', e)
      return [] as XmlElement[]
    })
    const instances = customObjectXmls.map(customObjectXml => {
      const type = Types.customTypes[customObjectXml.name as string]
      return type ? createInstanceElement(customObjectXml, type) : undefined
    }).filter(isInstanceElement)
    return { elements: [...Types.getAllTypes(), ...instances] }
  }

  public async add(instance: InstanceElement): Promise<InstanceElement> {
    if (isCustomType(instance.type)) {
      addDefaults(instance)
      await this.addOrUpdateCustomTypeInstance(instance)
      return instance
    }
    throw Error('Salto currently supports adding instances of customTypes only')
  }

  public async remove(_element: Element): Promise<void> { // todo: implement
    // eslint-disable-next-line no-console
    console.log(this.client)
  }

  public async update(before: InstanceElement, after: InstanceElement): Promise<InstanceElement> {
    if (isCustomType(after.type)) {
      validateServiceIds(before, after)
      await this.addOrUpdateCustomTypeInstance(after)
      return after
    }
    throw Error('Salto currently supports updating instances of customTypes only')
  }

  private async addOrUpdateCustomTypeInstance(instance: InstanceElement): Promise<void> {
    const xmlElement = createXmlElement(instance)
    return this.client.deployCustomObject(instance.value[SCRIPT_ID], xmlElement)
  }
}
