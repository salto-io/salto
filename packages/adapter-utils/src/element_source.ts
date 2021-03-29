/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ReadOnlyElementsSource, Element, ElemID } from '@salto-io/adapter-api'
import _ from 'lodash'

export const buildElementsSourceFromElements = (
  elements: ReadonlyArray<Element>,
  fallbackSource?: ReadOnlyElementsSource
): ReadOnlyElementsSource => {
  const elementsMap = _.keyBy(elements, e => e.elemID.getFullName())
  const isIDInElementsMap = (id: ElemID): boolean => id.getFullName() in elementsMap

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
        yield element
      }
    }
  }

  return {
    getAll: async () => getElements(),
    get: async id => elementsMap[id.getFullName()] ?? fallbackSource?.get(id),
    list: async () => getIds(),
    has: async id => isIDInElementsMap(id) || (fallbackSource?.has(id) ?? false),
  }
}
