/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  ObjectType,
  ElemID,
  StaticFile,
  toChange,
  BuiltinTypes,
  Field,
  InstanceElement,
  Element,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { detailedCompare } from '@salto-io/adapter-utils'
import { serialize } from '../../src/serializer'
import { StateData, buildInMemState, buildStateData } from '../../src/workspace/state'
import { PathIndex, getElementsPathHints } from '../../src/workspace/path_index'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import { InMemoryRemoteMap, RemoteMapCreator } from '../../src/workspace/remote_map'
import { StaticFilesSource } from '../../src/workspace/static_files/common'
import { mockStaticFilesSource } from '../utils'
import * as pathIndexModule from '../../src/workspace/path_index'

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
  })

  describe('buildStateData', () => {
    it('should call staticFilesSource get when deserializing elements', async () => {
      const remoteMapCreator = mockFunction<RemoteMapCreator>()
      await buildStateData('env', remoteMapCreator, stateStaticFilesSource, false)

      const elementsDeserialize = remoteMapCreator.mock.calls.find(
        call => call[0].namespace === 'state-env-elements',
      )?.[0].deserialize

      expect(elementsDeserialize).toBeDefined()

      await elementsDeserialize?.(await serialize([newElem]))
      expect(stateStaticFilesSource.getStaticFile).toHaveBeenCalledWith({
        filepath: staticFile.filepath,
        encoding: 'utf8',
        hash: staticFile.hash,
      })
    })

    it('should call staticFilesSource get when serializing elements', async () => {
      const remoteMapCreator = mockFunction<RemoteMapCreator>()
      await buildStateData('env', remoteMapCreator, stateStaticFilesSource, false)

      const elementsSerialize = remoteMapCreator.mock.calls.find(
        call => call[0].namespace === 'state-env-elements',
      )?.[0].serialize

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
    describe('set', () => {
      beforeEach(async () => {
        await state.set(newElem)
      })
      it('should set element such that get would return it', async () => {
        expect(await state.get(newElemID)).toEqual(newElem)
      })
      it('should not change account update date', async () => {
        expect(await state.getAccountsUpdateDates()).toEqual(accountsUpdateDate)
      })
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

    describe('updateStateFromChanges', () => {
      describe('elements state', () => {
        const toRemove = new ObjectType({ elemID: new ElemID(adapter, 'remove', 'type') })
        const toAdd = new ObjectType({ elemID: new ElemID(adapter, 'add', 'type') })
        const toModify = new ObjectType({
          elemID: new ElemID(adapter, 'modify', 'type'),
          fields: { removeMe: { refType: BuiltinTypes.STRING }, modifyMe: { refType: BuiltinTypes.STRING } },
        })

        const fieldToAdd = new Field(toModify, 'addMe', BuiltinTypes.STRING)
        const fieldToModify = new Field(toModify, 'modifyMe', BuiltinTypes.NUMBER)
        const fieldToRemove = new Field(toModify, 'removeMe', BuiltinTypes.STRING)
        const fieldToAddElemID = new ElemID(adapter, toModify.elemID.name, 'field', 'addMe')
        const fieldToModifyElemID = new ElemID(adapter, toModify.elemID.name, 'field', 'modifyMe')
        const fieldToRemoveElemID = new ElemID(adapter, toModify.elemID.name, 'field', 'removeMe')

        let allElements: Element[]
        beforeAll(async () => {
          await state.clear()
          await state.setAll([toRemove, toModify, newElem])

          await state.updateStateFromChanges({
            changes: [
              { action: 'add', data: { after: toAdd }, id: toAdd.elemID }, // Element to be added
              { action: 'remove', data: { before: toRemove }, id: toRemove.elemID }, // Element to be removed

              { action: 'add', data: { after: fieldToAdd }, id: fieldToAddElemID }, // Field to be added
              { action: 'remove', data: { before: fieldToRemove }, id: fieldToRemoveElemID }, // Field to be removed
              { action: 'modify', data: { before: fieldToModify, after: fieldToModify }, id: fieldToModifyElemID }, // Field to be modified
            ],
          })

          allElements = await awu(await state.getAll()).toArray()
          expect(allElements).toHaveLength(3)
        })

        it('should not remove existing elements', () => {
          expect(allElements.some(e => e.isEqual(newElem))).toBeTruthy()
        })
        it('should remove elements that were removed', () => {
          expect(allElements.some(e => e.isEqual(toRemove))).toBeFalsy()
        })
        it('should add elements that were added', () => {
          expect(allElements.some(e => e.isEqual(toAdd))).toBeTruthy()
        })
        it('should modify elements that were modified', () => {
          expect(
            allElements[2].isEqual(
              new ObjectType({
                elemID: new ElemID(adapter, 'modify', 'type'),
                fields: { modifyMe: { refType: BuiltinTypes.NUMBER }, addMe: { refType: BuiltinTypes.STRING } },
              }),
            ),
          ).toBeTruthy()
        })
      })
      describe('pathIndex', () => {
        const updatePathSpyIndex = jest.spyOn(pathIndexModule, 'updatePathIndex')
        const updateTopLevelPathSpyIndex = jest.spyOn(pathIndexModule, 'updateTopLevelPathIndex')

        beforeEach(async () => {
          updatePathSpyIndex.mockClear()
          updateTopLevelPathSpyIndex.mockClear()
        })
        it('should call updatePathIndex functions with all elements and removals', async () => {
          const nonTopLevelElem = new ObjectType({ elemID: new ElemID(adapter, elem.elemID.typeName, 'field') })
          const unmergedElements = [newElem, elem, nonTopLevelElem]

          await state.updateStateFromChanges({
            changes: [
              { ...toChange({ before: elem }), id: elem.elemID }, // Removal
              { ...toChange({ before: nonTopLevelElem }), id: nonTopLevelElem.elemID }, // Field removal
              { ...toChange({ after: newElem }), id: newElem.elemID }, // Addition
              ...detailedCompare(elem, newElem), // Modification
            ],
            unmergedElements,
          })

          const removedElementsFullNames = new Set<string>([
            elem.elemID.getFullName(),
            nonTopLevelElem.elemID.getFullName(),
          ])
          expect(updatePathSpyIndex).toHaveBeenCalledWith({
            pathIndex,
            unmergedElements,
            removedElementsFullNames,
          })
          expect(updateTopLevelPathSpyIndex).toHaveBeenCalledWith({
            pathIndex: topLevelPathIndex,
            unmergedElements,
            removedElementsFullNames,
          })
        })
        it('should delete path index of removal changes when called without unmerged elements', async () => {
          await pathIndex.clear()
          await pathIndex.set(newElem.elemID.getFullName(), [])

          await state.updateStateFromChanges({
            changes: [{ ...toChange({ before: newElem }), id: newElem.elemID }],
          })

          const elemPath = await pathIndex.get(newElem.elemID.getFullName())
          expect(elemPath).toBeUndefined()
        })
        it('should not call updatePathIndex when when called without unmerged element and the are no removals', async () => {
          await state.updateStateFromChanges({
            changes: [{ ...toChange({ after: newElem }), id: newElem.elemID }],
          })

          expect(updatePathSpyIndex).not.toHaveBeenCalled()
          expect(updateTopLevelPathSpyIndex).not.toHaveBeenCalled()
        })
      })
      it('should update the accounts update dates', async () => {
        const accountsUpdateDates = await state.getAccountsUpdateDates()
        await state.updateStateFromChanges({
          changes: [],
          fetchAccounts: [adapter],
        })
        const newAccountsUpdateDates = await state.getAccountsUpdateDates()
        expect(accountsUpdateDates[adapter] < newAccountsUpdateDates[adapter]).toBeTruthy()
      })
      it('should call removal of static file that was removed', async () => {
        const beforeElem = new InstanceElement('elem', new ObjectType({ elemID: new ElemID('salesforce', 'type') }), {
          f1: staticFile, // To modify
        })
        const afterElem = beforeElem.clone()
        delete afterElem.value.f1

        await state.set(beforeElem)
        await state.updateStateFromChanges({
          changes: detailedCompare(beforeElem, afterElem),
        })

        expect(stateStaticFilesSource.delete).toHaveBeenCalledWith(staticFile)
      })
    })

    describe('updateConfig', () => {
      it('should do nothing', async () => {
        await expect(state.updateConfig({ workspaceId: '', stateConfig: undefined })).resolves.not.toThrow()
      })
    })
  })

  describe('non persistent state', () => {
    it('should not allow flush when the ws is non-persistent', async () => {
      const nonPState = buildInMemState(loadStateData, false)
      await expect(() => nonPState.flush()).rejects.toThrow()
    })
  })
})
