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
import _ from 'lodash'
import { Element, InstanceElement, ObjectType, Change } from '@salto-io/adapter-api'
import NetsuiteClient from './client/client'
import { createInstanceElement, toNetsuiteRecord, Types } from './transformer'
import { ATTRIBUTES, INTERNAL_ID, METADATA_TYPE, SCRIPT_ID } from './constants'


export interface NetsuiteAdapterParams {
  client: NetsuiteClient
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
  public async fetch(): Promise<Element[]> {
    const objects = Types.customizationObjects
    const instances = await this.fetchInstances(Object.values(objects))
    return _.flatten([objects, instances] as Element[][])
  }

  private async fetchInstances(types: ObjectType[]): Promise<InstanceElement[]> {
    return _.flatten(await Promise.all(types.map(async type => {
      const customRecords = await this.client.listCustomizations(type.annotations[METADATA_TYPE])
      return customRecords.map(record => createInstanceElement(record, type))
    })))
  }

  public async add(instance: InstanceElement): Promise<InstanceElement> {
    const post = instance.clone()
    const reference = await this.client.add(toNetsuiteRecord(post))
    post.value[INTERNAL_ID] = reference[ATTRIBUTES][INTERNAL_ID]
    post.value[SCRIPT_ID] = reference[ATTRIBUTES][SCRIPT_ID]
    return post
  }

  public async remove(_element: Element): Promise<void> { // todo: implement
    // eslint-disable-next-line no-console
    console.log(this.client)
  }

  public async update(_before: Element, after: Element, _changes: Iterable<Change>):
    Promise<Element> { // todo: implement
    // eslint-disable-next-line no-console
    console.log(this.client)
    return Promise.resolve(after)
  }
}
