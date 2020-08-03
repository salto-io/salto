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
import { merger } from '@salto-io/workspace'
import { createDiffChanges } from '../../src/core/diff'

const { mergeElements } = merger

describe('diff', () => {
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

  describe('with no changes', () => {
    it('should not create changes toElements and the fromElements are the same', async () => {
      const changes = await createDiffChanges(allElement, allElement)
      expect(changes).toHaveLength(0)
    })
  })

  describe('with changes', () => {
    const singlePathInstMergedAfter = singlePathInstMerged.clone() as InstanceElement
    const toElements = [
      singlePathObjMerged,
      multiPathInstMerged,
      singlePathInstMerged,
    ]
    singlePathInstMergedAfter.value.nested.str = 'modified'
    const beforeElements = [
      multiPathObjMerged,
      singlePathInstMergedAfter,
      multiPathInstMerged,
    ]
    describe('without filters', () => {
      let changes: DetailedChange[]
      beforeAll(async () => {
        changes = await createDiffChanges(toElements, beforeElements)
      })

      it('should create all changes', () => {
        expect(changes).toHaveLength(3)
      })

      it('should create add changes for elements which are only in the fromElements', () => {
        const addChanges = changes.filter(c => c.action === 'add')
        expect(addChanges).toHaveLength(1)
        addChanges.forEach(change => expect(change.id).toEqual(multiPathObjMerged.elemID))
      })
      it('should create remove changes for elements which are only in the workspace', () => {
        const removeChange = changes.find(c => c.action === 'remove')
        expect(removeChange).toBeDefined()
        expect(removeChange?.id).toEqual(singlePathObjMerged.elemID)
        expect(removeChange?.path).toBeUndefined()
      })
      it('should create remove changes for elements which have different values in the fromElements and toElements', () => {
        const modifyChange = changes.find(c => c.action === 'modify')
        expect(modifyChange).toBeDefined()
        expect(modifyChange?.id).toEqual(singlePathInstMergedAfter.elemID
          .createNestedID('nested').createNestedID('str'))
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
        changes = await createDiffChanges(toElements, beforeElements, filters)
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
