/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ObjectType,
  ElemID,
  InstanceElement,
  DetailedChange,
  PrimitiveType,
  BuiltinTypes,
  PrimitiveTypes,
  Field,
  INSTANCE_ANNOTATIONS,
  createRefToElmWithValue,
  ReferenceExpression,
  isAdditionChange,
  toChange,
  Change,
  TypeReference,
} from '@salto-io/adapter-api'
import {
  detailedCompare,
  applyDetailedChanges,
  getRelevantNamesFromChange,
  getIndependentChanges,
} from '../src/compare'

describe('detailedCompare', () => {
  const hasChange = (changes: DetailedChange[], action: string, id: ElemID): boolean =>
    changes.find(change => change.action === action && _.isEqual(change.id, id)) !== undefined
  describe('compare instances', () => {
    const instType = new ObjectType({
      elemID: new ElemID('salto', 'obj'),
    })
    const before = new InstanceElement(
      'inst',
      instType,
      {
        before: 'Before',
        modify: 'Before',
      },
      undefined,
      {
        [INSTANCE_ANNOTATIONS.HIDDEN]: true,
        [INSTANCE_ANNOTATIONS.SERVICE_URL]: 'before',
      },
    )
    const after = new InstanceElement(
      'inst',
      instType,
      {
        after: 'Before',
        modify: 'After',
      },
      undefined,
      {
        [INSTANCE_ANNOTATIONS.SERVICE_URL]: 'after',
        [INSTANCE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [],
      },
    )
    const changes = detailedCompare(before, after)
    it('should create add changes for values that were only present in the after instance', () => {
      expect(hasChange(changes, 'add', after.elemID.createNestedID('after'))).toBeTruthy()
    })
    it('should create remove changes for values that were only present in the before instance', () => {
      expect(hasChange(changes, 'remove', before.elemID.createNestedID('before'))).toBeTruthy()
    })
    it('should create modify changes for values that were only present both instances', () => {
      expect(hasChange(changes, 'modify', before.elemID.createNestedID('modify'))).toBeTruthy()
    })
    it('should create add changes for new annotation values', () => {
      expect(
        hasChange(changes, 'add', after.elemID.createNestedID(INSTANCE_ANNOTATIONS.GENERATED_DEPENDENCIES)),
      ).toBeTruthy()
    })
    it('should create modify changes for changed annotation values', () => {
      expect(hasChange(changes, 'modify', after.elemID.createNestedID(INSTANCE_ANNOTATIONS.SERVICE_URL))).toBeTruthy()
    })
    it('should create remove changes for removed annotation values', () => {
      expect(hasChange(changes, 'remove', before.elemID.createNestedID(INSTANCE_ANNOTATIONS.HIDDEN))).toBeTruthy()
    })
    describe('compare lists with compareListItems', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let listID: ElemID
      let baseChange: Change<InstanceElement>

      beforeEach(() => {
        beforeInst = new InstanceElement('inst', instType, { list: [] })
        afterInst = new InstanceElement('inst', instType, { list: [] })
        listID = beforeInst.elemID.createNestedID('list')
        baseChange = toChange({ before: beforeInst, after: afterInst })
      })

      it('should detect removals', () => {
        beforeInst.value.list = ['a', 'b', 'c']
        afterInst.value.list = ['a', 'c']
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        expect(listChanges).toEqual([
          {
            id: listID.createNestedID('1'),
            data: { before: 'b' },
            action: 'remove',
            elemIDs: {
              before: listID.createNestedID('1'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('2'),
            data: { before: 'c', after: 'c' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('2'),
              after: listID.createNestedID('1'),
            },
            baseChange,
          },
        ])
      })

      it('should detect addition', () => {
        beforeInst.value.list = ['a', 'c']
        afterInst.value.list = ['a', 'b', 'c']
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        expect(listChanges).toEqual([
          {
            id: listID.createNestedID('1'),
            data: { after: 'b' },
            action: 'add',
            elemIDs: {
              after: listID.createNestedID('1'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('2'),
            data: { before: 'c', after: 'c' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('1'),
              after: listID.createNestedID('2'),
            },
            baseChange,
          },
        ])
      })

      it('should prefer value modification without reorder', () => {
        beforeInst.value.list = ['a', 'b', 'f']
        afterInst.value.list = ['c', 'a', 'd', 'g']
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        expect(listChanges).toEqual([
          {
            id: listID.createNestedID('0'),
            data: { after: 'c' },
            action: 'add',
            elemIDs: {
              after: listID.createNestedID('0'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('1'),
            data: { before: 'b' },
            action: 'remove',
            elemIDs: {
              before: listID.createNestedID('1'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('2'),
            data: { before: 'a', after: 'a' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('0'),
              after: listID.createNestedID('1'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('3'),
            data: { before: 'f', after: 'd' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('2'),
              after: listID.createNestedID('2'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('4'),
            data: { after: 'g' },
            action: 'add',
            elemIDs: {
              after: listID.createNestedID('3'),
            },
            baseChange,
          },
        ])
      })

      it('should detect reorder with modification', () => {
        beforeInst.value.list = ['a', 'b', 'e', 'f']
        afterInst.value.list = ['c', 'a', 'd', 'e', 'g']
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        expect(listChanges).toEqual([
          {
            id: listID.createNestedID('0'),
            data: { after: 'c' },
            action: 'add',
            elemIDs: {
              after: listID.createNestedID('0'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('1'),
            data: { before: 'a', after: 'a' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('0'),
              after: listID.createNestedID('1'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('2'),
            data: { before: 'b', after: 'd' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('1'),
              after: listID.createNestedID('2'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('3'),
            data: { before: 'e', after: 'e' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('2'),
              after: listID.createNestedID('3'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('4'),
            data: { before: 'f', after: 'g' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('3'),
              after: listID.createNestedID('4'),
            },
            baseChange,
          },
        ])
      })

      it('should detect addition and modification correctly', () => {
        beforeInst.value.list = ['c', 'a', 'b', 'e']
        afterInst.value.list = ['a', 'd', 'h']
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        expect(listChanges).toEqual([
          {
            id: listID.createNestedID('0'),
            data: { before: 'c' },
            action: 'remove',
            elemIDs: {
              before: listID.createNestedID('0'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('1'),
            data: { before: 'a', after: 'a' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('1'),
              after: listID.createNestedID('0'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('2'),
            data: { after: 'd' },
            action: 'add',
            elemIDs: {
              after: listID.createNestedID('1'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('3'),
            data: { before: 'e' },
            action: 'remove',
            elemIDs: {
              before: listID.createNestedID('3'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('4'),
            data: { before: 'b', after: 'h' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('2'),
              after: listID.createNestedID('2'),
            },
            baseChange,
          },
        ])
      })

      it('should first try to match exact items and then items that has the same top level values', () => {
        beforeInst.value.list = [
          {
            value1: 'a',
            value2: ['a'],
          },
          {
            value1: 'a',
            value2: ['b'],
          },
        ]

        afterInst.value.list = [
          {
            value1: 'a',
            value2: ['c'],
          },
          {
            value1: 'a',
            value2: ['a'],
          },
        ]
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        expect(listChanges).toEqual([
          {
            id: listID.createNestedID('0', 'value2', '0'),
            data: { before: 'b', after: 'c' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('1', 'value2', '0'),
              after: listID.createNestedID('0', 'value2', '0'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('0'),
            data: {
              before: { value1: 'a', value2: ['b'] },
              after: { value1: 'a', value2: ['c'] },
            },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('1'),
              after: listID.createNestedID('0'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('1'),
            data: {
              before: { value1: 'a', value2: ['a'] },
              after: { value1: 'a', value2: ['a'] },
            },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('0'),
              after: listID.createNestedID('1'),
            },
            baseChange,
          },
        ])
      })

      it('should work with empty objects in the list', () => {
        beforeInst.value.list = [
          {
            val: [],
          },
          {},
          {},
        ]

        afterInst.value.list = [
          {
            val: [],
          },
        ]
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        expect(listChanges).toEqual([
          {
            id: listID.createNestedID('1'),
            data: { before: {} },
            action: 'remove',
            elemIDs: {
              before: listID.createNestedID('1'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('2'),
            data: { before: {} },
            action: 'remove',
            elemIDs: {
              before: listID.createNestedID('2'),
            },
            baseChange,
          },
        ])
      })

      it('should work with null values in the list', () => {
        beforeInst.value.list = [
          null,
          {
            val: null,
          },
          {
            val: undefined,
          },
        ]

        afterInst.value.list = [
          {
            val: null,
          },
          {
            val: undefined,
          },
          null,
        ]
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        expect(listChanges).toEqual([
          {
            id: listID.createNestedID('0'),
            data: { before: { val: null }, after: { val: null } },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('1'),
              after: listID.createNestedID('0'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('1'),
            data: { before: { val: undefined }, after: { val: undefined } },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('2'),
              after: listID.createNestedID('1'),
            },
            baseChange,
          },
          {
            id: listID.createNestedID('2'),
            data: { before: null, after: null },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('0'),
              after: listID.createNestedID('2'),
            },
            baseChange,
          },
        ])
      })
    })
  })

  describe('compare primitive types', () => {
    const before = new PrimitiveType({
      elemID: new ElemID('salto', 'prim'),
      annotationRefsOrTypes: {
        before: BuiltinTypes.STRING,
        modify: BuiltinTypes.STRING,
      },
      annotations: {
        before: 'Before',
        modify: 'Before',
      },
      primitive: PrimitiveTypes.STRING,
    })

    const after = new PrimitiveType({
      elemID: new ElemID('salto', 'prim'),
      annotationRefsOrTypes: {
        modify: BuiltinTypes.NUMBER,
        after: BuiltinTypes.STRING,
      },
      annotations: {
        modify: 1,
        after: 'AFTER',
      },
      primitive: PrimitiveTypes.STRING,
    })

    const changes = detailedCompare(before, after)
    it('should add the right baseChange', () => {
      const baseChange = toChange({ before, after })
      changes.forEach(change => expect(change.baseChange).toEqual(baseChange))
    })
    it('should create add changes for values that were only present in the after type', () => {
      expect(hasChange(changes, 'add', after.elemID.createNestedID('annotation', 'after'))).toBeTruthy()
      expect(hasChange(changes, 'add', after.elemID.createNestedID('attr', 'after'))).toBeTruthy()
    })
    it('should create remove changes for values that were only present in the before type', () => {
      expect(hasChange(changes, 'remove', after.elemID.createNestedID('annotation', 'before'))).toBeTruthy()
      expect(hasChange(changes, 'remove', after.elemID.createNestedID('attr', 'before'))).toBeTruthy()
    })
    it('should create modify changes for values that were only present both types', () => {
      expect(hasChange(changes, 'modify', after.elemID.createNestedID('annotation', 'modify'))).toBeTruthy()
      expect(hasChange(changes, 'modify', after.elemID.createNestedID('attr', 'modify'))).toBeTruthy()
    })

    describe("when the primitive type's primitive changed", () => {
      it('should return a detailed change on the whole type', () => {
        const afterWithDifferentPrimitive = after.clone()
        afterWithDifferentPrimitive.primitive = PrimitiveTypes.NUMBER
        const primitiveTypeChanges = detailedCompare(before, afterWithDifferentPrimitive)
        expect(primitiveTypeChanges).toHaveLength(1)
        expect(primitiveTypeChanges[0].id).toEqual(afterWithDifferentPrimitive.elemID)
      })
    })
  })

  describe('compare object types', () => {
    const before = new ObjectType({
      elemID: new ElemID('salto', 'prim'),
      annotationRefsOrTypes: {
        before: BuiltinTypes.STRING,
        modify: BuiltinTypes.STRING,
      },
      annotations: {
        before: 'Before',
        modify: 'Before',
      },
      fields: {
        before: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            before: 'Before',
            modify: 'Before',
          },
        },
        modify: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            before: 'Before',
            modify: 'Before',
          },
        },
      },
    })
    const after = new ObjectType({
      elemID: new ElemID('salto', 'obj'),
      annotationRefsOrTypes: {
        after: BuiltinTypes.STRING,
        modify: BuiltinTypes.NUMBER,
      },
      annotations: {
        after: 'After',
        modify: 1,
      },
      fields: {
        after: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            before: 'After',
            modify: 'After',
          },
        },
        modify: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            after: 'After',
            modify: 'After',
          },
        },
      },
    })

    describe('without field changes', () => {
      const changes = detailedCompare(before, after)
      it('should add the right baseChange', () => {
        const baseChange = toChange({ before, after })
        changes.forEach(change => expect(change.baseChange).toEqual(baseChange))
      })
      it('should create add changes for values that were only present in the after object', () => {
        expect(hasChange(changes, 'add', after.elemID.createNestedID('annotation', 'after'))).toBeTruthy()
        expect(hasChange(changes, 'add', after.elemID.createNestedID('attr', 'after'))).toBeTruthy()
      })
      it('should create remove changes for values that were only present in the before object', () => {
        expect(hasChange(changes, 'remove', after.elemID.createNestedID('annotation', 'before'))).toBeTruthy()
        expect(hasChange(changes, 'remove', after.elemID.createNestedID('attr', 'before'))).toBeTruthy()
      })
      it('should create modify changes for values that were only present both objects', () => {
        expect(hasChange(changes, 'modify', after.elemID.createNestedID('annotation', 'modify'))).toBeTruthy()
        expect(hasChange(changes, 'modify', after.elemID.createNestedID('attr', 'modify'))).toBeTruthy()
      })
    })
    describe('with field changes', () => {
      const changes = detailedCompare(before, after, { createFieldChanges: true })
      it('should add the right baseChange', () => {
        const baseChange = toChange({ before, after })
        changes.forEach(change => expect(change.baseChange).toEqual(baseChange))
      })
      it('should identify field changes, and create changes with the field id', () => {
        expect(hasChange(changes, 'modify', after.fields.modify.elemID.createNestedID('modify'))).toBeTruthy()
        expect(hasChange(changes, 'add', after.fields.after.elemID)).toBeTruthy()
        expect(hasChange(changes, 'remove', before.fields.before.elemID)).toBeTruthy()
      })
    })
    describe('with meta type change', () => {
      it('should return only the base change', () => {
        const afterMeta = before.clone()
        afterMeta.metaType = new TypeReference(new ElemID('salto', 'meta'))
        const changes = detailedCompare(before, afterMeta)
        expect(changes).toHaveLength(1)
        expect(hasChange(changes, 'modify', before.elemID)).toBeTruthy()
      })
    })
  })

  describe('compare fields', () => {
    const parent = new ObjectType({ elemID: new ElemID('salto', 'obj') })
    const before = new Field(parent, 'field', BuiltinTypes.STRING, {
      before: 'Before',
      modify: 'Before',
    })
    const after = new Field(parent, 'field', BuiltinTypes.STRING, {
      after: 'After',
      modify: 'After',
    })
    const changes = detailedCompare(before, after)
    it('should add the right baseChange', () => {
      const baseChange = toChange({ before, after })
      changes.forEach(change => expect(change.baseChange).toEqual(baseChange))
    })
    it('should create add changes for values that were only present in the after field', () => {
      expect(hasChange(changes, 'add', after.elemID.createNestedID('after'))).toBeTruthy()
    })
    it('should create remove changes for values that were only present in the before field', () => {
      expect(hasChange(changes, 'remove', after.elemID.createNestedID('before'))).toBeTruthy()
    })
    it('should create modify changes for values that were only present both fields', () => {
      expect(hasChange(changes, 'modify', after.elemID.createNestedID('modify'))).toBeTruthy()
    })
    it('should return only the base change when the type changes', () => {
      const afterNumber = before.clone()
      afterNumber.refType = new TypeReference(BuiltinTypes.NUMBER.elemID)
      const typeChanges = detailedCompare(before, afterNumber)
      expect(typeChanges).toHaveLength(1)
      expect(hasChange(typeChanges, 'modify', before.elemID)).toBeTruthy()
    })
  })
})

describe('applyDetailedChanges', () => {
  let inst: InstanceElement
  beforeAll(() => {
    const instType = new ObjectType({ elemID: new ElemID('test', 'test') })
    inst = new InstanceElement('test', instType, { val: 1, rem: 0, nested: { mod: 1 } })
    const changes: DetailedChange[] = [
      {
        id: inst.elemID.createNestedID('nested', 'mod'),
        action: 'modify',
        data: { before: 1, after: 2 },
      },
      {
        id: inst.elemID.createNestedID('rem'),
        action: 'remove',
        data: { before: 0 },
      },
      {
        id: inst.elemID.createNestedID('add'),
        action: 'add',
        data: { after: 3 },
      },
      {
        id: inst.elemID.createNestedID('val'),
        action: 'modify',
        data: { before: 1, after: 2 },
      },
    ]
    applyDetailedChanges(inst, changes, change => change.id.name !== 'val')
  })

  it('should add new values', () => {
    expect(inst.value.add).toEqual(3)
  })

  it('should modify existing values', () => {
    expect(inst.value.nested.mod).toEqual(2)
  })

  it('should remove values', () => {
    expect(inst.value).not.toHaveProperty('rem')
  })

  it('should not apply filtered out values', () => {
    expect(inst.value.val).toEqual(1)
  })

  describe('with changes from compareListItems', () => {
    describe('with list removals', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      let listChanges: DetailedChange[]
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement('inst', instType, { a: ['c', 'a', 'd', 'e'] })
        afterInst = new InstanceElement('inst', instType, { a: ['a', 'b'] })
        listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
      })
      it('should reproduce the after element', () => {
        applyDetailedChanges(outputInst, listChanges)
        expect(outputInst).toEqual(afterInst)
      })
      it('should apply matching changes only', () => {
        applyDetailedChanges(outputInst, listChanges, change => change.elemIDs?.before?.name !== '0')
        expect(outputInst.value).toEqual({ a: ['c', 'a', 'e'] })
      })
    })
    describe('with list additions', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      let listChanges: DetailedChange[]
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement('inst', instType, { a: ['e', 'b', 'a'] })
        afterInst = new InstanceElement('inst', instType, { a: ['a', 'f', 'f', 'b', 'c', 'd'] })
        listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
      })
      it('should reproduce the after element', () => {
        applyDetailedChanges(outputInst, listChanges)
        expect(outputInst).toEqual(afterInst)
      })
      it('should apply matching changes only', () => {
        applyDetailedChanges(outputInst, listChanges, change => ['2', '5'].includes(change.elemIDs?.after?.name ?? ''))
        expect(outputInst.value).toEqual({ a: ['e', 'b', 'f', 'a', 'd'] })
      })
    })

    describe('with list reorder', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      let listChanges: DetailedChange[]
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement('inst', instType, { a: ['a', 'b'] })
        afterInst = new InstanceElement('inst', instType, { a: ['b', 'a'] })
        listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
      })
      it('should reproduce the after element', () => {
        applyDetailedChanges(outputInst, listChanges)
        expect(outputInst).toEqual(afterInst)
      })
      it('should not apply reorder changes when only some of them match', () => {
        applyDetailedChanges(outputInst, listChanges, change => change.id.name === '0')
        expect(outputInst).toEqual(beforeInst)
      })
    })

    describe('When only list addition included', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement('inst', instType, { a: ['a', 'c'] })
        afterInst = new InstanceElement('inst', instType, { a: ['a', 'b', 'c'] })
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
        applyDetailedChanges(outputInst, listChanges.filter(isAdditionChange))
      })
      it('should apply the changes', () => {
        expect(outputInst.value.a).toEqual(['a', 'b', 'c'])
      })
    })

    describe('When list objects', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      let listChanges: DetailedChange[]
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement('inst', instType, {
          a: [
            { a: 2 },
            { ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 1) },
            { a: 2, b: 3 },
          ],
        })

        afterInst = new InstanceElement('inst', instType, {
          a: [
            { ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 2) },
            { a: 2, b: 4 },
            { a: 4 },
          ],
        })
        listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
      })
      it('should apply the changes', () => {
        applyDetailedChanges(outputInst, listChanges)
        expect(outputInst.value.a).toEqual(afterInst.value.a)
      })
      it('should apply matching changes only', () => {
        applyDetailedChanges(
          outputInst,
          listChanges,
          change => !['0', 'b'].includes(change.elemIDs?.before?.name ?? ''),
        )
        expect(outputInst.value.a).toEqual([
          { a: 2 },
          { ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 1) },
          { a: 2, b: 4 },
          { a: 4, b: 3 },
        ])
      })
    })

    describe('When inner list', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      let listChanges: DetailedChange[]
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement('inst', instType, {
          a: [
            { name: 'a', list: [1] },
            { name: 'b', list: [2] },
            { name: 'c', list: [3] },
            { name: 'd', list: [4, 5] },
          ],
        })

        afterInst = new InstanceElement('inst', instType, {
          a: [
            { name: 'c', list: [3] },
            { name: 'e', list: [5] },
            { name: 'b', list: [2] },
            { name: 'd', list: [4] },
          ],
        })
        listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
      })
      it('should apply the changes', () => {
        applyDetailedChanges(outputInst, listChanges)
        expect(outputInst.value.a).toEqual(afterInst.value.a)
      })
      it('should apply matching changes only', () => {
        applyDetailedChanges(outputInst, listChanges, change => change.elemIDs?.before?.name !== '0')
        expect(outputInst.value.a).toEqual([
          { name: 'a', list: [1] },
          { name: 'b', list: [2] },
          { name: 'e', list: [5] },
          { name: 'c', list: [3] },
          { name: 'd', list: [4] },
        ])
      })
      it('should apply matching changes only - nest changes', () => {
        applyDetailedChanges(outputInst, listChanges, change => change.elemIDs?.before?.nestingLevel === 4)
        expect(outputInst.value.a).toEqual([
          { name: 'a', list: [1] },
          { name: 'b', list: [2] },
          { name: 'c', list: [3] },
          { name: 'd', list: [4] },
        ])
      })
    })
  })

  describe('when list objects and reorder and modification on the same item', () => {
    let beforeInst: InstanceElement
    let afterInst: InstanceElement
    let outputInst: InstanceElement
    let listChanges: DetailedChange[]
    beforeEach(() => {
      const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
      beforeInst = new InstanceElement('inst', instType, {
        a: [{ ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 1) }, { a: 3 }],
      })

      afterInst = new InstanceElement('inst', instType, {
        a: [
          { a: 2, b: 5 },
          { ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 2) },
          { a: 2, b: 4 },
          { a: 3, b: 6 },
        ],
      })
      listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
      outputInst = beforeInst.clone()
    })
    it('should apply the changes', () => {
      applyDetailedChanges(outputInst, listChanges)
      expect(outputInst.value.a).toEqual(afterInst.value.a)
    })
    it('should apply matching changes only', () => {
      applyDetailedChanges(outputInst, listChanges, change => change.elemIDs?.after?.name !== '0')
      expect(outputInst.value.a).toEqual([
        { ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 1) },
        { a: 2, b: 4 },
        { a: 3 },
      ])
    })
  })

  describe('when there is object with number as keys', () => {
    let beforeInst: InstanceElement
    let afterInst: InstanceElement
    let outputInst: InstanceElement
    let listChanges: DetailedChange[]
    beforeEach(() => {
      const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
      beforeInst = new InstanceElement('inst', instType, {
        a: {
          1: 'a',
          2: 'b',
        },
      })

      afterInst = new InstanceElement('inst', instType, {
        a: {
          1: 'b',
          2: 'a',
        },
      })
      listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
      outputInst = beforeInst.clone()
    })
    it('should apply the changes', () => {
      applyDetailedChanges(outputInst, listChanges)
      expect(outputInst.value.a).toEqual(afterInst.value.a)
    })
    it('should apply matching changes only and not treat as reordering', () => {
      applyDetailedChanges(outputInst, listChanges, change => change.elemIDs?.after?.name === '1')
      expect(outputInst.value.a).toEqual({ 1: 'b', 2: 'b' })
    })
  })

  describe('should apply changes in the correct order', () => {
    let beforeInst: InstanceElement
    beforeEach(() => {
      const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
      beforeInst = new InstanceElement('inst', instType, {
        a: _.times(11),
      })

      const listChanges: DetailedChange[] = [
        {
          id: beforeInst.elemID.createNestedID('a', '2'),
          data: {
            after: 'a',
          },
          action: 'add',
          elemIDs: {
            after: beforeInst.elemID.createNestedID('a', '2'),
          },
        },
        {
          id: beforeInst.elemID.createNestedID('a', '10'),
          data: {
            after: 'b',
          },
          action: 'add',
          elemIDs: {
            after: beforeInst.elemID.createNestedID('a', '10'),
          },
        },
      ]

      applyDetailedChanges(beforeInst, listChanges)
    })
    it('should apply the changes', () => {
      expect(beforeInst.value.a).toEqual([0, 1, 'a', 2, 3, 4, 5, 6, 7, 8, 'b', 9, 10])
    })
  })

  describe('when before element and after element have different IDs', () => {
    describe('with value from a different instance', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      beforeEach(() => {
        beforeInst = new InstanceElement('name1', new ObjectType({ elemID: new ElemID('test', 'type') }), { val1: '1' })
        afterInst = new InstanceElement('name2', new ObjectType({ elemID: new ElemID('test', 'type') }), { val1: '2' })
      })
      it('should apply the changes', () => {
        const changes = detailedCompare(beforeInst, afterInst)
        const updatedInst = beforeInst.clone()
        applyDetailedChanges(updatedInst, changes)
        expect(updatedInst.value.val1).toEqual(afterInst.value.val1)
      })
    })

    describe('with annotations from a different object', () => {
      let beforeObj: ObjectType
      let afterObj: ObjectType
      beforeEach(() => {
        beforeObj = new ObjectType({
          elemID: new ElemID('test', 'before'),
          annotations: {
            val1: '1',
          },
        })
        afterObj = new ObjectType({
          elemID: new ElemID('test', 'after'),
          annotations: {
            val1: '2',
          },
        })
      })
      it('should apply the changes', () => {
        const changes = detailedCompare(beforeObj, afterObj)
        const updatedObj = beforeObj.clone()
        applyDetailedChanges(updatedObj, changes)
        expect(updatedObj.annotations.val1).toEqual(afterObj.annotations.val1)
      })
    })
  })

  describe('with a modification on a whole element', () => {
    describe('when a meta type is added to a type', () => {
      let beforeType: ObjectType
      let afterType: ObjectType
      let outputType: ObjectType
      beforeEach(() => {
        beforeType = new ObjectType({
          elemID: new ElemID('test', 'type'),
          annotations: { anno: 'val1' },
        })
        afterType = new ObjectType({
          elemID: new ElemID('test', 'type'),
          annotations: { anno: 'val2' },
          metaType: new ObjectType({ elemID: new ElemID('test', 'meta') }),
        })
        const changes = detailedCompare(beforeType, afterType)
        outputType = beforeType.clone()
        applyDetailedChanges(outputType, changes)
      })
      it('should reproduce the after element', () => {
        expect(outputType).toEqual(afterType)
      })
    })

    describe('when a meta type is removed from a type', () => {
      let beforeType: ObjectType
      let afterType: ObjectType
      let outputType: ObjectType
      beforeEach(() => {
        beforeType = new ObjectType({
          elemID: new ElemID('test', 'type'),
          annotations: { anno: 'val1' },
          metaType: new ObjectType({ elemID: new ElemID('test', 'meta') }),
        })
        afterType = new ObjectType({
          elemID: new ElemID('test', 'type'),
          annotations: { anno: 'val2' },
        })
        const changes = detailedCompare(beforeType, afterType)
        outputType = beforeType.clone()
        applyDetailedChanges(outputType, changes)
      })
      it('should reproduce the after element', () => {
        expect(outputType).toEqual(afterType)
      })
    })

    describe('when the type of a field is changed', () => {
      let beforeType: ObjectType
      let afterType: ObjectType
      beforeEach(() => {
        beforeType = new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            field: {
              refType: BuiltinTypes.STRING,
              annotations: {
                anno: 'val1',
              },
            },
          },
        })
        afterType = new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            field: {
              refType: BuiltinTypes.NUMBER,
              annotations: {
                anno: 'val2',
              },
            },
          },
        })
      })
      describe('when applying changes on the object type', () => {
        let outputType: ObjectType
        beforeEach(() => {
          const changes = detailedCompare(beforeType, afterType, { createFieldChanges: true })
          outputType = beforeType.clone()
          applyDetailedChanges(outputType, changes)
        })
        it('should reproduce the after element', () => {
          expect(outputType).toEqual(afterType)
        })
      })
      describe('when applying changes on the field', () => {
        let outputField: Field
        beforeEach(() => {
          const changes = detailedCompare(beforeType.fields.field, afterType.fields.field, { createFieldChanges: true })
          outputField = beforeType.fields.field.clone()
          applyDetailedChanges(outputField, changes)
        })
        it('should reproduce the after field', () => {
          expect(outputField).toEqual(afterType.fields.field)
        })
      })
    })
  })
})

