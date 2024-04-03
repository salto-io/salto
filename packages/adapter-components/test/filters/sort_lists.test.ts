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
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { sortListsFilterCreator } from '../../src/filters'
import { FilterWith } from '../../src/filter_utils'
import { ApiDefinitions } from '../../src/definitions'
import { ADAPTER_NAME } from '@salto-io/serviceplaceholder-adapter/dist/src/constants'

describe('sort lists filter', () => {
  it('should do something', async () => {
    const filter = sortListsFilterCreator()({
      definitions: {
        fetch: {
          instances: {
            customizations: {
              t1: {
                element: {
                  fieldCustomizations: {
                    field1: {
                      sort: { sortByProperties: ['prop1', 'prop2'] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }) as FilterWith<'onFetch'>
    const objType = new ObjectType({
      elemID: new ElemID('adapter', 't1'),
      fields: { field1: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
    })
    const instance1 = new InstanceElement('inst1', objType, {
      field1: [
        { prop1: 2, prop2: 0 },
        { prop1: 1, prop2: 0 },
      ],
    })
    const instance2 = new InstanceElement('inst2', objType, {
      field1: [
        { prop1: 1, prop2: 2 },
        { prop1: 1, prop2: 1 },
      ],
    })
    const elements = [instance1, instance2]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(2)
    expect(elements[0].value).toEqual({
      field1: [
        { prop1: 1, prop2: 0 },
        { prop1: 2, prop2: 0 },
      ],
    })
    expect(elements[1].value).toEqual({
      field1: [
        { prop1: 1, prop2: 1 },
        { prop1: 1, prop2: 2 },
      ],
    })
  })
})
