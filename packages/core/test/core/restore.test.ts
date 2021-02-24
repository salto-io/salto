/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { Element, ObjectType, ElemID, BuiltinTypes, ListType, InstanceElement, DetailedChange } from '@salto-io/adapter-api'
import { merger, pathIndex, remoteMap } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { createRestoreChanges } from '../../src/core/restore'
import { createElementSource } from '../common/helpers'

const { awu } = collections.asynciterable
const { mergeElements } = merger
const { getElementsPathHints } = pathIndex

describe('restore', () => {
  const nestedType = new ObjectType({
    elemID: new ElemID('salto', 'nested'),
    fields: {
      str: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
      },
      num: {
        refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      },
      list: {
        refType: createRefToElmWithValue(new ListType(BuiltinTypes.NUMBER)),
      },
    },
  })
  // singlePathObject
  const singlePathObject = new ObjectType({
    elemID: new ElemID('salto', 'singlePathObj'),
    fields: {
      simple: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
      },
      nested: {
        refType: createRefToElmWithValue(nestedType),
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
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
      },
      nested: {
        refType: createRefToElmWithValue(nestedType),
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
    index = new remoteMap.InMemoryRemoteMap(await getElementsPathHints(elementfragments))
  })

  describe('with no changes', () => {
    it('should not create changes ws and the state are the same', async () => {
      const changes = await createRestoreChanges(
        await createElementSource(allElement),
        await createElementSource(allElement),
        index
      )
      expect(changes).toHaveLength(0)
    })
  })

  describe('with changes', () => {
    let wsElements: Element[]
    let stateElements: Element[]
    let singlePathInstMergedAfter: InstanceElement
    beforeAll(async () => {
      singlePathInstMergedAfter = singlePathInstMerged.clone() as InstanceElement
      wsElements = [
        singlePathObjMerged,
        multiPathInstMerged,
        singlePathInstMerged,
      ]
      singlePathInstMergedAfter.value.nested.str = 'modified'
      stateElements = [
        multiPathObjMerged,
        singlePathInstMergedAfter,
        multiPathInstMerged,
      ]
    })

    describe('without filters', () => {
      let changes: DetailedChange[]
      beforeAll(async () => {
        changes = await createRestoreChanges(
          await createElementSource([...wsElements, nestedType]),
          await createElementSource([...stateElements, nestedType]),
          index
        )
      })

      it('should create all changes', () => {
        expect(changes).toHaveLength(4)
      })

      it('should create add changes for elements which are only in the state with proper path', () => {
        const addChanges = changes.filter(c => c.action === 'add')
        expect(addChanges).toHaveLength(2)
        addChanges.forEach(change => expect(change.id).toEqual(multiPathObjMerged.elemID))
        const changePaths = addChanges.map(change => change.path)
        expect(changePaths).toContainEqual(['salto', 'obj', 'multi', 'anno'])
        expect(changePaths).toContainEqual(['salto', 'obj', 'multi', 'fields'])
      })
      it('should create remove changes for elements which are only in the workspace with proper path', () => {
        const removeChange = changes.find(c => c.action === 'remove')
        expect(removeChange).toBeDefined()
        expect(removeChange?.id).toEqual(singlePathObjMerged.elemID)
        expect(removeChange?.path).toBeUndefined()
      })
      it('should create modify changes for elements which have different values in the state and ws with proper path', () => {
        const modifyChange = changes.find(c => c.action === 'modify')
        expect(modifyChange).toBeDefined()
        expect(modifyChange?.id).toEqual(singlePathInstMergedAfter.elemID
          .createNestedID('nested').createNestedID('str'))
        expect(modifyChange?.path).toEqual(['salto', 'inst', 'simple'])
      })
    })
  })
})