describe('getIndependentChanges', () => {
  const type = new ObjectType({ elemID: new ElemID('salto', 'obj') })
  it('should return all changes when there are no order changes', () => {
    const before = new InstanceElement('inst', type, { list: [{ num: 1 }, { num: 2 }, { num: 3 }] })
    const after = new InstanceElement('inst', type, { list: [{ num: 2 }, { num: 3 }, { num: 4 }] })
    const detailedChanges = detailedCompare(before, after, { compareListItems: true })
    expect(detailedChanges).toHaveLength(4)
    const filteredChanges = getIndependentChanges(detailedChanges)
    expect(filteredChanges).toEqual(detailedChanges)
  })
  it('should return only changes that are not children of other changes', () => {
    const before = new InstanceElement('inst', type, {
      list: [{ num: 1, innerList: [1, 2] }, { num: 2 }, { num: 3, innerList: [1, 2] }],
    })
    const after = new InstanceElement('inst', type, {
      list: [
        { num: 1, innerList: [1, 2, 3] },
        { num: 3, innerList: [1, 2, 3] },
      ],
    })
    const detailedChanges = detailedCompare(before, after, { compareListItems: true })
    expect(detailedChanges).toHaveLength(4)
    expect(detailedChanges).toEqual([
      expect.objectContaining({
        action: 'add',
        elemIDs: {
          after: before.elemID.createNestedID('list', '0', 'innerList', '2'),
        },
      }),
      expect.objectContaining({ action: 'remove', elemIDs: { before: before.elemID.createNestedID('list', '1') } }),
      expect.objectContaining({
        action: 'add',
        elemIDs: {
          after: before.elemID.createNestedID('list', '1', 'innerList', '2'),
        },
      }),
      expect.objectContaining({
        action: 'modify',
        elemIDs: {
          before: before.elemID.createNestedID('list', '2'),
          after: before.elemID.createNestedID('list', '1'),
        },
      }),
    ])
    const filteredChanges = getIndependentChanges(detailedChanges)
    expect(filteredChanges).toHaveLength(detailedChanges.length - 1)
    expect(filteredChanges).toEqual(
      detailedChanges.filter(
        change => !change.elemIDs?.after?.isEqual(before.elemID.createNestedID('list', '1', 'innerList', '2')),
      ),
    )
  })
})

describe('getRelevantNamesFromChange', () => {
  const instType = new ObjectType({ elemID: new ElemID('salto', 'obj') })
  const objectWithFields = new ObjectType({
    elemID: new ElemID('test', 'obj2'),
    fields: {
      fieldOne: {
        refType: BuiltinTypes.STRING,
      },
      fieldTwo: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const instance1 = new InstanceElement('inst1', instType, {})
  it('should get relevant name for instance', () => {
    expect(getRelevantNamesFromChange(toChange({ after: instance1 }))).toEqual(['salto.obj.instance.inst1'])
  })
  it('should get relevant name for object without fields', () => {
    expect(getRelevantNamesFromChange(toChange({ after: instType }))).toEqual(['salto.obj'])
  })
  it('should get relevant name for object with fields', () => {
    expect(getRelevantNamesFromChange(toChange({ before: objectWithFields }))).toEqual([
      'test.obj2',
      'test.obj2.field.fieldOne',
      'test.obj2.field.fieldTwo',
    ])
  })
})
