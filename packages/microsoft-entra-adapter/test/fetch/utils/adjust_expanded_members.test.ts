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

import { ODATA_TYPE_FIELD } from '../../../src/constants'
import { adjustEntitiesWithExpandedMembers } from '../../../src/definitions/fetch/utils'

describe(`${adjustEntitiesWithExpandedMembers.name}`, () => {
  it('should throw an error when value is not an object', () => {
    expect(() =>
      adjustEntitiesWithExpandedMembers({ value: 'not an object', typeName: 'typeName', context: {} }),
    ).toThrow()
  })

  it('should throw an error when members is not an array', () => {
    expect(() =>
      adjustEntitiesWithExpandedMembers({ value: { members: 'not an array' }, typeName: 'typeName', context: {} }),
    ).toThrow()
  })

  it('should not throw an error when members field is missing', () => {
    expect(() => adjustEntitiesWithExpandedMembers({ value: {}, typeName: 'typeName', context: {} })).not.toThrow()
  })

  it('should throw an error when members contains non-object elements', () => {
    expect(() =>
      adjustEntitiesWithExpandedMembers({
        value: { members: ['not an object'] },
        typeName: 'typeName',
        context: {},
      }),
    ).toThrow()
  })

  it('should select only id and ODATA_TYPE_FIELD fields from members', () => {
    const members = [
      { id: 'id1', [ODATA_TYPE_FIELD]: '#microsoft.graph.group', otherField: 'other1' },
      { id: 'id2', [ODATA_TYPE_FIELD]: '#microsoft.graph.group', otherField: 'other2' },
    ]
    const { value } = adjustEntitiesWithExpandedMembers({
      value: { members },
      typeName: 'typeName',
      context: {},
    })
    expect(value.members).toEqual([
      { id: 'id1', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
      { id: 'id2', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
    ])
  })

  it('should filter out members with unsupported ODATA_TYPE_FIELD', () => {
    const members = [
      { id: 'id1', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
      { id: 'id2', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
      { id: 'id3', [ODATA_TYPE_FIELD]: '#microsoft.graph.user' },
    ]
    const { value } = adjustEntitiesWithExpandedMembers({
      value: { members },
      typeName: 'typeName',
      context: {},
    })
    expect(value.members).toEqual([
      { id: 'id1', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
      { id: 'id2', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
    ])
  })
})
