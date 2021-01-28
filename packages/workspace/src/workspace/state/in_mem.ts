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
import { Element, ElemID } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { updatePathIndex, Path, overridePathIndex } from '../path_index'
import { State, StateData } from './state'
import { RemoteMap } from '../remote_map'

const { awu } = collections.asynciterable

export const buildInMemState = (loadData: () => Promise<StateData>): State => {
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
    set: async (element: Element): Promise<void> => (await stateData()).elements.set(element),
    remove: async (id: ElemID): Promise<void> => (await stateData()).elements.delete(id),
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
    getPathIndex: async (): Promise<RemoteMap<Path[]>> =>
      (await stateData()).pathIndex,
    clear: async () => {
      const currentStateData = await stateData()
      await currentStateData.elements.clear()
      await currentStateData.pathIndex.clear()
      await currentStateData.servicesUpdateDate.clear()
      await currentStateData.saltoVersion.clear()
    },
    flush: () => Promise.resolve(),
    rename: () => Promise.resolve(),
    getHash: () => Promise.reject(new Error('memory state not hashable')),
    getStateSaltoVersion: async () => (await stateData()).saltoVersion?.get('version'),
  }
}
