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
import { ObjectType, ElemID, CORE_ANNOTATIONS, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FilterWith } from '../../src/filter_utils'
import { createMockQuery } from '../../src/fetch/query'
import { addAliasFilterCreator } from '../../src/filters/add_alias'
import { ApiDefinitions } from '../../src/definitions'

describe('add alias filter', () => {
  type FilterType = FilterWith<'onFetch'>
  const adapter = 'adapter'
  const type1 = 't1'
  const type2 = 't2'
  const type3 = 't3'
  const type4 = 't4'
  const type5 = 't5'
  const objType1 = new ObjectType({ elemID: new ElemID(adapter, type1) })
  const objType2 = new ObjectType({ elemID: new ElemID(adapter, type2) })
  const objType3 = new ObjectType({ elemID: new ElemID(adapter, type3) })
  const objType4 = new ObjectType({ elemID: new ElemID(adapter, type4) })
  const objType5 = new ObjectType({ elemID: new ElemID(adapter, type5) })
  const instType1 = new InstanceElement('inst1', objType1, { title: 'inst1 title', name: 'inst1 name' })
  const instType2 = new InstanceElement('inst2', objType2, { title: 'inst2 title', name: 'inst2 name' })
  const instType3 = new InstanceElement('inst3', objType3, { name: 'inst3 name', title: 'inst3 title' }, undefined, {
    _parent: [new ReferenceExpression(instType2.elemID, instType2)],
  })
  const instType4 = new InstanceElement('inst3', objType4, {
    name: 'inst4 name',
    title: 'inst4 title',
    refField: new ReferenceExpression(instType3.elemID, instType3),
  })
  const instType5 = new InstanceElement('inst5', objType5, { name: 'inst5 name', title: 'inst5 title' })
  let elements: InstanceElement[]
  beforeEach(() => {
    elements = [instType1.clone(), instType2.clone(), instType3.clone(), instType4.clone(), instType5.clone()]
  })

  const createFilter = (definitions: ApiDefinitions): FilterType =>
    addAliasFilterCreator()({
      elementSource: buildElementsSourceFromElements([]),
      fetchQuery: createMockQuery(),
      config: {},
      definitions,
      sharedContext: {},
    }) as FilterType

  describe('when fetch definition is undefined', () => {
    it('should do nothing on fetch', async () => {
      const filter = createFilter({} as ApiDefinitions)
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ])
    })
  })
  describe('when fetch definition is defined', () => {
    const definitions = {
      fetch: {
        instances: {
          customizations: {
            [type1]: {
              element: {
                topLevel: {
                  alias: {
                    aliasComponents: [
                      {
                        fieldName: 'name',
                      },
                    ],
                  },
                },
              },
            },
            [type2]: {
              element: {
                topLevel: {
                  alias: {
                    aliasComponents: [
                      {
                        fieldName: 'title',
                      },
                    ],
                  },
                },
              },
            },
            [type3]: {
              element: {
                topLevel: {
                  alias: {
                    aliasComponents: [
                      {
                        fieldName: '_parent.0',
                        referenceFieldName: '_alias',
                      },
                      {
                        fieldName: 'name',
                      },
                    ],
                    separator: ':',
                  },
                },
              },
            },
            [type4]: {
              element: {
                topLevel: {
                  alias: {
                    aliasComponents: [
                      {
                        fieldName: 'refField',
                        referenceFieldName: '_alias',
                      },
                      {
                        fieldName: 'title',
                      },
                    ],
                    separator: ':',
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as ApiDefinitions
    it('should add aliases correctly', async () => {
      const filter = createFilter(definitions)
      await filter.onFetch(elements)
      expect(elements.map(e => e.annotations[CORE_ANNOTATIONS.ALIAS])).toEqual([
        'inst1 name',
        'inst2 title',
        'inst2 title:inst3 name',
        'inst2 title:inst3 name:inst4 title',
        undefined,
      ])
    })
  })
})
