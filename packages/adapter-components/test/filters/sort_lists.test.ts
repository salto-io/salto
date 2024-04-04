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
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { sortListsFilterCreator } from '../../src/filters'
import { FilterWith } from '../../src/filter_utils'
import { ApiDefinitions } from '../../src/definitions'
import { ElementFieldCustomization } from '../../src/definitions/system/fetch'

const makeDefinitions = <TOptions>(
  fieldCustomizations: Record<string, ElementFieldCustomization>,
): { definitions: Pick<ApiDefinitions<TOptions>, 'fetch'> } => ({
  definitions: {
    fetch: {
      instances: {
        customizations: {
          t1: {
            element: {
              fieldCustomizations,
            },
          },
        },
      },
    },
  },
})

describe('sort lists filter', () => {
  it('should sort simple fields, handle multiple elements', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { sortByProperties: ['prop1', 'prop2'] } },
      }),
    ) as FilterWith<'onFetch'>
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
        { prop1: 2, prop2: 1 },
        { prop1: 1, prop2: 1 },
        { prop1: 2, prop2: 2 },
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
        { prop1: 2, prop2: 1 },
        { prop1: 2, prop2: 2 },
      ],
    })
  })

  it('should sort fields with nested paths and ignore other properties', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { sortByProperties: ['prop1.prop2'] } },
      }),
    ) as FilterWith<'onFetch'>
    const objType = new ObjectType({
      elemID: new ElemID('adapter', 't1'),
      fields: { field1: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
    })
    const instance1 = new InstanceElement('inst1', objType, {
      field1: [
        { prop1: { prop2: 2 }, prop2: 1 },
        { prop1: { prop2: 1 }, prop2: 1 },
        { prop1: { prop2: 3 }, prop2: 0 },
      ],
    })
    const elements = [instance1]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(1)
    expect(elements[0].value).toEqual({
      field1: [
        { prop1: { prop2: 1 }, prop2: 1 },
        { prop1: { prop2: 2 }, prop2: 1 },
        { prop1: { prop2: 3 }, prop2: 0 },
      ],
    })
  })

  it('should sort fields with reference expressions', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { sortByProperties: ['ref.prop1'] } },
      }),
    ) as FilterWith<'onFetch'>
    const mainObjType = new ObjectType({
      elemID: new ElemID('adapter', 't1'),
      fields: { field1: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
    })
    const instance1 = new InstanceElement('inst1', mainObjType, {
      field1: [
        { ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst1'), { prop1: 2 }) },
        { ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst2'), { prop1: 3 }) },
        { ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst3'), { prop1: 1 }) },
      ],
    })
    const elements = [instance1]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(1)
    expect(elements[0].value).toEqual({
      field1: [
        { ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst3'), { prop1: 1 }) },
        { ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst1'), { prop1: 2 }) },
        { ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst2'), { prop1: 3 }) },
      ],
    })
  })

  it('should sort fields with nested reference expressions', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { sortByProperties: ['ref.ref2.prop'] } },
      }),
    ) as FilterWith<'onFetch'>
    const mainObjType = new ObjectType({
      elemID: new ElemID('adapter', 't1'),
      fields: { field1: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
    })
    const instance1 = new InstanceElement('inst1', mainObjType, {
      field1: [
        {
          ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst1'),
            { ref2: new ReferenceExpression(new ElemID('adapter', 't3', 'ref2inst1'), { prop: 2 }) }),
        },
        {
          ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst2'),
            { ref2: new ReferenceExpression(new ElemID('adapter', 't3', 'ref2inst2'), { prop: 3 }) }),
        },
        {
          ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst3'),
            { ref2: new ReferenceExpression(new ElemID('adapter', 't3', 'ref2inst3'), { prop: 1 }) }),
        },
      ],
    })
    const elements = [instance1]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(1)
    expect(elements[0].value).toEqual({
      field1: [
        {
          ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst3'),
            { ref2: new ReferenceExpression(new ElemID('adapter', 't3', 'ref2inst3'), { prop: 1 }) }),
        },
        {
          ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst1'),
            { ref2: new ReferenceExpression(new ElemID('adapter', 't3', 'ref2inst1'), { prop: 2 }) }),
        },
        {
          ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst2'),
            { ref2: new ReferenceExpression(new ElemID('adapter', 't3', 'ref2inst2'), { prop: 3 }) }),
        },
      ],
    })
  })

  it('should sort inner lists if their type has a sort customization', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { sortByProperties: ['prop1'] } },
      }),
    ) as FilterWith<'onFetch'>
    const mainObjType = new ObjectType({
      elemID: new ElemID('adapter', 't1'),
      fields: { field1: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
    })
    const wrappingType = new ObjectType({
      elemID: new ElemID('adapter', 't2'),
      fields: { ref: { refType: new ListType(mainObjType)} },
    })
    const instance1 = new InstanceElement('inst1', wrappingType, {
      ref: {
        field1: [
          { prop1: 2 },
          { prop1: 1 },
        ],
      }
    })
    const elements = [instance1]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(1)
    expect(elements[0].value).toEqual({
      ref: {
      field1: [
        { prop1: 1 },
        { prop1: 2 },
      ],
    }})
  })

  it('should not allow to sort by a reference (require a property of the referenced element)', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { sortByProperties: ['ref'] } },
      }),
    ) as FilterWith<'onFetch'>
    const mainObjType = new ObjectType({
      elemID: new ElemID('adapter', 't1'),
      fields: { field1: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
    })
    const instance1 = new InstanceElement('inst1', mainObjType, {
      field1: [
        { ref: new ReferenceExpression(new ElemID('adapter', 't2', 'refinst1'), { prop1: 2 }) },
      ],
    })
    const elements = [instance1]
    await expect(filter.onFetch(elements)).rejects.toThrow()
  })
})
