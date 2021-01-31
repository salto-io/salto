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
import { collections } from '@salto-io/lowerdash'
import { StateData, buildInMemState } from '../../src/workspace/state'
import { Path, getElementsPathHints } from '../../src/workspace/path_index'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import { InMemoryRemoteMap, RemoteMap } from '../../src/workspace/remote_map'

const { awu } = collections.asynciterable

describe('state', () => {
  const adapter = 'salesforce'
  const elemID = new ElemID(adapter, 'elem')
  const elem = new ObjectType({ elemID, path: ['test', 'new'] })
  let pathIndex: RemoteMap<Path[]>
  const updateDate = new Date()
  const servicesUpdateDate = { [adapter]: updateDate }
  const loadStateData = async (): Promise<StateData> => ({
    elements: createInMemoryElementSource([elem]),
    servicesUpdateDate: new InMemoryRemoteMap([{ key: adapter, value: updateDate }]),
    pathIndex,
    saltoMetadata: new InMemoryRemoteMap([{ key: 'version', value: '0.0.1' }]),
  })

  beforeAll(async () => {
    pathIndex = new InMemoryRemoteMap(await getElementsPathHints([elem]))
  })
  describe('build in-mem state', () => {
    let state: ReturnType<typeof buildInMemState>
    beforeEach(() => {
      state = buildInMemState(loadStateData)
    })
    it('getAll', async () => {
      expect(await awu(await state.getAll()).toArray()).toEqual([elem])
    })
    it('list', async () => {
      expect(await awu(await state.list()).toArray()).toEqual([elemID])
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
      await state.override(awu([newElem]), [newAdapter])
      expect(await awu(await state.getAll()).toArray()).toEqual([newElem])
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
      const index = await awu((await state.getPathIndex()).entries()).toArray()
      expect(index).toEqual(await getElementsPathHints([elem, newElem]))
    })

    it('updatePathIndex', async () => {
      const newElemID = new ElemID('dummy', 'newElem')
      const newElem = new ObjectType({ elemID: newElemID, path: ['test', 'newElem'] })
      const elements = [elem, newElem]
      await state.overridePathIndex(elements)
      const oneElement = [newElem]
      await state.updatePathIndex(oneElement, ['salesforce'])
      const index = await awu((await state.getPathIndex()).entries()).toArray()
      expect(index).toEqual(await getElementsPathHints([elem, newElem]))
    })

    it('clear should clear all data', async () => {
      await state.clear()
      expect(await awu(await state.getAll()).toArray()).toHaveLength(0)
      expect((await awu((await state.getPathIndex()).keys()).toArray()).length).toEqual(0)
      expect(await state.getServicesUpdateDates()).toEqual({})
    })

    it('flush should do nothing', async () => {
      await expect(state.flush()).resolves.not.toThrow()
    })

    it('rename should do nothing', async () => {
      await expect(state.rename('bla')).resolves.not.toThrow()
    })

    it('should return the salto version that was provided in load data', async () => {
      expect(await state.getStateSaltoVersion()).toEqual('0.0.1')
    })
  })
})
