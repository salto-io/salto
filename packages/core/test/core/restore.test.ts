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
  Element,
  ObjectType,
  ElemID,
  BuiltinTypes,
  ListType,
  InstanceElement,
  DetailedChange,
  isAdditionChange,
  isRemovalChange,
  isModificationChange,
  getChangeData,
} from '@salto-io/adapter-api'
import { merger, pathIndex, remoteMap } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { createRestoreChanges, createRestorePathChanges } from '../../src/core/restore'
import { createElementSource } from '../common/helpers'
import { ChangeWithDetails } from '../../src/core/plan/plan_item'

const { awu } = collections.asynciterable
const { mergeElements } = merger
const { getElementsPathHints } = pathIndex

describe('restore', () => {
  const nestedType = new ObjectType({
    elemID: new ElemID('salto', 'nested'),
    fields: {
      str: {
        refType: BuiltinTypes.STRING,
      },
      num: {
        refType: BuiltinTypes.NUMBER,
      },
      list: {
        refType: new ListType(BuiltinTypes.NUMBER),
      },
    },
  })
  // singlePathObject
  const singlePathObject = new ObjectType({
    elemID: new ElemID('salto', 'singlePathObj'),
    fields: {
      simple: {
        refType: BuiltinTypes.STRING,
      },
      nested: {
        refType: nestedType,
      },
    },
    annotationRefsOrTypes: {
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
    annotationRefsOrTypes: {
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
        refType: BuiltinTypes.STRING,
      },
      nested: {
        refType: nestedType,
      },
    },
    path: ['salto', 'obj', 'multi', 'fields'],
  })
  // singlePathInstance
  const singlePathInstance = new InstanceElement(
    'singlePathInst',
    singlePathObject,
    {
      simple: 'Simple',
      nested: {
        str: 'Str',
        num: 7,
        list: [1, 2, 3],
      },
    },
    ['salto', 'inst', 'simple'],
  )
  // multiPathInstance
  const multiPathInstace1 = new InstanceElement(
    'multiPathInst',
    singlePathObject,
    {
      simple: 'Simple',
      nested: {
        list: [1, 2, 3],
      },
    },
    ['salto', 'inst', 'nested', '1'],
  )
  const multiPathInstace2 = new InstanceElement(
    'multiPathInst',
    singlePathObject,
    {
      nested: {
        str: 'Str',
        num: 7,
      },
    },
    ['salto', 'inst', 'nested', '2'],
  )

  const elementfragments = [
    singlePathInstance,
    multiPathAnnoObj,
    multiPathFieldsObj,
    multiPathInstace1,
    multiPathInstace2,
    nestedType,
  ]
  let allElement: Element[]
  let singlePathObjMerged: Element
  let multiPathObjMerged: Element
  let singlePathInstMerged: Element
  let multiPathInstMerged: Element
  let index: remoteMap.RemoteMap<pathIndex.Path[]>
  beforeAll(async () => {
    const { merged } = await mergeElements(awu([singlePathObject, ...elementfragments]))
    allElement = await awu(merged.values()).toArray()
    multiPathObjMerged = allElement[0].clone()
    singlePathObjMerged = allElement[2].clone()
    multiPathInstMerged = allElement[3].clone()
    singlePathInstMerged = allElement[4].clone()
    index = new remoteMap.InMemoryRemoteMap(getElementsPathHints(elementfragments))
  })

  describe('with no changes', () => {
    describe('detailedChanges', () => {
      it('should not create changes ws and the state are the same', async () => {
        const changes = await createRestoreChanges(
          createElementSource(allElement),
          createElementSource(allElement),
          index,
          new remoteMap.InMemoryRemoteMap<ElemID[]>(),
        )
        expect(changes).toHaveLength(0)
      })
    })
    describe('changesWithDetails', () => {
      it('should not create changes ws and the state are the same', async () => {
        const changes = await createRestoreChanges(
          createElementSource(allElement),
          createElementSource(allElement),
          index,
          new remoteMap.InMemoryRemoteMap<ElemID[]>(),
          undefined,
          undefined,
          'changes',
        )
        expect(changes).toHaveLength(0)
      })
    })
  })

  describe('with changes', () => {
    let wsElements: Element[]
    let stateElements: Element[]
    let singlePathInstMergedAfter: InstanceElement
    beforeAll(async () => {
      singlePathInstMergedAfter = singlePathInstMerged.clone() as InstanceElement
      wsElements = [singlePathObjMerged, multiPathInstMerged, singlePathInstMerged]
      singlePathInstMergedAfter.value.nested.str = 'modified'
      stateElements = [multiPathObjMerged, singlePathInstMergedAfter, multiPathInstMerged]
    })

    describe('detailedChanges', () => {
      describe('without filters', () => {
        let changes: DetailedChange[]
        beforeAll(async () => {
          changes = await createRestoreChanges(
            createElementSource([...wsElements, nestedType]),
            createElementSource([...stateElements, nestedType]),
            index,
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
          )
        })
        it('should create all changes', () => {
          expect(changes).toHaveLength(4)
        })
        it('should create add changes for elements which are only in the state with proper path', () => {
          const addChanges = changes.filter(isAdditionChange)
          expect(addChanges).toHaveLength(2)
          addChanges.forEach(change => {
            expect(change.id).toEqual(multiPathObjMerged.elemID)
            expect(change.data.after.elemID).toEqual(change.id)
          })
          const changePaths = addChanges.map(change => change.path)
          expect(changePaths).toContainEqual(['salto', 'obj', 'multi', 'anno'])
          expect(changePaths).toContainEqual(['salto', 'obj', 'multi', 'fields'])
        })
        it('should create remove changes for elements which are only in the workspace with proper path', () => {
          const removeChange = changes.find(isRemovalChange)
          expect(removeChange).toBeDefined()
          expect(removeChange?.id).toEqual(singlePathObjMerged.elemID)
          expect(removeChange?.data.before.elemID).toEqual(removeChange?.id)
          expect(removeChange?.path).toBeUndefined()
        })
        it('should create modify changes for elements which have different values in the state and ws with proper path', () => {
          const modifyChange = changes.find(isModificationChange)
          expect(modifyChange).toBeDefined()
          expect(modifyChange?.id).toEqual(
            singlePathInstMergedAfter.elemID.createNestedID('nested').createNestedID('str'),
          )
          expect(modifyChange?.path).toEqual(['salto', 'inst', 'simple'])
          expect(modifyChange?.data.before).toEqual('Str')
          expect(modifyChange?.data.after).toEqual('modified')
        })
      })
    })
    describe('changesWithDetails', () => {
      describe('without filters', () => {
        let changes: ChangeWithDetails[]
        beforeAll(async () => {
          changes = await createRestoreChanges(
            createElementSource([...wsElements, nestedType]),
            createElementSource([...stateElements, nestedType]),
            index,
            new remoteMap.InMemoryRemoteMap<ElemID[]>(),
            undefined,
            undefined,
            'changes',
          )
        })
        it('should create all changes', () => {
          expect(changes).toHaveLength(3)
        })
        it('should create add changes for elements which are only in the state with proper path', () => {
          const addChanges = changes.filter(isAdditionChange)
          expect(addChanges).toHaveLength(1)
          expect(addChanges[0].data.after.elemID).toEqual(multiPathObjMerged.elemID)
          const detailedChanges = addChanges[0].detailedChanges()
          expect(detailedChanges).toHaveLength(2)
          detailedChanges.forEach(change => {
            expect(change.id).toEqual(multiPathObjMerged.elemID)
          })
          const changePaths = detailedChanges.map(change => change.path)
          expect(changePaths).toContainEqual(['salto', 'obj', 'multi', 'anno'])
          expect(changePaths).toContainEqual(['salto', 'obj', 'multi', 'fields'])
        })
        it('should create remove changes for elements which are only in the workspace with proper path', () => {
          const removeChanges = changes.filter(isRemovalChange)
          expect(removeChanges).toHaveLength(1)
          expect(removeChanges[0].data.before.elemID).toEqual(singlePathObjMerged.elemID)
          const detailedChanges = removeChanges[0].detailedChanges()
          expect(detailedChanges).toHaveLength(1)
          expect(detailedChanges[0].id).toEqual(singlePathObjMerged.elemID)
          expect(detailedChanges[0].path).toBeUndefined()
        })
        it('should create modify changes for elements which have different values in the state and ws with proper path', () => {
          const modifyChanges = changes.filter(isModificationChange)
          expect(modifyChanges).toHaveLength(1)
          expect(modifyChanges[0].data.after.elemID).toEqual(singlePathInstMergedAfter.elemID)
          const detailedChanges = modifyChanges[0].detailedChanges()
          expect(detailedChanges).toHaveLength(1)
          expect(detailedChanges[0].id).toEqual(
            singlePathInstMergedAfter.elemID.createNestedID('nested').createNestedID('str'),
          )
          expect(detailedChanges[0].path).toEqual(['salto', 'inst', 'simple'])
        })
      })
    })
  })

  describe('with remove changes for elements with multiple path hints', () => {
    describe('detailedChanges', () => {
      let changes: DetailedChange[]
      beforeAll(async () => {
        changes = await createRestoreChanges(
          createElementSource([multiPathObjMerged]),
          createElementSource([]),
          index,
          new remoteMap.InMemoryRemoteMap<ElemID[]>(),
        )
      })
      it('should return only on change (avoid spliting by path hint)', () => {
        expect(changes).toHaveLength(1)
      })
    })
    describe('changesWithDetails', () => {
      let changes: ChangeWithDetails[]
      beforeAll(async () => {
        changes = await createRestoreChanges(
          createElementSource([multiPathObjMerged]),
          createElementSource([]),
          index,
          new remoteMap.InMemoryRemoteMap<ElemID[]>(),
          undefined,
          undefined,
          'changes',
        )
      })
      it('should return only on change (avoid spliting by path hint)', () => {
        expect(changes).toHaveLength(1)
        expect(changes[0].detailedChanges()).toHaveLength(1)
      })
    })
  })

  describe('restorePaths', () => {
    let type: ObjectType

    beforeAll(async () => {
      type = new ObjectType({
        elemID: new ElemID('salto', 'type'),
        fields: {
          field1: { refType: BuiltinTypes.STRING },
          field2: { refType: BuiltinTypes.STRING },
        },
      })

      index = new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>()
      await index.set(type.elemID.getFullName(), [
        ['salto', 'type', 'field1'],
        ['salto', 'type', 'field2'],
      ])
      await index.set(type.fields.field1.elemID.getFullName(), [['salto', 'type', 'field1']])
      await index.set(type.fields.field2.elemID.getFullName(), [['salto', 'type', 'field2']])
      await index.set('salto.type.field', [
        ['salto', 'type', 'field1'],
        ['salto', 'type', 'field2'],
      ])
    })
    it('should create deletion and addition references', async () => {
      const changes = await createRestorePathChanges([type], index)

      expect(changes).toHaveLength(3)
      const [removalChange, additionChange1, additionChange2] = changes

      expect(isRemovalChange(removalChange)).toBeTruthy()
      expect(removalChange.id).toEqual(type.elemID)

      expect(isAdditionChange(additionChange1)).toBeTruthy()
      expect(additionChange1.id).toEqual(type.elemID)
      expect(additionChange1.path).toEqual(['salto', 'type', 'field1'])
      expect(getChangeData(additionChange1)).toHaveProperty('fields.field1')
      expect(getChangeData(additionChange1)).not.toHaveProperty('fields.field2')

      expect(isAdditionChange(additionChange2)).toBeTruthy()
      expect(additionChange2.id).toEqual(type.elemID)
      expect(additionChange2.path).toEqual(['salto', 'type', 'field2'])
      expect(getChangeData(additionChange2)).toHaveProperty('fields.field2')
      expect(getChangeData(additionChange2)).not.toHaveProperty('fields.field1')
    })

    it('should restore only the requested accounts', async () => {
      const type2 = new ObjectType({
        elemID: new ElemID('salto2', 'type2'),
      })

      await index.set(type2.elemID.getFullName(), [['salto2', 'type2']])

      const changes = await createRestorePathChanges([type, type2], index, ['salto'])

      expect(changes).toHaveLength(3)
      const [removalChange, additionChange1, additionChange2] = changes

      expect(isRemovalChange(removalChange)).toBeTruthy()
      expect(removalChange.id).toEqual(type.elemID)

      expect(isAdditionChange(additionChange1)).toBeTruthy()
      expect(additionChange1.id).toEqual(type.elemID)
      expect(additionChange1.path).toEqual(['salto', 'type', 'field1'])
      expect(getChangeData(additionChange1)).toHaveProperty('fields.field1')
      expect(getChangeData(additionChange1)).not.toHaveProperty('fields.field2')

      expect(isAdditionChange(additionChange2)).toBeTruthy()
      expect(additionChange2.id).toEqual(type.elemID)
      expect(additionChange2.path).toEqual(['salto', 'type', 'field2'])
      expect(getChangeData(additionChange2)).toHaveProperty('fields.field2')
      expect(getChangeData(additionChange2)).not.toHaveProperty('fields.field1')
    })
  })
})
