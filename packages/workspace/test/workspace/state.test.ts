/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  TypeReference,
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
      accounts: new InMemoryRemoteMap([{ key: 'account_names', value: [adapter] }]),
      pathIndex,
      topLevelPathIndex,
      saltoMetadata: new InMemoryRemoteMap([{ key: 'version', value: '0.0.1' }]),
      staticFilesSource: stateStaticFilesSource,
      deprecated: {
        accountsUpdateDate: new InMemoryRemoteMap([{ key: adapter, value: new Date() }]),
      },
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
      expect(stateStaticFilesSource.clear).toHaveBeenCalled()
    })

    it('flush should do nothing', async () => {
      await expect(state.flush()).resolves.not.toThrow()
      expect(stateStaticFilesSource.flush).toHaveBeenCalled()
    })

    it('rename should do nothing', async () => {
      await expect(state.rename('bla')).resolves.not.toThrow()
    })

    describe('updateStateFromChanges', () => {
      describe('elements state', () => {
        const toRemove = new ObjectType({ elemID: new ElemID(adapter, 'remove') })
        const toAdd = new ObjectType({ elemID: new ElemID(adapter, 'add') })
        const toModify = new ObjectType({ elemID: new ElemID(adapter, 'modify') })
        const toModifyAfter = new ObjectType({
          elemID: new ElemID(adapter, 'modify'),
          metaType: new TypeReference(new ElemID(adapter, 'meta')),
        })
        const toModifyField = new ObjectType({
          elemID: new ElemID(adapter, 'modifyField'),
          fields: { removeMe: { refType: BuiltinTypes.STRING }, modifyMe: { refType: BuiltinTypes.STRING } },
        })

        const fieldToAdd = new Field(toModifyField, 'addMe', BuiltinTypes.STRING)
        const fieldToModify = new Field(toModifyField, 'modifyMe', BuiltinTypes.NUMBER)
        const fieldToModifyAfter = new Field(toModifyField, 'modifyMe', BuiltinTypes.BOOLEAN)
        const fieldToRemove = new Field(toModifyField, 'removeMe', BuiltinTypes.STRING)
        const fieldToAddElemID = new ElemID(adapter, toModifyField.elemID.name, 'field', 'addMe')
        const fieldToModifyElemID = new ElemID(adapter, toModifyField.elemID.name, 'field', 'modifyMe')
        const fieldToRemoveElemID = new ElemID(adapter, toModifyField.elemID.name, 'field', 'removeMe')

        let allElements: Element[]
        beforeAll(async () => {
          await state.clear()
          await state.setAll([toRemove, toModify, toModifyField, newElem])

          await state.updateStateFromChanges({
            changes: [
              { action: 'add', data: { after: toAdd }, id: toAdd.elemID }, // Element to be added
              { action: 'remove', data: { before: toRemove }, id: toRemove.elemID }, // Element to be removed
              { action: 'modify', data: { before: toModify, after: toModifyAfter }, id: toModify.elemID }, // Element to be modified

              { action: 'add', data: { after: fieldToAdd }, id: fieldToAddElemID }, // Field to be added
              { action: 'remove', data: { before: fieldToRemove }, id: fieldToRemoveElemID }, // Field to be removed
              { action: 'modify', data: { before: fieldToModify, after: fieldToModifyAfter }, id: fieldToModifyElemID }, // Field to be modified
            ],
          })

          allElements = await awu(await state.getAll()).toArray()
          expect(allElements).toHaveLength(4)
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
          expect(allElements[2].isEqual(toModifyAfter)).toBeTrue()
        })
        it('should modify element fields that were modified', () => {
          expect(
            allElements[3].isEqual(
              new ObjectType({
                elemID: toModifyField.elemID,
                fields: { modifyMe: { refType: BuiltinTypes.BOOLEAN }, addMe: { refType: BuiltinTypes.STRING } },
              }),
            ),
          ).toBeTrue()
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
