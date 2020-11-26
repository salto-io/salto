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
import { Element, ElemID, Value } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { RemoteMap, InMemoryRemoteMap } from './remote_map'

const { awu } = collections.asynciterable

type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export interface ElementsSource {
  list(): Promise<AsyncIterable<ElemID>>
  get(id: ElemID): Promise<Element | Value>
  getAll(): Promise<AsyncIterable<Element>>
  flush(): Promise<void>
  clear(): Promise<void>
  rename(name: string): Promise<void>
}

export class RemoteElementSource {
  private elements: RemoteMap<Element>

  constructor(public name: string) {
    this.elements = new InMemoryRemoteMap(`${name}-elements`)
  }

  list(): AsyncIterable<ElemID> {
    return awu(this.elements.keys()).map(fullname => ElemID.fromFullName(fullname))
  }

  getAll(): AsyncIterable<Element> {
    return this.elements.values()
  }

  async get(id: ElemID): Promise<Element | undefined> {
    return this.elements.get(id.getFullName())
  }

  async set(element: Element): Promise<void> {
    return this.elements.set(element.elemID.getFullName(), element)
  }

  async delete(id: ElemID): Promise<void> {
    await this.elements.delete(id.getFullName())
  }

  async setAll(elements: ThenableIterable<Element>): Promise<void> {
    return this.elements.setAll(awu(elements).map(e => [e.elemID.getFullName(), e]))
  }

  async has(id: ElemID): Promise<boolean> {
    return this.elements.has(id.getFullName())
  }

  async overide(elements: ThenableIterable<Element>): Promise<void> {
    await this.elements.clear()
    return this.setAll(elements)
  }
}
