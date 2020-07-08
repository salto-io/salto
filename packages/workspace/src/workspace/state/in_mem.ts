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
import _ from 'lodash'
import { Element, ElemID, GLOBAL_ADAPTER } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { PathIndex, createPathIndex } from '../path_index'
import { State, StateData } from './state'

const { makeArray } = collections.array

export const buildInMemState = (loadData: () => Promise<StateData>):
Omit<State, 'flush' | 'clear' | 'rename'> => {
  let innerStateData: Promise<StateData>
  const stateData = (): Promise<StateData> => {
    if (innerStateData === undefined) {
      innerStateData = loadData()
    }
    return innerStateData
  }
  return {
    getAll: async (): Promise<Element[]> => Object.values((await stateData()).elements),
    list: async (): Promise<ElemID[]> =>
      Object.keys((await stateData()).elements).map(n => ElemID.fromFullName(n)),
    get: async (id: ElemID): Promise<Element> => ((await stateData()).elements[id.getFullName()]),
    set: async (element: Element): Promise<void> => {
      (await stateData()).elements[element.elemID.getFullName()] = element
    },
    remove: async (id: ElemID): Promise<void> => {
      delete (await stateData()).elements[id.getFullName()]
    },
    override: async (element: Element | Element[]): Promise<void> => {
      const elements = makeArray(element)
      const newServices = _(elements).map(e => e.elemID.adapter)
        .uniq()
        .filter(adapter => adapter !== GLOBAL_ADAPTER)
        .value()
      const data = await stateData()
      data.elements = _.keyBy(elements, e => e.elemID.getFullName())
      data.servicesUpdateDate = {
        ...data.servicesUpdateDate,
        ...newServices.reduce((acc, service) => {
          acc[service] = new Date(Date.now())
          return acc
        }, {} as Record<string, Date>),
      }
    },
    getServicesUpdateDates: async (): Promise<Record<string, Date>> => (await stateData())
      .servicesUpdateDate,
    existingServices: async (): Promise<string[]> =>
      Object.keys((await stateData()).servicesUpdateDate),
    overridePathIndex: async (unmergedElements: Element[]): Promise<void> => {
      (await stateData()).pathIndex = createPathIndex(unmergedElements)
    },
    getPathIndex: async (): Promise<PathIndex> => (await stateData()).pathIndex,
  }
}
