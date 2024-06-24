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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import removeSelfFilter from '../../src/filters/remove_self'
import { getFilterParams } from '../utils'

describe('removeSelfFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  let type: ObjectType
  beforeEach(async () => {
    filter = removeSelfFilter(getFilterParams({})) as typeof filter

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'someType'),
      fields: {
        self: { refType: BuiltinTypes.STRING },
      },
    })

    instance = new InstanceElement('instance', type, {
      self: 'someSelf',
      obj: {
        self: 'someSelf2',
        other: 'other',
      },
      other: 'other',
    })
  })

  it('should remove self from types', async () => {
    await filter.onFetch([type])
    expect(type.fields.self).toBeUndefined()
  })
  it('should remove self from instanecs', async () => {
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      other: 'other',
      obj: {
        other: 'other',
      },
    })
  })
})
