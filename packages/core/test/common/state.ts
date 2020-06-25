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
import { Element } from '@salto-io/adapter-api'
import wu from 'wu'
import { pathIndex, State } from '@salto-io/workspace'
import { mockFunction } from './helpers'


export const mockState = (
  services: string[] = [],
  elements: Element[] = [],
  index?: pathIndex.PathIndex
): State => {
  const state = new Map(elements.map(elem => [elem.elemID.getFullName(), elem]))
  return {
    list: mockFunction<State['list']>().mockImplementation(
      () => Promise.resolve(wu(state.values()).toArray().map(elem => elem.elemID))
    ),
    get: mockFunction<State['get']>().mockImplementation(
      id => Promise.resolve(state.get(id.getFullName()))
    ),
    getAll: mockFunction<State['getAll']>().mockImplementation(
      () => Promise.resolve(wu(state.values()).toArray())
    ),
    set: mockFunction<State['set']>().mockImplementation(
      async elem => { state.set(elem.elemID.getFullName(), elem) }
    ),
    remove: mockFunction<State['remove']>().mockImplementation(
      async id => { state.delete(id.getFullName()) }
    ),
    clear: mockFunction<State['clear']>().mockImplementation(
      async () => state.clear()
    ),
    rename: mockFunction<State['rename']>().mockResolvedValue(),
    override: mockFunction<State['override']>().mockImplementation(
      async overrideElements => {
        state.clear()
        const elemList = Array.isArray(overrideElements) ? overrideElements : [overrideElements]
        elemList.forEach(elem => state.set(elem.elemID.getFullName(), elem))
      }
    ),
    flush: mockFunction<State['flush']>().mockResolvedValue(),
    getServicesUpdateDates: mockFunction<State['getServicesUpdateDates']>().mockResolvedValue(
      Object.assign({}, ...services.map(service => ({ [service]: Date.now() })))
    ),
    existingServices: mockFunction<State['existingServices']>().mockResolvedValue(services),
    overridePathIndex: mockFunction<State['overridePathIndex']>(),
    getPathIndex: mockFunction<State['getPathIndex']>().mockResolvedValue(
      index || new pathIndex.PathIndex()
    ),
  }
}
