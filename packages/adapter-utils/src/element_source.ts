/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ReadOnlyElementsSource, Element, ElemID, Value, isElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { resolveTypeShallow } from './utils'

const { awu } = collections.asynciterable

const { findDuplicates } = collections.array
const { isDefined } = values
const log = logger(module)

export const buildElementsSourceFromElements = (
  elements: ReadonlyArray<Element>,
  fallbackSource?: ReadOnlyElementsSource
): ReadOnlyElementsSource => {
  const elementsMap = _.keyBy(elements, e => e.elemID.getFullName())
  if (Object.keys(elementsMap).length !== elements.length) {
    const duplicateNames = findDuplicates(elements.map(e => e.elemID.getFullName()))
    log.warn(`duplicate ElemIDs of elementSource found. the duplicates are ${duplicateNames}`)
  }
  const isIDInElementsMap = (id: ElemID): boolean => id.getFullName() in elementsMap

  let self: ReadOnlyElementsSource

  async function *getIds(): AsyncIterable<ElemID> {
    for (const element of elements) {
      yield element.elemID
    }
    if (fallbackSource === undefined) {
      return
    }
    for await (const elemID of await fallbackSource.list()) {
      if (!isIDInElementsMap(elemID)) {
        yield elemID
      }
    }
  }

  async function *getElements(): AsyncIterable<Element> {
    for (const element of elements) {
      yield element
    }
    if (fallbackSource === undefined) {
      return
    }
    for await (const element of await fallbackSource.getAll()) {
      if (!isIDInElementsMap(element.elemID)) {
        const clonedElement = element.clone()
        await resolveTypeShallow(clonedElement, self)
        yield clonedElement
      }
    }
  }

  self = {
    getAll: async () => getElements(),
    get: async id => elementsMap[id.getFullName()] ?? fallbackSource?.get(id),
    list: async () => getIds(),
    has: async id => isIDInElementsMap(id) || (fallbackSource?.has(id) ?? false),
  }
  return self
}

export const buildLazyShallowTypeResolverElementsSource = (
  elementsSource: ReadOnlyElementsSource
): ReadOnlyElementsSource => {
  const resolved: Record<string, Element> = {}
  const getElementWithResolvedShallowType = async (value: Value): ReturnType<ReadOnlyElementsSource['get']> => {
    if (!isElement(value)) {
      return value
    }
    const id = value.elemID.getFullName()
    const resolvedElement = resolved[id]
    if (isDefined(resolvedElement)) {
      return resolvedElement
    }
    await resolveTypeShallow(value, elementsSource)
    resolved[id] = value
    return value
  }
  return {
    get: async (id: ElemID) => getElementWithResolvedShallowType(await elementsSource.get(id)),
    getAll: async () => awu(await elementsSource.getAll())
      .map(getElementWithResolvedShallowType),
    list: async () => elementsSource.list(),
    has: async (id: ElemID) => elementsSource.has(id),
  }
}
