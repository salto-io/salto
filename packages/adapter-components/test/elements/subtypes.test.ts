/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, ListType, MapType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getSubtypes } from '../../src/elements/subtypes'

describe('getSubtypes', () => {
  it('should return the expected subtypes', async () => {
    const typeA = new ObjectType({ elemID: new ElemID('adapter', 'A') })
    const typeB = new ObjectType({ elemID: new ElemID('adapter', 'B') })
    const typeC = new ObjectType({
      elemID: new ElemID('adapter', 'C'),
      fields: {
        b: { refType: typeB },
        a: { refType: new MapType(typeA) },
      },
    })
    const typeD = new ObjectType({
      elemID: new ElemID('adapter', 'D'),
      fields: {
        c: { refType: new ListType(typeC) },
      },
    })
    const typeE = new ObjectType({ elemID: new ElemID('adapter', 'E') })
    const typeF = new ObjectType({
      elemID: new ElemID('adapter', 'F'),
      fields: {
        d: { refType: typeD },
        e: { refType: typeE },
      },
    })

    const subtypes = await getSubtypes([typeD, typeF])
    expect(_.sortBy(subtypes, type => type.elemID.name)).toEqual([typeA, typeB, typeC, typeE])
  })
})
