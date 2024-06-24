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

import { ObjectType, ElemID, toChange } from '@salto-io/adapter-api'
import { reverseChange } from '../src/change'

describe('reverseChange', () => {
  let type: ObjectType

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID('test', 'type') })
  })

  it('should reverse addition change', () => {
    const change = toChange({ after: type })
    expect(reverseChange(change)).toEqual(toChange({ before: type }))
  })

  it('should reverse removal change', () => {
    const change = toChange({ before: type })
    expect(reverseChange(change)).toEqual(toChange({ after: type }))
  })

  it('should reverse modification change', () => {
    const type2 = type.clone()
    type2.annotations.test = 'test'
    const change = toChange({ before: type, after: type2 })
    expect(reverseChange(change)).toEqual(toChange({ before: type2, after: type }))
  })
})
