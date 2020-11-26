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
import { Element, ElemID, GLOBAL_ADAPTER } from '@salto-io/adapter-api'
import wu from 'wu'
import { collections } from '@salto-io/lowerdash'
import { PathIndex, createPathIndex, updatePathIndex } from '../path_index'
import { State, StateData } from './state'
import { RemoteElementSource } from '../elements_source'

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
    set: async (element: Element): Promise<void> => (await stateData()).elements.set(element),
    remove: async (id: ElemID): Promise<void> => (await stateData()).elements.delete(id),
    override: async (elements: AsyncIterable<Element>): Promise<void> => {
      const newServices = new Set<string>()
      await awu(elements).map(e => e.elemID.adapter)
        .filter(adapter => adapter !== GLOBAL_ADAPTER)
        .forEach(adapter => newServices.add(adapter))

      const data = await stateData()
      await data.elements.overide(elements)
      data.servicesUpdateDate = {
        ...data.servicesUpdateDate,
        ...wu(newServices.values()).toArray().reduce((acc, service) => {
          acc[service] = new Date(Date.now())
          return acc
        }, {} as Record<string, Date>),
      }
    },
    getServicesUpdateDates: async (): Promise<Record<string, Date>> => {
      const stateDataVal = (await stateData())
      return stateDataVal.servicesUpdateDate
    },
    existingServices: async (): Promise<string[]> =>
      Object.keys((await stateData()).servicesUpdateDate),
    overridePathIndex: async (unmergedElements: Element[]): Promise<void> => {
      (await stateData()).pathIndex = createPathIndex(unmergedElements)
    },
    updatePathIndex: async (unmergedElements: Element[], servicesNotToChange: string[]):
      Promise<void> => {
      const currentStateData = await stateData()
      currentStateData.pathIndex = updatePathIndex(
        currentStateData.pathIndex, unmergedElements, servicesNotToChange
      )
    },
    getPathIndex: async (): Promise<PathIndex> => (await stateData()).pathIndex,
    clear: async () => {
      innerStateData = Promise.resolve({
        elements: new RemoteElementSource('state'),
        pathIndex: new PathIndex(),
        servicesUpdateDate: {},
      })
    },
    flush: () => Promise.resolve(),
    rename: () => Promise.resolve(),
    getHash: () => Promise.reject(new Error('memory state not hashable')),
    getStateSaltoVersion: async () => (await stateData()).saltoVersion,
  }
}
