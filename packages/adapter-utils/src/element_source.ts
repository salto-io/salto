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
import wu from 'wu'

export type RecursiveSource = {
  isUpToDate: (signature: number) => boolean
  getSignature: () => number
  createSignature: () => Promise<void>
  refreshValue: () => Promise<void>
  getUpstreamSourcesBySignature: () => Map<number, RecursiveSource>
}

export const recursivelyValidateCache = async (source: RecursiveSource): Promise<number> => {
  let shouldRefresh = false
  const sourcesBySignature = source.getUpstreamSourcesBySignature()
  // use map rather than "every" because every upstream source should get the chance to refresh.
  await Promise.all(wu(sourcesBySignature.keys()).map(async signature => {
    const upstreamSource = sourcesBySignature.get(signature)
    if (upstreamSource) {
      shouldRefresh = shouldRefresh && upstreamSource.isUpToDate(signature) && (
        await recursivelyValidateCache(upstreamSource) === signature
      )
    }
  }))
  if (shouldRefresh) {
    await source.refreshValue()
    source.createSignature()
  }
  return source.getSignature()
}

export const buildElementsSourceFromElements = (elements: ReadonlyArray<Element>):
  ReadOnlyElementsSource => {
  const elementsMap = _.keyBy(elements, e => e.elemID.getFullName())

  return {
    getAll: async () => {
      async function *getElements(): AsyncIterable<Element> {
        for (const element of elements) {
          yield element
        }
      }
      return getElements()
    },
    get: async id => elementsMap[id.getFullName()],
    list: async () => {
      async function *getIds(): AsyncIterable<ElemID> {
        for (const element of elements) {
          yield element.elemID
        }
      }
      return getIds()
    },
    has: async id => id.getFullName() in elementsMap,
  }
}
