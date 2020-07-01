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
import { ObjectType, ElemID, BuiltinTypes, ListType, InstanceElement, DetailedChange } from '@salto-io/adapter-api'
import { merger, pathIndex } from '@salto-io/workspace'
import { EventEmitter } from 'pietile-eventemitter'
import { createRestoreChanges, RestoreProgressEvents } from '../../src/core/restore'

jest.mock('pietile-eventemitter')
const { mergeElements } = merger
const { createPathIndex } = pathIndex

describe('restore', () => {
  const nestedType = new ObjectType({
    elemID: new ElemID('salto', 'nested'),
    fields: {
      str: {
        type: BuiltinTypes.STRING,
      },
      num: {
        type: BuiltinTypes.NUMBER,
      },
      list: {
        type: new ListType(BuiltinTypes.NUMBER),
      },
    },
  })
  // singlePathObject
  const singlePathObject = new ObjectType({
    elemID: new ElemID('salto', 'singlePathObj'),
    fields: {
      simple: {
        type: BuiltinTypes.STRING,
      },
      nested: {
        type: nestedType,
      },
    },
    annotationTypes: {
      simple: BuiltinTypes.STRING,
      nested: nestedType,
    },
    annotations: {
      simple: 'simple',
      nested: {
        str: 'Str',
        num: 7,
        list: [1, 2, 3],
      },
    },
    path: ['salto', 'obj', 'simple'],
  })

  const multiPathAnnoObj = new ObjectType({
    elemID: new ElemID('salto', 'multiPathObj'),
    annotationTypes: {
      simple: BuiltinTypes.STRING,
      nested: nestedType,
    },
    annotations: {
      simple: 'simple',
      nested: {
        str: 'Str',
        num: 7,
        list: [1, 2, 3],
      },
    },
    path: ['salto', 'obj', 'multi', 'anno'],
  })
  // singlePathObject
  const multiPathFieldsObj = new ObjectType({
    elemID: new ElemID('salto', 'multiPathObj'),
    fields: {
      simple: {
        type: BuiltinTypes.STRING,
      },
      nested: {
        type: nestedType,
      },
    },
    path: ['salto', 'obj', 'multi', 'fields'],
  })
  // singlePathInstance
  const singlePathInstance = new InstanceElement('singlePathInst', singlePathObject, { simple: 'Simple',
    nested: {
      str: 'Str',
      num: 7,
      list: [1, 2, 3],
    } },
  ['salto', 'inst', 'simple'],)
  // multiPathInstance
  const multiPathInstace1 = new InstanceElement('multiPathInst', singlePathObject, { simple: 'Simple',
    nested: {
      list: [1, 2, 3],
    } },
  ['salto', 'inst', 'nested', '1'],)
  const multiPathInstace2 = new InstanceElement('multiPathInst', singlePathObject, { nested: {
    str: 'Str',
    num: 7,
  } },
  ['salto', 'inst', 'nested', '2'],)

  const elementfragments = [
    singlePathInstance,
    multiPathAnnoObj,
    multiPathFieldsObj,
    multiPathInstace1,
    multiPathInstace2,
  ]
  const { merged: allElement } = mergeElements([singlePathObject, ...elementfragments])
  const singlePathObjMerged = allElement[0].clone()
  const multiPathObjMerged = allElement[1].clone()
  const singlePathInstMerged = allElement[2].clone()
  const multiPathInstMerged = allElement[3].clone()

  const index = createPathIndex(elementfragments)

  it('should emit events', async () => {
    const progressEmitter = new EventEmitter<RestoreProgressEvents>()
    await createRestoreChanges([], [], index, [], progressEmitter)
    expect(progressEmitter.emit).toHaveBeenCalledTimes(2)
    const mockedEmit = progressEmitter.emit as jest.Mock
    expect(mockedEmit.mock.calls[0][0]).toEqual('diffWillBeCalculated')
    expect(mockedEmit.mock.calls[1][0]).toEqual('diffWasCalculated')
    expect(mockedEmit.mock.calls[1][1]).toEqual([])
  })
  describe('with no changes', () => {
    it('should not create changes ws and the state are the same', async () => {
      const changes = await createRestoreChanges(allElement, allElement, index)
      expect(changes).toHaveLength(0)
    })
  })

  describe('with changes', () => {
    const singlePathInstMergedAfter = singlePathInstMerged.clone() as InstanceElement
    const wsElements = [
      singlePathObjMerged,
      multiPathInstMerged,
      singlePathInstMerged,
    ]
    singlePathInstMergedAfter.value.nested.str = 'modified'
    const stateElements = [
      multiPathObjMerged,
      singlePathInstMergedAfter,
      multiPathInstMerged,
    ]
    describe('without filters', () => {
      let changes: DetailedChange[]
      beforeAll(async () => {
        changes = await createRestoreChanges(wsElements, stateElements, index)
      })

      it('should create all changes', () => {
        expect(changes).toHaveLength(4)
      })

      it('should create add changes for elements which are only in the state', () => {
        const addChanges = changes.filter(c => c.action === 'add')
        expect(addChanges).toHaveLength(2)
        addChanges.forEach(change => expect(change.id).toEqual(multiPathObjMerged.elemID))
        const changePaths = addChanges.map(change => change.path)
        expect(changePaths).toContainEqual(['salto', 'obj', 'multi', 'anno'])
        expect(changePaths).toContainEqual(['salto', 'obj', 'multi', 'fields'])
      })
      it('should create remove changes for elements which are only in the workspace', () => {
        const removeChange = changes.find(c => c.action === 'remove')
        expect(removeChange).toBeDefined()
        expect(removeChange?.id).toEqual(singlePathObjMerged.elemID)
        expect(removeChange?.path).toBeUndefined()
      })
      it('should create remove changes for elements which have different values in the state and ws', () => {
        const modifyChange = changes.find(c => c.action === 'modify')
        expect(modifyChange).toBeDefined()
        expect(modifyChange?.id).toEqual(singlePathInstMergedAfter.elemID
          .createNestedID('nested').createNestedID('str'))
        expect(modifyChange?.path).toEqual(['salto', 'inst', 'simple'])
      })
    })
    describe('with filters', () => {
      let changes: DetailedChange[]
      const nestedID = singlePathInstMerged.elemID
        .createNestedID('nested')
        .createNestedID('str')
      beforeAll(async () => {
        const filters = [
          new RegExp(singlePathObjMerged.elemID.getFullName()),
          new RegExp(nestedID.getFullName()),
        ]
        changes = await createRestoreChanges(wsElements, stateElements, index, filters)
      })
      it('should filter out changes that did not pass any of the filters', () => {
        expect(changes).toHaveLength(2)
      })
      it('should create changes for elements that pass top level filters', () => {
        expect(changes.find(c => c.id.isEqual(singlePathObjMerged.elemID))).toBeTruthy()
      })
      it('should create partial changes for elements that pass nested filters', () => {
        expect(changes.find(c => c.id.isEqual(nestedID))).toBeTruthy()
      })
    })
  })
})
