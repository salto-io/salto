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
import { Element, ElemID } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections, hash } from '@salto-io/lowerdash'
import { updatePathIndex, overridePathIndex, PathIndex } from '../path_index'
import { State, StateData } from './state'

type ThenableIterable<T> = collections.asynciterable.ThenableIterable<T>

const { awu } = collections.asynciterable
const { toMD5 } = hash

type InMemoryState = State & {
  setVersion(version: string): Promise<void>
}

export const buildInMemState = (
  loadData: () => Promise<StateData>,
  persistent = true
): InMemoryState => {
  let innerStateData: Promise<StateData>
  const stateData = async (): Promise<StateData> => {
    if (innerStateData === undefined) {
      innerStateData = loadData()
    }
    return innerStateData
  }
  return {
    getAll: async (): Promise<AsyncIterable<Element>> => (await stateData()).elements.getAll(),
    list: async (): Promise<AsyncIterable<ElemID>> => (await stateData()).elements.list(),
    get: async (id: ElemID): Promise<Element | undefined> => (await stateData()).elements.get(id),
    has: async (id: ElemID): Promise<boolean> => (await stateData()).elements.has(id),
    delete: async (id: ElemID): Promise<void> => (await stateData()).elements.delete(id),
    deleteAll: async (ids: ThenableIterable<ElemID>): Promise<void> => (
      await stateData()).elements.deleteAll(ids),
    set: async (element: Element): Promise<void> => (await stateData()).elements.set(element),
    setAll: async (elements: ThenableIterable<Element>): Promise<void> => (
      await stateData()).elements.setAll(elements),
    remove: async (id: ElemID): Promise<void> => (await stateData()).elements.delete(id),
    isEmpty: async (): Promise<boolean> => (await stateData()).elements.isEmpty(),
    override: async (elements: AsyncIterable<Element>, services?: string[]): Promise<void> => {
      const data = await stateData()
      const newServices = services ?? await awu(data.servicesUpdateDate.keys()).toArray()
      await data.elements.overide(elements)
      await data.servicesUpdateDate.setAll(
        awu(newServices.map(s => ({ key: s, value: new Date(Date.now()) })))
      )
    },
    getServicesUpdateDates: async (): Promise<Record<string, Date>> => {
      const stateDataVal = await awu((await stateData()).servicesUpdateDate.entries()).toArray()
      return Object.fromEntries(stateDataVal.map(e => [e.key, e.value]))
    },
    existingServices: async (): Promise<string[]> =>
      awu((await stateData()).servicesUpdateDate.keys()).toArray(),
    overridePathIndex: async (unmergedElements: Element[]): Promise<void> => {
      const currentStateData = await stateData()
      await overridePathIndex(currentStateData.pathIndex, unmergedElements)
    },
    updatePathIndex: async (
      unmergedElements: Element[],
      servicesNotToChange: string[]
    ): Promise<void> => {
      const currentStateData = await stateData()
      await updatePathIndex(
        currentStateData.pathIndex, unmergedElements, servicesNotToChange
      )
    },
    getPathIndex: async (): Promise<PathIndex> =>
      (await stateData()).pathIndex,
    clear: async () => {
      const currentStateData = await stateData()
      await currentStateData.elements.clear()
      await currentStateData.pathIndex.clear()
      await currentStateData.servicesUpdateDate.clear()
      await currentStateData.saltoMetadata.clear()
    },
    flush: async () => {
      if (!persistent) {
        throw new Error('can not flush a non persistent state')
      }
      const currentStateData = await stateData()
      await currentStateData.elements.flush()
      await currentStateData.pathIndex.flush()
      await currentStateData.servicesUpdateDate.flush()
      await currentStateData.saltoMetadata.flush()
    },
    rename: () => Promise.resolve(),
    getHash: async () => (await (await stateData()).saltoMetadata.get('hash'))
      ?? toMD5(safeJsonStringify([])),
    setHash: async (newHash: string) => (await stateData()).saltoMetadata.set('hash', newHash),
    getStateSaltoVersion: async () => (await stateData()).saltoMetadata.get('version'),
    setVersion: async (version: string) => (await stateData()).saltoMetadata.set('version', version),
  }
}
