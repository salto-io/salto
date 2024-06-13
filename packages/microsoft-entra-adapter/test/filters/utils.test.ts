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

import { ElemID, ReferenceExpression } from '@salto-io/adapter-api'
import { mapMemberRefToChangeData } from '../../src/filters/utils'
import { ODATA_ID_FIELD_NACL_CASE, ODATA_TYPE_FIELD_NACL_CASE } from '../../src/constants'

describe(`${mapMemberRefToChangeData}`, () => {
  const idRef = new ReferenceExpression(new ElemID('adapter', 'someType', 'instance'), {
    value: { id: 'id1', displayName: 'name1' },
  })
  const memberRef = {
    id: idRef,
    [ODATA_TYPE_FIELD_NACL_CASE]: 'type1',
  }

  it('should return the correct change data', () => {
    expect(mapMemberRefToChangeData(memberRef)).toEqual({
      id: 'id1',
      name: 'name1_type1',
      [ODATA_ID_FIELD_NACL_CASE]: 'https://graph.microsoft.com/v1.0/groups/id1',
    })
  })

  it('should throw an error when the member reference is not an object', () => {
    expect(() => mapMemberRefToChangeData('not an object')).toThrow()
  })

  it('should throw an error when the member reference is missing the odata type', () => {
    expect(() => mapMemberRefToChangeData({ id: idRef })).toThrow()
  })

  it('should throw an error when the member reference id is not a reference expression', () => {
    expect(() =>
      mapMemberRefToChangeData({ id: 'not a reference expression', [ODATA_TYPE_FIELD_NACL_CASE]: 'type1' }),
    ).toThrow()
  })

  it('should throw an error when the member reference value is not an object', () => {
    expect(() =>
      mapMemberRefToChangeData({
        id: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance'), 'id1'),
        [ODATA_TYPE_FIELD_NACL_CASE]: 'type1',
      }),
    ).toThrow()
  })

  it('should throw an error when the member reference value is missing the id', () => {
    expect(() =>
      mapMemberRefToChangeData({
        id: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance'), { value: {} }),
        [ODATA_TYPE_FIELD_NACL_CASE]: 'type1',
      }),
    ).toThrow()
  })
})
