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

import {
  isField,
} from '../src/utils'
import {
  Field, ObjectType,
} from '../src/elements'
import {
  ElemID,
} from '../src/element_id'
import {
  BuiltinTypes,
} from '../src/builtins'

describe('Test utils.ts', () => {
  describe('isField func', () => {
    const mockElemID = new ElemID('test-utils', 'obj')
    const mockField = new Field(mockElemID, 'num_field', BuiltinTypes.NUMBER)

    const mockObjectType = new ObjectType({
      elemID: mockElemID,
      fields: {
        fieldTest: mockField,
      },
      annotationTypes: {},
      annotations: {},
    })

    it('should return false for undefined', () => {
      expect(isField(undefined)).toEqual(false)
    })
    it('should return false for string', () => {
      expect(isField('str')).toEqual(false)
    })

    it('should return false for object', () => {
      expect(isField(mockObjectType)).toEqual(false)
    })

    it('should return true for field', () => {
      expect(isField(mockField)).toEqual(true)
    })
  })
})
