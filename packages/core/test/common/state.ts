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
import { pathIndex, state as wsState } from '@salto-io/workspace'
import { mockFunction } from './helpers'


export const mockState = (
  services: string[] = [],
  elements: Element[] = [],
  index?: pathIndex.PathIndex
): wsState.State => {
  const state = new Map(elements.map(elem => [elem.elemID.getFullName(), elem]))
  return {
    list: mockFunction<wsState.State['list']>().mockImplementation(
      () => Promise.resolve(wu(state.values()).toArray().map(elem => elem.elemID))
    ),
    get: mockFunction<wsState.State['get']>().mockImplementation(
      id => Promise.resolve(state.get(id.getFullName()))
    ),
    getAll: mockFunction<wsState.State['getAll']>().mockImplementation(
      () => Promise.resolve(wu(state.values()).toArray())
    ),
    set: mockFunction<wsState.State['set']>().mockImplementation(
      async elem => { state.set(elem.elemID.getFullName(), elem) }
    ),
    remove: mockFunction<wsState.State['remove']>().mockImplementation(
      async id => { state.delete(id.getFullName()) }
    ),
    clear: mockFunction<wsState.State['clear']>().mockImplementation(
      async () => state.clear()
    ),
    rename: mockFunction<wsState.State['rename']>().mockResolvedValue(),
    override: mockFunction<wsState.State['override']>().mockImplementation(
      async overrideElements => {
        state.clear()
        const elemList = Array.isArray(overrideElements) ? overrideElements : [overrideElements]
        elemList.forEach(elem => state.set(elem.elemID.getFullName(), elem))
      }
    ),
    flush: mockFunction<wsState.State['flush']>().mockResolvedValue(),
    getHash: mockFunction<wsState.State['getHash']>().mockResolvedValue('d5ebc45734aca2e8bed1d1ea433bad15'),
    getServicesUpdateDates: mockFunction<wsState.State['getServicesUpdateDates']>()
      .mockResolvedValue(
        Object.assign({}, ...services.map(service => ({ [service]: Date.now() })))
      ),
    existingServices: mockFunction<wsState.State['existingServices']>()
      .mockResolvedValue(services),
    overridePathIndex: mockFunction<wsState.State['overridePathIndex']>(),
    getPathIndex: mockFunction<wsState.State['getPathIndex']>().mockResolvedValue(
      index || new pathIndex.PathIndex()
    ),
  }
}
