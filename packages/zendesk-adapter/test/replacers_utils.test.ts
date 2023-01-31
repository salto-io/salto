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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { ZENDESK } from '../src/constants'
import { fieldReplacer } from '../src/replacers_utils'

describe('replacers utils', () => {
  describe('fieldReplacer', () => {
    const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, 'user_segment') })
    const userSegmentInstance1 = new InstanceElement(
      'test',
      userSegmentType,
      { title: 'test', added_user_ids: 1, best_user: 2 }
    )
    const userSegmentInstance2 = new InstanceElement(
      'test',
      userSegmentType,
      { title: 'test', added_user_ids: [1, 2, 3] }
    )
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
      expect(userSegmentInstance1.value).toEqual(
        { title: 'test', added_user_ids: 'a', best_user: 'b' }
      )
      expect(userSegmentInstance2.value).toEqual(
        { title: 'test', added_user_ids: ['a', 'b', 'c'] }
      )
    })

    it('should not replace value if it is missing from mapping', () => {
      const usersMapping = Object.fromEntries([
        ['1', 'a'],
        ['2', 'b'],
        ['3', 'c'],
      ])
      const userSegmentMissingValue = new InstanceElement(
        'test',
        userSegmentType,
        { title: 'test', added_user_ids: [1, 4], best_user: 5 },
      )
      valueReplacerFunc(userSegmentMissingValue, usersMapping)
      expect(userSegmentMissingValue.value).toEqual(
        { title: 'test', added_user_ids: ['a', 4], best_user: 5 }
      )
    })
  })
})
