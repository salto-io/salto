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
import _ from 'lodash'
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import { ElemID, Element, placeholderReadonlyElementsSource } from '@salto-io/adapter-api'
import { TransformFunc, transformElement, safeJsonStringify } from '@salto-io/adapter-utils'
import { RemoteMapEntry, RemoteMap } from './remote_map'

const { awu } = collections.asynciterable

export type Path = readonly string[]

const getElementPathHints = async (element: Element): Promise<Iterable<RemoteMapEntry<Path[]>>> => {
  if (element.path === undefined) {
    return []
  }
  const pathHints = {
    [element.elemID.getFullName()]: [element.path],
  }
  _.keys(element.annotationRefTypes).forEach(key => {
    const id = element.elemID.createNestedID('annotation').createNestedID(key)
    if (element.path) {
      pathHints[id.getFullName()] = [element.path]
    }
  })
  const transformFunc: TransformFunc = ({ path, value }) => {
    if (path && element.path) {
      pathHints[path.getFullName()] = [element.path]
    }
    return _.isArrayLikeObject(value) ? undefined : value
  }
  await transformElement({
    element,
    transformFunc,
    strict: false,
    // This transformElement does not need to types so this can be used
    // Long term we should replace this with not using transformElement
    elementsSource: placeholderReadonlyElementsSource,
    // TODO: Does this work with the above?
    runOnFields: true,
  })
  return wu(_.entries(pathHints)).map(e => ({ key: e[0], value: e[1] }))
}

export const getElementsPathHints = async (unmergedElements: Element[]):
Promise<RemoteMapEntry<Path[]>[]> => {
  const elementIDsToEntries = await awu(unmergedElements)
    .flatMap(getElementPathHints)
    .groupBy(e => e.key)
  return Object.entries(elementIDsToEntries)
    .map(entry => ({ key: entry[0], value: entry[1].flatMap(val => val.value) }))
}

export const overridePathIndex = async (
  current: RemoteMap<Path[]>,
  unmergedElements: Element[],
): Promise<void> => {
  const entries = await getElementsPathHints(unmergedElements)
  await current.clear()
  await current.setAll(entries)
}

export const updatePathIndex = async (
  current: RemoteMap<Path[]>,
  unmergedElements: Element[],
  servicesToMaintain: string[]
): Promise<void> => {
  if (servicesToMaintain.length === 0) {
    await overridePathIndex(current, unmergedElements)
    return
  }
  const entries = await getElementsPathHints(unmergedElements)
  const oldPathHintsToMaintain = await awu(current.entries())
    .filter(e => servicesToMaintain.includes(ElemID.fromFullName(e.key).adapter))
    .concat(entries)
    .toArray()
  await current.clear()
  await current.setAll(awu(oldPathHintsToMaintain))
}

export const deserializedPathsIndex = (dataEntries: string[]): RemoteMapEntry<Path[], string>[] =>
  dataEntries.flatMap(data => JSON.parse(data)).map(e => ({ key: e[0], value: e[1] }))

export const serializedPathIndex = (entries: RemoteMapEntry<Path[], string>[]): string => (
  safeJsonStringify(Array.from(entries.map(e => [e.key, e.value] as [string, Path[]])))
)
export const serializePathIndexByService = (entries: RemoteMapEntry<Path[], string>[]):
Record<string, string> =>
  _.mapValues(
    _.groupBy(Array.from(entries), entry => ElemID.fromFullName(entry.key).adapter),
    e => serializedPathIndex(e),
  )
