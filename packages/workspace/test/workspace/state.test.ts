/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ObjectType, ElemID, StaticFile, Field } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { serialize } from '../../src/serializer'
import { StateData, buildInMemState, buildStateData } from '../../src/workspace/state'
import { PathIndex, getElementsPathHints } from '../../src/workspace/path_index'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import { InMemoryRemoteMap, RemoteMapCreator } from '../../src/workspace/remote_map'
import { StaticFilesSource } from '../../src/workspace/static_files/common'
import { mockStaticFilesSource } from '../utils'

const { awu } = collections.asynciterable

describe('state', () => {
  const adapter = 'salesforce'
  const elemID = new ElemID(adapter, 'elem')
  const elem = new ObjectType({ elemID, path: ['test', 'new'] })
  let pathIndex: PathIndex
  let topLevelPathIndex: PathIndex
  const updateDate = new Date()
  const accountsUpdateDate = { [adapter]: updateDate }

  let loadStateData: () => Promise<StateData>
  let stateStaticFilesSource: MockInterface<StaticFilesSource>

  let newElemID: ElemID
  let staticFile: StaticFile
  let newElem: ObjectType
  let newField: Field

  beforeAll(async () => {
    pathIndex = new InMemoryRemoteMap(getElementsPathHints([elem]))
    topLevelPathIndex = new InMemoryRemoteMap(getElementsPathHints([elem]))
  })

  beforeEach(() => {
    stateStaticFilesSource = mockStaticFilesSource() as MockInterface<StaticFilesSource>
    loadStateData = async () => ({
      elements: createInMemoryElementSource([elem]),
      accountsUpdateDate: new InMemoryRemoteMap([{ key: adapter, value: updateDate }]),
      pathIndex,
      topLevelPathIndex,
      saltoMetadata: new InMemoryRemoteMap([{ key: 'version', value: '0.0.1' }]),
      staticFilesSource: stateStaticFilesSource,
    })

    newElemID = new ElemID('dummy', 'newElem')
    staticFile = new StaticFile({
      filepath: 'path',
      content: Buffer.from('content'),
      encoding: 'utf8',
    })
    newElem = new ObjectType({
      elemID: newElemID,
      path: ['test', 'newOne'],
      annotations: {
        staticFile,
      },
    })
    newField = new Field(newElem, 'field', newElem)
  })

  describe('buildStateData', () => {
    it('should call staticFilesSource get when deserializing elements', async () => {
      const remoteMapCreator = mockFunction<RemoteMapCreator>()
      await buildStateData(
        'env',
        remoteMapCreator,
        stateStaticFilesSource,
        false,
      )

      const elementsDeserialize = remoteMapCreator.mock.calls
        .find(call => call[0].namespace === 'state-env-elements')?.[0].deserialize

      expect(elementsDeserialize).toBeDefined()

      await elementsDeserialize?.(await serialize([newElem]))
      expect(stateStaticFilesSource.getStaticFile).toHaveBeenCalledWith(staticFile.filepath, 'utf8', staticFile.hash)
    })

    it('should call staticFilesSource get when serializing elements', async () => {
      const remoteMapCreator = mockFunction<RemoteMapCreator>()
      await buildStateData(
        'env',
        remoteMapCreator,
        stateStaticFilesSource,
        false,
      )

      const elementsSerialize = remoteMapCreator.mock.calls
        .find(call => call[0].namespace === 'state-env-elements')?.[0].serialize

      expect(elementsSerialize).toBeDefined()

      await elementsSerialize?.(newElem)
      expect(stateStaticFilesSource.persistStaticFile).toHaveBeenCalledWith(staticFile)
    })
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
    it('isEmpty', async () => {
      expect(await state.isEmpty()).toEqual(false)
    })
    it('get', async () => {
      expect(await state.get(elemID)).toEqual(elem)
    })
    it('set', async () => {
      await state.set(newElem)
      expect(await state.get(newElemID)).toEqual(newElem)
    })
    it('remove', async () => {
      await state.set(newElem)
      await state.remove(newElemID)
      expect(await state.get(newElemID)).toBe(undefined)
      expect(stateStaticFilesSource.delete).toHaveBeenCalledWith(staticFile)
    })

    it('setAll', async () => {
      await state.setAll(awu([newElem]))
      expect(await state.get(newElemID)).toEqual(newElem)
    })
    it('override', async () => {
      await state.override(awu([newElem]), ['dummy'])
      expect(await awu(await state.getAll()).toArray()).toEqual([newElem])
      expect(Object.keys(await state.getAccountsUpdateDates())).toEqual(['dummy', adapter])
      expect(stateStaticFilesSource.clear).toHaveBeenCalled()
    })
    it('getAccountsUpdateDates', async () => {
      expect(await state.getAccountsUpdateDates()).toEqual(accountsUpdateDate)
    })
    it('existingAccounts', async () => {
      expect(await state.existingAccounts()).toEqual([adapter])
    })
    it('getPathIndex', async () => {
      expect(await state.getPathIndex()).toEqual(pathIndex)
    })
    it('getTopLevelPathIndex', async () => {
      expect(await state.getTopLevelPathIndex()).toEqual(topLevelPathIndex)
    })
    it('overridePathIndex', async () => {
      const elements = [elem, newElem, newField]
      await state.overridePathIndex(elements)
      const index = await awu((await state.getPathIndex()).entries()).toArray()
      expect(index).toEqual(getElementsPathHints([newElem, elem, newField]))
      const topLevelIndex = await awu((await state.getTopLevelPathIndex()).entries()).toArray()
      expect(topLevelIndex).toEqual(getElementsPathHints([newElem, elem]))
    })

    it('updatePathIndex', async () => {
      const elements = [elem, newElem]
      await state.overridePathIndex(elements)
      const oneElement = [newElem, newField]
      await state.updatePathIndex(oneElement, ['salesforce'])
      const index = await awu((await state.getPathIndex()).entries()).toArray()
      const topLevelIndex = await awu((await state.getTopLevelPathIndex()).entries()).toArray()
      expect(index).toEqual(getElementsPathHints([newElem, elem]))
      expect(topLevelIndex).toEqual(getElementsPathHints([newElem]))
    })

    it('clear should clear all data', async () => {
      await state.clear()
      expect(await awu(await state.getAll()).toArray()).toHaveLength(0)
      expect((await awu((await state.getPathIndex()).keys()).toArray()).length).toEqual(0)
      expect((await awu((await state.getTopLevelPathIndex()).keys()).toArray()).length).toEqual(0)
      expect(await state.getAccountsUpdateDates()).toEqual({})
      expect(stateStaticFilesSource.clear).toHaveBeenCalled()
    })

    it('flush should do nothing', async () => {
      await expect(state.flush()).resolves.not.toThrow()
      expect(stateStaticFilesSource.flush).toHaveBeenCalled()
    })

    it('rename should do nothing', async () => {
      await expect(state.rename('bla')).resolves.not.toThrow()
    })

    it('should return the salto version that was provided in load data', async () => {
      expect(await state.getStateSaltoVersion()).toEqual('0.0.1')
    })
  })

  describe('non persistent state', () => {
    it('should not allow flush when the ws is non-persistent', async () => {
      const nonPState = buildInMemState(loadStateData, false)
      await expect(() => nonPState.flush()).rejects.toThrow()
    })
  })
})
