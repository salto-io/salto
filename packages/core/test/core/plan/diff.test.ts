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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { getDiffInstance } from '../../../src/core/plan/diff'

describe('getDiffInstance', () => {
  it('should return different primitive values', () => {
    const before = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      same: 'same',
      different: 'different',
    })

    const after = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      same: 'same',
      different: 'different2',
    })

    expect(getDiffInstance(toChange({ before, after })).value).toEqual({
      different: 'different2',
    })
  })

  it('should returned different objects', () => {
    const before = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      sameObj: {
        same: 'same',
      },
      partiallyDifferentObj: {
        same: 'same',
        different: 'different',
      },
      fullyDifferentObj: {
        different: 'different',
      },
    })

    const after = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      sameObj: {
        same: 'same',
      },
      partiallyDifferentObj: {
        same: 'same',
        different: 'different2',
      },
      fullyDifferentObj: {
        different: 'different2',
      },
    })

    expect(getDiffInstance(toChange({ before, after })).value).toEqual({
      partiallyDifferentObj: {
        different: 'different2',
      },
      fullyDifferentObj: {
        different: 'different2',
      },
    })
  })

  it('should returned different arrays', () => {
    const before = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      sameArray: [1, 2, 3],
      partiallyDifferentArray: [1, 2, 3],
      fullyDifferentArray: [1, 2, 3],
      arrayOfObjects: [
        {
          same: 'same',
          different: 'different',
        },
      ],
    })

    const after = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      sameArray: [1, 2, 3],
      partiallyDifferentArray: [1, 2, 4],
      fullyDifferentArray: [],
      arrayOfObjects: [
        {
          same: 'same',
          different: 'different2',
        },
      ],
    })

    expect(getDiffInstance(toChange({ before, after })).value).toEqual({
      partiallyDifferentArray: [undefined, undefined, 4],
      fullyDifferentArray: [],
      arrayOfObjects: [
        {
          different: 'different2',
        },
      ],
    })
  })

  it('should returned values that only exists in after', () => {
    const before = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      beforeValue: 'value',
    })

    const after = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type') }), {
      afterValue: 'value',
    })

    expect(getDiffInstance(toChange({ before, after })).value).toEqual({
      afterValue: 'value',
    })
  })
})
