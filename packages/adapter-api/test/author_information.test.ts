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
import { ObjectType } from '../src/elements'
import { getAuthorInformation } from '../src/author_information'
import { ElemID } from '../src/element_id'
import { CORE_ANNOTATIONS } from '../src/constants'

describe('author information', () => {
  describe('getAuthorInformation', () => {
    it('should return author information', () => {
      const element = new ObjectType({
        elemID: new ElemID('salto', 'typeName'),
        annotations: {
          [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-18 10:00:00',
          [CORE_ANNOTATIONS.CHANGED_BY]: 'Salto User',
        },
      })
      expect(getAuthorInformation(element)).toEqual({
        changedAt: '2023-03-18 10:00:00',
        changedBy: 'Salto User',
      })
    })
    it('should return only non-empty values', () => {
      const element = new ObjectType({
        elemID: new ElemID('salto', 'typeName'),
        annotations: {
          [CORE_ANNOTATIONS.CHANGED_AT]: '2023-03-18 10:00:00',
        },
      })
      expect(Object.keys(getAuthorInformation(element))).toEqual(['changedAt'])
    })
    it('should return empty object for element with no author information', () => {
      const element = new ObjectType({ elemID: new ElemID('salto', 'typeName') })
      expect(Object.keys(getAuthorInformation(element))).toEqual([])
    })
    it('should return empty object for no element', () => {
      expect(Object.keys(getAuthorInformation(undefined))).toEqual([])
    })
  })
})
