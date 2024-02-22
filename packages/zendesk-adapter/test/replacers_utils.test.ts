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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { TRIGGER_TYPE_NAME, ZENDESK } from '../src/constants'
import { fieldReplacer, replaceConditionsAndActionsCreator } from '../src/replacers_utils'

describe('replacers utils', () => {
  describe('fieldReplacer', () => {
    const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, 'user_segment') })
    const userSegmentInstance1 = new InstanceElement('test', userSegmentType, {
      title: 'test',
      added_user_ids: 1,
      best_user: 2,
    })
    const userSegmentInstance2 = new InstanceElement('test', userSegmentType, {
      title: 'test',
      added_user_ids: [1, 2, 3],
    })
    const userSegmentElemId = new ElemID(ZENDESK, userSegmentType.elemID.typeName, 'instance', 'test')
    const valueReplacerFunc = fieldReplacer(['added_user_ids', 'best_user'])
    it('should return the correct ElemIds', () => {
      const userSegment1 = valueReplacerFunc(userSegmentInstance1)
      const userSegment2 = valueReplacerFunc(userSegmentInstance2)
      expect(userSegment1).toEqual([
        userSegmentElemId.createNestedID('added_user_ids'),
        userSegmentElemId.createNestedID('best_user'),
      ])
      expect(userSegment2).toEqual([
        userSegmentElemId.createNestedID('added_user_ids', '0'),
        userSegmentElemId.createNestedID('added_user_ids', '1'),
        userSegmentElemId.createNestedID('added_user_ids', '2'),
      ])
    })
    it('should replace values based on mapping', () => {
      const usersMapping = Object.fromEntries([
        ['1', 'a'],
        ['2', 'b'],
        ['3', 'c'],
      ])
      valueReplacerFunc(userSegmentInstance1, usersMapping)
      valueReplacerFunc(userSegmentInstance2, usersMapping)
      expect(userSegmentInstance1.value).toEqual({ title: 'test', added_user_ids: 'a', best_user: 'b' })
      expect(userSegmentInstance2.value).toEqual({ title: 'test', added_user_ids: ['a', 'b', 'c'] })
    })

    it('should not replace value if it is missing from mapping', () => {
      const usersMapping = Object.fromEntries([
        ['1', 'a'],
        ['2', 'b'],
        ['3', 'c'],
      ])
      const userSegmentMissingValue = new InstanceElement('test', userSegmentType, {
        title: 'test',
        added_user_ids: [1, 4],
        best_user: 5,
      })
      valueReplacerFunc(userSegmentMissingValue, usersMapping)
      expect(userSegmentMissingValue.value).toEqual({ title: 'test', added_user_ids: ['a', 4], best_user: 5 })
    })
  })

  describe('replaceConditionsAndActionsCreator', () => {
    it('does not handle undefined conditions', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }), {
        conditions: undefined,
      })
      expect(
        replaceConditionsAndActionsCreator([{ fieldName: ['conditions'], fieldsToReplace: [] }])(instance),
      ).toEqual([])
    })

    it('does not handle fields not in the params', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }), {
        conditions: {
          field: 'cannotFind',
          value: 'do not return me',
        },
      })
      expect(
        replaceConditionsAndActionsCreator([{ fieldName: ['conditions'], fieldsToReplace: [{ name: 'wrongField' }] }])(
          instance,
        ),
      ).toEqual([])
    })

    it('returns the paths of fields to change', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }), {
        conditions: [
          {
            field: 'test',
            value: 'return me',
          },
        ],
      })
      expect(
        replaceConditionsAndActionsCreator([{ fieldName: ['conditions'], fieldsToReplace: [{ name: 'test' }] }])(
          instance,
        ),
      ).toEqual([instance.elemID.createNestedID('conditions', '0', 'value')])
    })

    it("does not return the path if the object's value is undefined", () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }), {
        conditions: [
          {
            field: 'test',
            value: undefined,
          },
        ],
      })
      expect(
        replaceConditionsAndActionsCreator([{ fieldName: ['conditions'], fieldsToReplace: [{ name: 'test' }] }])(
          instance,
        ),
      ).toEqual([])
    })

    it('replaces according to the mapping if given', () => {
      const mapping = { 2: 'b' }
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }), {
        conditions: [
          {
            field: 'test',
            value: 2,
          },
        ],
      })
      expect(
        replaceConditionsAndActionsCreator([{ fieldName: ['conditions'], fieldsToReplace: [{ name: 'test' }] }])(
          instance,
          mapping,
        ),
      ).toEqual([instance.elemID.createNestedID('conditions', '0', 'value')])
      expect(instance.value).toEqual({
        conditions: [
          {
            field: 'test',
            value: 'b',
          },
        ],
      })
    })

    it('does not replace if mapping value is undefined', () => {
      const mapping = {}
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }), {
        conditions: [
          {
            field: 'test',
            value: 2,
          },
        ],
      })
      expect(
        replaceConditionsAndActionsCreator([{ fieldName: ['conditions'], fieldsToReplace: [{ name: 'test' }] }])(
          instance,
          mapping,
        ),
      ).toEqual([instance.elemID.createNestedID('conditions', '0', 'value')])
      expect(instance.value).toEqual({
        conditions: [
          {
            field: 'test',
            value: 2,
          },
        ],
      })
    })

    it('returns the path ending with the given valuePath instead of the default value', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }), {
        conditions: [
          {
            field: 'test',
            value: 'do not return me',
            newPath: 'return me!',
          },
        ],
      })
      expect(
        replaceConditionsAndActionsCreator([
          { fieldName: ['conditions'], fieldsToReplace: [{ name: 'test', valuePath: ['newPath'] }] },
        ])(instance),
      ).toEqual([instance.elemID.createNestedID('conditions', '0', 'newPath')])
    })

    it('disregards the fieldsToReplace as a filter, and filters only according to the given overrideFilterCriteria', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }), {
        conditions: [
          {
            field: 'test',
            value: 'return me',
            specialField: 'found',
          },
        ],
      })
      const overrideFilterCriterion = (condition: unknown): boolean =>
        (condition as { specialField: string }).specialField === 'found'
      expect(
        replaceConditionsAndActionsCreator([
          {
            fieldName: ['conditions'],
            fieldsToReplace: [{ name: 'notTest' }],
            overrideFilterCriteria: [overrideFilterCriterion],
          },
        ])(instance),
      ).toEqual([instance.elemID.createNestedID('conditions', '0', 'value')])
    })
  })
})
