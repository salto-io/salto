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
import { Element, FetchResult, isInstanceElement } from '@salto-io/adapter-api'
import NetsuiteClient from './client/client'
import { createInstanceElement } from './transformer'
import { Types } from './types'


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
  public async fetch(): Promise<FetchResult> {
    const customObjectXmls = await this.client.listCustomObjects()
    const instances = customObjectXmls.map(customObjectXml => {
      const type = Types.customTypes[customObjectXml.name as string]
      return type ? createInstanceElement(customObjectXml, type) : undefined
    }).filter(isInstanceElement)
    return { elements: [...Types.getAllTypes(), ...instances] }
  }

  public async add(element: Element): Promise<Element> { // todo: implement
    // eslint-disable-next-line no-console
    console.log(this.client)
    return Promise.resolve(element)
  }

  public async remove(_element: Element): Promise<void> { // todo: implement
    // eslint-disable-next-line no-console
    console.log(this.client)
  }

  public async update(_before: Element, after: Element): Promise<Element> { // todo: implement
    // eslint-disable-next-line no-console
    console.log(this.client)
    return Promise.resolve(after)
  }
}
