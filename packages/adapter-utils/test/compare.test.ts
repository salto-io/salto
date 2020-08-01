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
import { ObjectType, ElemID, InstanceElement, DetailedChange, PrimitiveType, BuiltinTypes, PrimitiveTypes, Field } from '@salto-io/adapter-api'
import _ from 'lodash'
import { detailedCompare } from '../src/compare'

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
      }
    )
    const after = new InstanceElement(
      'inst',
      instType,
      {
        after: 'Before',
        modify: 'After',
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
  })

  describe('compare primitive types', () => {
    const before = new PrimitiveType({
      elemID: new ElemID('salto', 'prim'),
      annotationTypes: {
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
      annotationTypes: {
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
      annotationTypes: {
        before: BuiltinTypes.STRING,
        modify: BuiltinTypes.STRING,
      },
      annotations: {
        before: 'Before',
        modify: 'Before',
      },
      fields: {
        before: {
          type: BuiltinTypes.STRING,
          annotations: {
            before: 'Before',
            modify: 'Before',
          },
        },
        modify: {
          type: BuiltinTypes.STRING,
          annotations: {
            before: 'Before',
            modify: 'Before',
          },
        },
      },
    })
    const after = new ObjectType({
      elemID: new ElemID('salto', 'obj'),
      annotationTypes: {
        after: BuiltinTypes.STRING,
        modify: BuiltinTypes.NUMBER,
      },
      annotations: {
        after: 'After',
        modify: 1,
      },
      fields: {
        after: {
          type: BuiltinTypes.STRING,
          annotations: {
            before: 'After',
            modify: 'After',
          },
        },
        modify: {
          type: BuiltinTypes.STRING,
          annotations: {
            after: 'After',
            modify: 'After',
          },
        },
      },
    })

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
