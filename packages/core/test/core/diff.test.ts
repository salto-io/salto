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
import { Element, ObjectType, ElemID, BuiltinTypes, ListType, InstanceElement, DetailedChange } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { merger, createElementSelector } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { createDiffChanges } from '../../src/core/diff'
import { createElementSource } from '../common/helpers'

const { awu } = collections.asynciterable
const { mergeElements } = merger

describe('diff', () => {
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
        annotations: {
          description: 'description',
        },
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
  ]

  let allElement: Element[]
  let singlePathObjMerged: Element
  let multiPathObjMerged: Element
  let singlePathInstMerged: Element
  let multiPathInstMerged: Element

  beforeAll(async () => {
    const { merged } = await mergeElements(awu([singlePathObject, ...elementfragments]))
    allElement = await awu(merged.values()).toArray()
    singlePathObjMerged = allElement[0].clone()
    multiPathObjMerged = allElement[2].clone()
    singlePathInstMerged = allElement[1].clone()
    multiPathInstMerged = allElement[3].clone()
  })

  describe('with no changes', () => {
    it('should not create changes toElements and the fromElements are the same', async () => {
      const changes = await createDiffChanges(
        createElementSource(allElement),
        createElementSource(allElement)
      )
      expect(changes).toHaveLength(0)
    })
  })

  describe('with changes', () => {
    let singlePathInstMergedAfter: InstanceElement
    let toElements: Element[]
    let beforeElements: Element[]
    beforeAll(async () => {
      singlePathInstMergedAfter = singlePathInstMerged.clone() as InstanceElement
      toElements = [
        singlePathObjMerged,
        multiPathInstMerged,
        singlePathInstMerged,
      ]
      singlePathInstMergedAfter.value.nested.str = 'modified'
      beforeElements = [
        multiPathObjMerged,
        singlePathInstMergedAfter,
        multiPathInstMerged,
      ]
    })


    describe('without filters', () => {
      let changes: DetailedChange[]
      beforeAll(async () => {
        changes = await createDiffChanges(
          createElementSource(toElements),
          createElementSource(beforeElements)
        )
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
      let nestedID: ElemID
      beforeAll(async () => {
        nestedID = singlePathInstMerged.elemID
          .createNestedID('nested')
          .createNestedID('str')
        const selectors = [
          createElementSelector(singlePathObjMerged.elemID.getFullName()),
          createElementSelector(nestedID.getFullName()),
        ]
        changes = await createDiffChanges(
          await createElementSource(toElements),
          await createElementSource(beforeElements),
          selectors
        )
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
    describe('check diff handling of selectors', () => {
      it('returns empty diff when element id exists but is not in diff', async () => {
        const selectors = [
          createElementSelector(multiPathInstMerged.elemID.getFullName()),
        ]
        const changes = await createDiffChanges(
          createElementSource(toElements),
          createElementSource(beforeElements),
          selectors,
        )
        expect(changes).toHaveLength(0)
      })
      it('throws error when selector catches nothing', async () => {
        const selectors = [
          createElementSelector('salto.multiPathObj.field.thereisnofieldbythisname'),
        ]
        await expect(createDiffChanges(
          createElementSource(toElements),
          createElementSource(beforeElements),
          selectors,
        )).rejects.toThrow()
      })
      it('includes child elements when their parent is selected ', async () => {
        const nestedID = singlePathInstMerged.elemID
          .createNestedID('nested')
          .createNestedID('str').getFullName()
        const simpleId = singlePathInstMerged.elemID
          .createNestedID('simple').getFullName()
        const newSinglePathInstMergedAfter = singlePathInstMergedAfter.clone() as InstanceElement
        newSinglePathInstMergedAfter.value.simple = 'old simple'
        const newBeforeElements = [
          multiPathObjMerged,
          multiPathInstMerged,
          newSinglePathInstMergedAfter,
        ]
        const selectors = [
          createElementSelector(singlePathInstMerged.elemID.getFullName()),
        ]
        const changes = await createDiffChanges(
          createElementSource(toElements),
          createElementSource(newBeforeElements),
          selectors,
        )
        expect(changes).toHaveLength(2)
        expect(changes.map(change => change.id.getFullName())
          .sort()).toEqual([nestedID, simpleId].sort())
      })

      it('includes field inner annotations when the field is selected', async () => {
        const newSinglePathObjMerged = singlePathObjMerged.clone() as ObjectType
        newSinglePathObjMerged.fields.simple.annotations.description = 'new description'
        const simpleFieldId = newSinglePathObjMerged.elemID.createNestedID('field', 'simple')
        const selectors = [
          createElementSelector(simpleFieldId.getFullName()),
        ]
        const changes = await createDiffChanges(
          [newSinglePathObjMerged], 
          [singlePathObjMerged], 
          // If we have here - need to add the subtypes
          new InMemoryRemoteElementSource([newSinglePathObjMerged]),
          new InMemoryRemoteElementSource([singlePathObjMerged]),
          selectors
        )
        expect(changes.map(change => change.id.getFullName()))
          .toEqual([simpleFieldId.createNestedID('description').getFullName()])
      })
    })
  })
})
