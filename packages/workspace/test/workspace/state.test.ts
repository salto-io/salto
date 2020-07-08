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
import { ObjectType, ElemID } from '@salto-io/adapter-api'
import { StateData, buildInMemState } from '../../src/workspace/state'
import { createPathIndex } from '../../src/workspace/path_index'

describe('state', () => {
  const adapter = 'salesforce'
  const elemID = new ElemID(adapter, 'elem')
  const elem = new ObjectType({ elemID, path: ['test', 'new'] })
  const pathIndex = createPathIndex([elem])
  const servicesUpdateDate = { [adapter]: new Date() }
  const loadStateData = (): Promise<StateData> => Promise.resolve({
    elements: { [elemID.getFullName()]: elem },
    servicesUpdateDate,
    pathIndex,
  })
  describe('build in-mem state', () => {
    let state: ReturnType<typeof buildInMemState>
    beforeEach(() => {
      state = buildInMemState(loadStateData)
    })
    it('getAll', async () => {
      expect(await state.getAll()).toEqual([elem])
    })
    it('list', async () => {
      expect(await state.list()).toEqual([elemID])
    })
    it('get', async () => {
      expect(await state.get(elemID)).toEqual(elem)
    })
    it('set', async () => {
      const newElemID = new ElemID('dummy', 'newElem')
      const newElem = new ObjectType({ elemID: newElemID, path: ['test', 'newOne'] })
      await state.set(newElem)
      expect(await state.get(newElemID)).toEqual(newElem)
    })
    it('remove', async () => {
      const newElemID = new ElemID('dummy', 'toRemove')
      const newElem = new ObjectType({ elemID: newElemID, path: ['test', 'toRemove'] })
      await state.set(newElem)
      await state.remove(newElemID)
      expect(await state.get(newElemID)).toBe(undefined)
    })
    it('override', async () => {
      const newAdapter = 'dummy'
      const newElemID = new ElemID(newAdapter, 'newElem')
      const newElem = new ObjectType({ elemID: newElemID, path: ['test', 'newElem'] })
      await state.override(newElem)
      expect(await state.getAll()).toEqual([newElem])
      expect(Object.keys(await state.getServicesUpdateDates())).toEqual([adapter, newAdapter])
    })
    it('getServicesUpdateDates', async () => {
      expect(await state.getServicesUpdateDates()).toEqual(servicesUpdateDate)
    })
    it('existingServices', async () => {
      expect(await state.existingServices()).toEqual([adapter])
    })
    it('getPathIndex', async () => {
      expect(await state.getPathIndex()).toEqual(pathIndex)
    })
    it('overridePathIndex', async () => {
      const newElemID = new ElemID('dummy', 'newElem')
      const newElem = new ObjectType({ elemID: newElemID, path: ['test', 'newElem'] })
      const elements = [elem, newElem]
      await state.overridePathIndex(elements)
      expect(await state.getPathIndex()).toEqual(createPathIndex([elem, newElem]))
    })
  })
})
