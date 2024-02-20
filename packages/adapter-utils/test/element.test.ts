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
import { ElemID, BuiltinTypes, ObjectType, ListType, MapType } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '../src/element'

describe('createMatchingObjectType', () => {
  it('should enforce correct field name and type', () => {
    type InnerType = {
      inner: boolean
    }
    type Test = {
      str: string
      obj: InnerType
      lst: number[]
      objLst: InnerType[]
      numMap: Record<string, number>
    }
    const innerType = createMatchingObjectType<InnerType>({
      elemID: new ElemID('inner'),
      fields: {
        inner: { refType: BuiltinTypes.BOOLEAN, annotations: { _required: true } },
      },
    })
    expect(
      createMatchingObjectType<Test>({
        elemID: new ElemID('test'),
        fields: {
          str: { refType: BuiltinTypes.STRING, annotations: { _required: true } },
          // enforced to be ObjectType, no enforcement on inner fields here
          obj: { refType: innerType, annotations: { _required: true } },
          lst: { refType: new ListType(BuiltinTypes.NUMBER), annotations: { _required: true } },
          objLst: { refType: new ListType(innerType), annotations: { _required: true } },
          numMap: { refType: new MapType(BuiltinTypes.NUMBER), annotations: { _required: true } },
        },
      }),
    ).toBeInstanceOf(ObjectType)
  })
  it('should enforce _required annotation value', () => {
    type Test = {
      a: string
      b?: string
      c?: string
      d?: string
    }
    // For fields that are not required the _required annotation is not mandatory
    // so it is possible to have no annotations, annotations without required and required false
    expect(
      createMatchingObjectType<Test>({
        elemID: new ElemID('test'),
        fields: {
          a: { refType: BuiltinTypes.STRING, annotations: { _required: true } },
          b: { refType: BuiltinTypes.STRING, annotations: { _required: false } },
          c: { refType: BuiltinTypes.STRING, annotations: {} },
          d: { refType: BuiltinTypes.STRING },
        },
      }),
    ).toBeInstanceOf(ObjectType)
  })
})
