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
} from '@salto-io/adapter-api'
import { detailedCompare, applyDetailedChanges, calculateChangesHash, getRelevantNamesFromChange } from '../src/compare'

describe('detailedCompare', () => {
  const hasChange = (changes: DetailedChange[], action: string, id: ElemID): boolean => (
    changes.find(change => change.action === action
            && _.isEqual(change.id, id)) !== undefined
  )
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
      }
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
      }
    )
    const changes = detailedCompare(before, after)
    it('should create add changes for values that were only present in the after instance', () => {
      expect(hasChange(changes, 'add', after.elemID.createNestedID('after')))
        .toBeTruthy()
    })
    it('should create remove changes for values that were only present in the before instance', () => {
      expect(hasChange(changes, 'remove', before.elemID.createNestedID('before')))
        .toBeTruthy()
    })
    it('should create modify changes for values that were only present both instances', () => {
      expect(hasChange(changes, 'modify', before.elemID.createNestedID('modify')))
        .toBeTruthy()
    })
    it('should create add changes for new annotation values', () => {
      expect(
        hasChange(changes, 'add', after.elemID.createNestedID(INSTANCE_ANNOTATIONS.GENERATED_DEPENDENCIES))
      ).toBeTruthy()
    })
    it('should create modify changes for changed annotation values', () => {
      expect(
        hasChange(changes, 'modify', after.elemID.createNestedID(INSTANCE_ANNOTATIONS.SERVICE_URL))
      ).toBeTruthy()
    })
    it('should create remove changes for removed annotation values', () => {
      expect(
        hasChange(changes, 'remove', before.elemID.createNestedID(INSTANCE_ANNOTATIONS.HIDDEN))
      ).toBeTruthy()
    })
    describe('compare lists with compareListItems', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let listID: ElemID

      beforeEach(() => {
        beforeInst = new InstanceElement('inst', instType, { list: [] })
        afterInst = new InstanceElement('inst', instType, { list: [] })
        listID = beforeInst.elemID.createNestedID('list')
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
          },
          {
            id: listID.createNestedID('2'),
            data: { before: 'c', after: 'c' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('2'),
              after: listID.createNestedID('1'),
            },
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
          },
          {
            id: listID.createNestedID('2'),
            data: { before: 'c', after: 'c' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('1'),
              after: listID.createNestedID('2'),
            },
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
          },
          {
            id: listID.createNestedID('1'),
            data: { before: 'b' },
            action: 'remove',
            elemIDs: {
              before: listID.createNestedID('1'),
            },
          },
          {
            id: listID.createNestedID('2'),
            data: { before: 'a', after: 'a' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('0'),
              after: listID.createNestedID('1'),
            },
          },
          {
            id: listID.createNestedID('3'),
            data: { before: 'f', after: 'd' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('2'),
              after: listID.createNestedID('2'),
            },
          },
          {
            id: listID.createNestedID('4'),
            data: { after: 'g' },
            action: 'add',
            elemIDs: {
              after: listID.createNestedID('3'),
            },
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
          },
          {
            id: listID.createNestedID('1'),
            data: { before: 'a', after: 'a' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('0'),
              after: listID.createNestedID('1'),
            },
          },
          {
            id: listID.createNestedID('2'),
            data: { before: 'b', after: 'd' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('1'),
              after: listID.createNestedID('2'),
            },
          },
          {
            id: listID.createNestedID('3'),
            data: { before: 'e', after: 'e' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('2'),
              after: listID.createNestedID('3'),
            },
          },
          {
            id: listID.createNestedID('4'),
            data: { before: 'f', after: 'g' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('3'),
              after: listID.createNestedID('4'),
            },
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
          },
          {
            id: listID.createNestedID('1'),
            data: { before: 'a', after: 'a' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('1'),
              after: listID.createNestedID('0'),
            },
          },
          {
            id: listID.createNestedID('2'),
            data: { after: 'd' },
            action: 'add',
            elemIDs: {
              after: listID.createNestedID('1'),
            },
          },
          {
            id: listID.createNestedID('3'),
            data: { before: 'e' },
            action: 'remove',
            elemIDs: {
              before: listID.createNestedID('3'),
            },
          },
          {
            id: listID.createNestedID('4'),
            data: { before: 'b', after: 'h' },
            action: 'modify',
            elemIDs: {
              before: listID.createNestedID('2'),
              after: listID.createNestedID('2'),
            },
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
          },
          {
            id: listID.createNestedID('2'),
            data: { before: {} },
            action: 'remove',
            elemIDs: {
              before: listID.createNestedID('2'),
            },
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
    it('should create add changes for values that were only present in the after type', () => {
      expect(hasChange(
        changes,
        'add',
        after.elemID.createNestedID('annotation', 'after')
      )).toBeTruthy()
      expect(hasChange(
        changes,
        'add',
        after.elemID.createNestedID('attr', 'after')
      )).toBeTruthy()
    })
    it('should create remove changes for values that were only present in the before type', () => {
      expect(hasChange(
        changes,
        'remove',
        after.elemID.createNestedID('annotation', 'before')
      )).toBeTruthy()
      expect(hasChange(
        changes,
        'remove',
        after.elemID.createNestedID('attr', 'before')
      )).toBeTruthy()
    })
    it('should create modify changes for values that were only present both types', () => {
      expect(hasChange(
        changes,
        'modify',
        after.elemID.createNestedID('annotation', 'modify')
      )).toBeTruthy()
      expect(hasChange(
        changes,
        'modify',
        after.elemID.createNestedID('attr', 'modify')
      )).toBeTruthy()
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
      it('should create add changes for values that were only present in the after object', () => {
        expect(hasChange(
          changes,
          'add',
          after.elemID.createNestedID('annotation', 'after')
        )).toBeTruthy()
        expect(hasChange(
          changes,
          'add',
          after.elemID.createNestedID('attr', 'after')
        )).toBeTruthy()
      })
      it('should create remove changes for values that were only present in the before object', () => {
        expect(hasChange(
          changes,
          'remove',
          after.elemID.createNestedID('annotation', 'before')
        )).toBeTruthy()
        expect(hasChange(
          changes,
          'remove',
          after.elemID.createNestedID('attr', 'before')
        )).toBeTruthy()
      })
      it('should create modify changes for values that were only present both objects', () => {
        expect(hasChange(
          changes,
          'modify',
          after.elemID.createNestedID('annotation', 'modify')
        )).toBeTruthy()
        expect(hasChange(
          changes,
          'modify',
          after.elemID.createNestedID('attr', 'modify')
        )).toBeTruthy()
      })
    })
    describe('with field changes', () => {
      const changes = detailedCompare(before, after, { createFieldChanges: true })
      it('should identify field changes, and create changes with the field id', () => {
        expect(hasChange(
          changes,
          'modify',
          after.fields.modify.elemID.createNestedID('modify')
        )).toBeTruthy()
        expect(hasChange(
          changes,
          'add',
          after.fields.after.elemID
        )).toBeTruthy()
        expect(hasChange(
          changes,
          'remove',
          before.fields.before.elemID
        )).toBeTruthy()
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
    it('should create add changes for values that were only present in the after field', () => {
      expect(hasChange(
        changes,
        'add',
        after.elemID.createNestedID('after')
      )).toBeTruthy()
    })
    it('should create remove changes for values that were only present in the before field', () => {
      expect(hasChange(
        changes,
        'remove',
        after.elemID.createNestedID('before')
      )).toBeTruthy()
    })
    it('should create modify changes for values that were only present both fields', () => {
      expect(hasChange(
        changes,
        'modify',
        after.elemID.createNestedID('modify')
      )).toBeTruthy()
    })
  })
})

describe('applyDetailedChanges', () => {
  let inst: InstanceElement
  beforeAll(() => {
    const instType = new ObjectType({ elemID: new ElemID('test', 'test') })
    inst = new InstanceElement(
      'test',
      instType,
      { val: 1, rem: 0, nested: { mod: 1 } },
    )
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
    ]
    applyDetailedChanges(inst, changes)
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
  describe('with changes from compareListItems', () => {
    describe('with list removals', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement('inst', instType, { a: ['c', 'a', 'd', 'e'] })
        afterInst = new InstanceElement('inst', instType, { a: ['a', 'b'] })
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
        applyDetailedChanges(outputInst, listChanges)
      })
      it('should reproduce the after element', () => {
        expect(outputInst).toEqual(afterInst)
      })
    })
    describe('with list additions', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement('inst', instType, { a: ['e', 'b', 'a'] })
        afterInst = new InstanceElement('inst', instType, { a: ['a', 'f', 'f', 'b', 'c', 'd'] })
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
        applyDetailedChanges(outputInst, listChanges)
      })
      it('should reproduce the after element', () => {
        expect(outputInst).toEqual(afterInst)
      })
    })

    describe('with list reorder', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement('inst', instType, { a: ['a', 'b'] })
        afterInst = new InstanceElement('inst', instType, { a: ['b', 'a'] })
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
        applyDetailedChanges(outputInst, listChanges)
      })
      it('should reproduce the after element', () => {
        expect(outputInst).toEqual(afterInst)
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
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement(
          'inst',
          instType,
          {
            a: [
              { a: 2 },
              { ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 1) },
              { a: 2, b: 3 },
            ],
          }
        )

        afterInst = new InstanceElement(
          'inst',
          instType,
          {
            a: [
              { ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 2) },
              { a: 2, b: 4 },
              { a: 4 },
            ],
          }
        )
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
        applyDetailedChanges(outputInst, listChanges)
      })
      it('should apply the changes', () => {
        expect(outputInst.value.a).toEqual(afterInst.value.a)
      })
    })

    describe('When inner list', () => {
      let beforeInst: InstanceElement
      let afterInst: InstanceElement
      let outputInst: InstanceElement
      beforeEach(() => {
        const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
        beforeInst = new InstanceElement(
          'inst',
          instType,
          {
            a: [
              { b: [2, 3] },
            ],
          }
        )

        afterInst = new InstanceElement(
          'inst',
          instType,
          {
            a: [
              { b: [2] },
            ],
          }
        )
        const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
        outputInst = beforeInst.clone()
        applyDetailedChanges(outputInst, listChanges)
      })
      it('should apply the changes', () => {
        expect(outputInst.value.a).toEqual(afterInst.value.a)
      })
    })
  })
  describe('When list objects and reorder and modification on the same item', () => {
    let beforeInst: InstanceElement
    let afterInst: InstanceElement
    let outputInst: InstanceElement
    beforeEach(() => {
      const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
      beforeInst = new InstanceElement(
        'inst',
        instType,
        {
          a: [
            { ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 1) },
            { a: 3 },
          ],
        }
      )

      afterInst = new InstanceElement(
        'inst',
        instType,
        {
          a: [
            { a: 2, b: 5 },
            { ref: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'other', 'a'), 2) },
            { a: 2, b: 4 },
          ],
        }
      )
      const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
      outputInst = beforeInst.clone()
      applyDetailedChanges(outputInst, listChanges)
    })
    it('should apply the changes', () => {
      expect(outputInst.value.a).toEqual(afterInst.value.a)
    })
  })

  describe('When there is object with number as keys', () => {
    let beforeInst: InstanceElement
    let afterInst: InstanceElement
    let outputInst: InstanceElement
    beforeEach(() => {
      const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
      beforeInst = new InstanceElement(
        'inst',
        instType,
        {
          a: {
            1: 'a',
            2: 'b',
          },
        }
      )

      afterInst = new InstanceElement(
        'inst',
        instType,
        {
          a: {
            1: 'b',
            2: 'a',
          },
        }
      )
      const listChanges = detailedCompare(beforeInst, afterInst, { compareListItems: true })
      outputInst = beforeInst.clone()
      applyDetailedChanges(outputInst, listChanges)
    })
    it('should apply the changes', () => {
      expect(outputInst.value.a).toEqual(afterInst.value.a)
    })
  })

  describe('Should apply changes in the correct order', () => {
    let beforeInst: InstanceElement
    beforeEach(() => {
      const instType = new ObjectType({ elemID: new ElemID('test', 'type') })
      beforeInst = new InstanceElement(
        'inst',
        instType,
        {
          a: _.times(11),
        }
      )

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
        beforeInst = new InstanceElement(
          'name1',
          new ObjectType({ elemID: new ElemID('test', 'type') }),
          { val1: '1' },
        )
        afterInst = new InstanceElement(
          'name2',
          new ObjectType({ elemID: new ElemID('test', 'type') }),
          { val1: '2' },
        )
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
})

describe('calculateChangesHash', () => {
  const HASH_VALUE = '797c4b04aec0e7a2605a7a76eea686a4'
  const instType = new ObjectType({
    elemID: new ElemID('salto', 'obj'),
  })
  const instance1 = new InstanceElement(
    'inst1',
    instType,
    {
      field: 'value',
    },
    undefined,
  )
  const instance2 = new InstanceElement(
    'inst2',
    instType,
    {
      field: 'value',
    },
    undefined,
  )
  const changes = [toChange({ after: instance1 }), toChange({ before: instance2 })]
  it('should calculate the changes hash', () => {
    expect(calculateChangesHash(changes)).toEqual(HASH_VALUE)
  })
  it('should calculate same hash for the same changes in different order', () => {
    expect(calculateChangesHash(changes)).toEqual(
      calculateChangesHash([toChange({ before: instance2 }), toChange({ after: instance1 })])
    )
  })
  it('should calculate different hash for the different changes', () => {
    expect(calculateChangesHash(changes)).not.toEqual(calculateChangesHash([toChange({ after: instance1 })]))
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
    expect(getRelevantNamesFromChange(toChange({ before: objectWithFields }))).toEqual(
      ['test.obj2', 'test.obj2.field.fieldOne', 'test.obj2.field.fieldTwo']
    )
  })
})
