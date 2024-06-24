/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  Element,
  ElemID,
  Value,
  BuiltinTypesByFullName,
  ListType,
  MapType,
  isContainerType,
  ReadOnlyElementsSource,
  ContainerTypeName,
  TypeElement,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { resolvePath } from '@salto-io/adapter-utils'
import { RemoteMap, InMemoryRemoteMap } from './remote_map'

const { awu } = collections.asynciterable

type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

export interface ElementsSource {
  list(): Promise<AsyncIterable<ElemID>>
  has(id: ElemID): Promise<boolean>
  get(id: ElemID): Promise<Value>
  getAll(): Promise<AsyncIterable<Element>>
  flush(): Promise<void>
  clear(): Promise<void>
  rename(name: string): Promise<void>
  set(element: Readonly<Element>): Promise<void>
  setAll(elements: ThenableIterable<Element>): Promise<void>
  delete(id: ElemID): Promise<void>
  deleteAll(ids: ThenableIterable<ElemID>): Promise<void>
  isEmpty(): Promise<boolean>
}

export function buildContainerType<T extends TypeElement>(
  prefix: ContainerTypeName,
  innerType: T,
): MapType<T> | ListType<T>
export function buildContainerType(prefix: ContainerTypeName, innerType: undefined): undefined

export function buildContainerType(prefix: ContainerTypeName, innerType?: TypeElement): MapType | ListType | undefined {
  if (innerType === undefined) {
    return undefined
  }
  const typeCtors: Record<ContainerTypeName, new (innerType: TypeElement) => MapType | ListType> = {
    List: ListType,
    Map: MapType,
  }
  return new typeCtors[prefix](innerType)
}

export class RemoteElementSource implements ElementsSource {
  private elements: RemoteMap<Element>

  constructor(elementsMap: RemoteMap<Element>) {
    this.elements = elementsMap
  }

  async list(): Promise<AsyncIterable<ElemID>> {
    return awu(this.elements.keys()).map(fullname => ElemID.fromFullName(fullname))
  }

  async getAll(): Promise<AsyncIterable<Element>> {
    return this.elements.values()
  }

  async get(id: ElemID): Promise<Value | undefined> {
    const elemFullName = id.getFullName()
    if (BuiltinTypesByFullName[elemFullName] !== undefined) {
      return BuiltinTypesByFullName[elemFullName]
    }
    const containerTypeInfo = id.getContainerPrefixAndInnerType()
    if (containerTypeInfo !== undefined) {
      return buildContainerType(
        containerTypeInfo.prefix,
        await this.get(ElemID.fromFullName(containerTypeInfo.innerTypeName)),
      )
    }
    const { parent } = id.createTopLevelParentID()
    const topLevel = await this.elements.get(parent.getFullName())
    return topLevel && resolvePath(topLevel, id)
  }

  async set(element: Element): Promise<void> {
    if (!isContainerType(element)) {
      await this.elements.set(element.elemID.getFullName(), element)
    }
  }

  async delete(id: ElemID): Promise<void> {
    await this.elements.delete(id.getFullName())
  }

  async deleteAll(ids: ThenableIterable<ElemID>): Promise<void> {
    await this.elements.deleteAll(awu(ids).map(id => id.getFullName()))
  }

  async setAll(elements: ThenableIterable<Element>): Promise<void> {
    await this.elements.setAll(
      awu(elements)
        .filter(element => !isContainerType(element))
        .map(e => ({ key: e.elemID.getFullName(), value: e })),
    )
  }

  async has(id: ElemID): Promise<boolean> {
    return this.elements.has(id.getFullName())
  }

  async overide(elements: ThenableIterable<Element>): Promise<void> {
    await this.elements.clear()
    await this.setAll(elements)
  }

  async flush(): Promise<void> {
    await this.elements.flush()
  }

  async clear(): Promise<void> {
    await this.elements.clear()
  }

  // eslint-disable-next-line class-methods-use-this
  rename(_name: string): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async isEmpty(): Promise<boolean> {
    return this.elements.isEmpty()
  }
}

export const createInMemoryElementSource = (elements: readonly Element[] = []): RemoteElementSource => {
  const inMemMap = new InMemoryRemoteMap(elements.map(e => ({ key: e.elemID.getFullName(), value: e })))
  return new RemoteElementSource(inMemMap)
}

export const mapReadOnlyElementsSource = (
  source: ReadOnlyElementsSource,
  func: (orig: Element) => Promise<Element>,
): ReadOnlyElementsSource => ({
  get: async id => {
    const origValue = await source.get(id)
    return origValue !== undefined ? func(origValue) : undefined
  },
  getAll: async () =>
    awu(await source.getAll())
      .map(async element => func(element))
      .filter(values.isDefined),
  has: id => source.has(id),
  list: () => source.list(),
})
