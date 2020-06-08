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
import State from '../../src/workspace/state'
import { mockFunction } from './helpers'

const mockState = (services: string[] = [], elements: Element[] = []): State => {
  const state = new Map(elements.map(elem => [elem.elemID.getFullName(), elem]))
  return {
    list: mockFunction<State['list']>().mockImplementation(
      () => Promise.resolve(Object.values(state).map(elem => elem.elemID))
    ),
    get: mockFunction<State['get']>().mockImplementation(
      id => Promise.resolve(state.get(id.getFullName()))
    ),
    getAll: mockFunction<State['getAll']>().mockImplementation(
      () => Promise.resolve(Object.values(state))
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
  }
}

export default mockState
