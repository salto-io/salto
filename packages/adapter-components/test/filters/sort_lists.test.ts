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
  const objType = new ObjectType({
    elemID: new ElemID('adapter', 't1'),
    fields: { field1: { refType: new ListType(BuiltinTypes.UNKNOWN) } },
  })

  it('should sort simple fields with precedence, handle multiple elements and directions', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: {
          sort: { properties: [{ path: 'prop1' }, { path: 'prop2', order: 'desc' }] },
        },
      }),
    ) as FilterWith<'onFetch'>
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
        { prop1: 1, prop2: 2 },
        { prop1: 1, prop2: 1 },
        { prop1: 2, prop2: 2 },
        { prop1: 2, prop2: 1 },
      ],
    })
  })

  it('should sort fields with nested paths and ignore properties not specified to sort by', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { properties: [{ path: 'prop1.prop2' }] } },
      }),
    ) as FilterWith<'onFetch'>
    const instance = new InstanceElement('inst1', objType, {
      field1: [
        { prop1: { prop2: 2 }, prop2: 1 },
        { prop1: { prop2: 1 }, prop2: 1 },
        { prop1: { prop2: 3 }, prop2: 0 },
      ],
    })
    const elements = [instance]
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

  it('should sort fields that contains objects with properties that are instance reference expressions', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { properties: [{ path: 'ref.prop1' }] } },
      }),
    ) as FilterWith<'onFetch'>
    const referencedObjType = new ObjectType({
      elemID: new ElemID('adapter', 't2'),
      fields: { prop1: { refType: BuiltinTypes.NUMBER } },
    })

    const [ref1, ref2, ref3]: ReferenceExpression[] = [1, 2, 3]
      .map(value => new InstanceElement(`ref${value}`, referencedObjType, { prop1: value }))
      .map(instance => new ReferenceExpression(instance.elemID, instance))

    const instance = new InstanceElement('instance', objType, {
      field1: [{ ref: ref2 }, { ref: ref3 }, { ref: ref1 }],
    })

    const elements = [instance]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(1)
    expect(elements[0].value).toEqual({
      field1: [{ ref: ref1 }, { ref: ref2 }, { ref: ref3 }],
    })
  })

  it('should sort fields that are raw lists of instance reference expressions (not wrapped in an object)', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { properties: [{ path: 'prop1' }] } },
      }),
    ) as FilterWith<'onFetch'>
    const referencedObjType = new ObjectType({
      elemID: new ElemID('adapter', 't2'),
      fields: { prop1: { refType: BuiltinTypes.NUMBER } },
    })

    const [ref1, ref2, ref3]: ReferenceExpression[] = [1, 2, 3]
      .map(value => new InstanceElement(`ref${value}`, referencedObjType, { prop1: value }))
      .map(instance => new ReferenceExpression(instance.elemID, instance))

    const instance = new InstanceElement('instance', objType, {
      field1: [ref2, ref1, ref3],
    })

    const elements = [instance]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(1)
    expect(elements[0].value).toEqual({
      field1: [ref1, ref2, ref3],
    })
  })

  it('should sort fields with reference expressions to inner fields (not top-level instances)', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { properties: [{ path: 'ref.prop1' }] } },
      }),
    ) as FilterWith<'onFetch'>
    const [ref1, ref2, ref3]: ReferenceExpression[] = [1, 2, 3].map(
      value =>
        new ReferenceExpression(ElemID.fromFullName(`adapter.t2.instance.refInst${value}.someField`), { prop1: value }),
    )

    const instance = new InstanceElement('inst1', objType, {
      field1: [{ ref: ref2 }, { ref: ref3 }, { ref: ref1 }],
    })
    const elements = [instance]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(1)
    expect(elements[0].value).toEqual({
      field1: [{ ref: ref1 }, { ref: ref2 }, { ref: ref3 }],
    })
  })

  it('should sort fields with nested instance reference expressions', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { properties: [{ path: 'ref.nestedRef.prop1' }] } },
      }),
    ) as FilterWith<'onFetch'>
    const referencedObjType = new ObjectType({
      elemID: new ElemID('adapter', 't2'),
      fields: { nestedRef: { refType: BuiltinTypes.UNKNOWN } },
    })
    const nestedReferencedObjType = new ObjectType({
      elemID: new ElemID('adapter', 't3'),
      fields: { prop1: { refType: BuiltinTypes.NUMBER } },
    })

    const [ref1, ref2, ref3]: ReferenceExpression[] = [1, 2, 3]
      .map(value => new InstanceElement(`nestedRef${value}`, nestedReferencedObjType, { prop1: value }))
      .map(instance => new ReferenceExpression(instance.elemID, instance))
      .map(
        ref =>
          new InstanceElement(`nestedRef.${ref.value.prop1}`, referencedObjType, {
            nestedRef: new ReferenceExpression(ref.elemID, ref),
          }),
      )
      .map(instance => new ReferenceExpression(instance.elemID, instance))

    const instance = new InstanceElement('instance', objType, {
      field1: [{ ref: ref2 }, { ref: ref3 }, { ref: ref1 }],
    })

    const elements = [instance]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(1)
    expect(elements[0].value).toEqual({
      field1: [{ ref: ref1 }, { ref: ref2 }, { ref: ref3 }],
    })
  })

  it('should sort inner lists if their type has a sort customization', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { properties: [{ path: 'prop1' }] } },
      }),
    ) as FilterWith<'onFetch'>
    const wrappingType = new ObjectType({
      elemID: new ElemID('adapter', 't2'),
      fields: { ref: { refType: new ListType(objType) } },
    })
    const instance = new InstanceElement('inst1', wrappingType, {
      ref: {
        field1: [{ prop1: 2 }, { prop1: 1 }],
      },
    })
    const elements = [instance]
    await filter.onFetch(elements)
    expect(elements).toHaveLength(1)
    expect(elements[0].value).toEqual({
      ref: {
        field1: [{ prop1: 1 }, { prop1: 2 }],
      },
    })
  })

  it('should disallow sorting by a reference (require a property of the referenced element)', async () => {
    const filter = sortListsFilterCreator()(
      makeDefinitions({
        field1: { sort: { properties: [{ path: 'ref' }] } },
      }),
    ) as FilterWith<'onFetch'>
    const instance = new InstanceElement('inst1', objType, {
      field1: [{ ref: new ReferenceExpression(new ElemID('adapter', 't2'), { prop1: 2 }) }],
    })
    const elements = [instance]
    await expect(filter.onFetch(elements)).rejects.toThrow()
  })
})
