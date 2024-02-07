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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createElementQuery, ElementQuery } from '../../../src/fetch/query'

describe('query', () => {
  describe('createElementQuery', () => {
    let query: ElementQuery
    let inst: InstanceElement

    beforeEach(() => {
      query = createElementQuery(
        {
          include: [
            {
              type: 'type1.*',
            },
          ],
          exclude: [
            {
              type: 'type12.*',
            },
          ],
        },
      )

      inst = new InstanceElement(
        'instance',
        new ObjectType({ elemID: new ElemID('adapter', 'type11') }),
        {},
      )
    })

    it('isTypeMatch should return true if the type matches the include but not the exclude', () => {
      expect(query.isTypeMatch('type11')).toBeTruthy()
    })

    it('isTypeMatch should return false if the type matches the include and the exclude', () => {
      expect(query.isTypeMatch('type12')).toBeFalsy()
    })

    it('isTypeMatch should return false if the type does not match the include', () => {
      expect(query.isTypeMatch('atype11')).toBeFalsy()
    })

    it('isTypeMatch should match if include contain filter', () => {
      query = createElementQuery(
        {
          include: [
            {
              type: 'type1.*',
              criteria: {
                name: 'name1',
              },
            },
          ],
          exclude: [
            {
              type: 'type12.*',
            },
          ],
        },
        {
          name: ({ instance, value }) => instance.value.name === value,
        }
      )
      expect(query.isTypeMatch('type11')).toBeTruthy()
    })

    it('isTypeMatch should match if exclude contain filter', () => {
      query = createElementQuery(
        {
          include: [
            {
              type: 'type1.*',
            },
          ],
          exclude: [
            {
              type: 'type12.*',
              criteria: {
                name: 'name1',
              },
            },
          ],
        },
        {
          name: ({ instance, value }) => instance.value.name === value,
        }
      )
      expect(query.isTypeMatch('type12')).toBeTruthy()
    })

    it('isInstanceMatch should match when there is no filter', () => {
      expect(query.isInstanceMatch(inst)).toBeTruthy()
    })

    it('isInstanceMatch should if include filter match', () => {
      query = createElementQuery(
        {
          include: [
            {
              type: 'type1.*',
              criteria: {
                name: 'name1',
              },
            },
          ],
          exclude: [],
        },
        {
          name: ({ instance, value }) => instance.value.name === value,
        }
      )
      expect(query.isInstanceMatch(inst)).toBeFalsy()
      inst.value.name = 'name1'
      expect(query.isInstanceMatch(inst)).toBeTruthy()
    })

    it('isInstanceMatch should if exclude filter does not match', () => {
      query = createElementQuery(
        {
          include: [
            {
              type: 'type1.*',
            },
          ],
          exclude: [
            {
              type: 'type1.*',
              criteria: {
                name: 'name1',
              },
            },
          ],
        },
        {
          name: ({ instance, value }) => instance.value.name === value,
        }
      )
      expect(query.isInstanceMatch(inst)).toBeTruthy()
      inst.value.name = 'name1'
      expect(query.isInstanceMatch(inst)).toBeFalsy()
    })
  })
})
