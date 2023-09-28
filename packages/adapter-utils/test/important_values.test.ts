/*
*                      Copyright 2023 Salto Labs Ltd.
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

import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  Field,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource, ReferenceExpression,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '../src/element_source'
import { getImportantValues } from '../src/important_values'

const userType = new ObjectType({
  elemID: new ElemID('salto', 'user'),
  fields: {
    id: {
      refType: BuiltinTypes.NUMBER,
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
      {
        value: 'label',
        indexed: true,
        highlighted: true,
      },
    ],
  },
})

const obj = new ObjectType({
  elemID: new ElemID('salto', 'obj'),
  fields: {
    active: {
      refType: BuiltinTypes.BOOLEAN,
    },
    name: {
      refType: BuiltinTypes.STRING,
    },
    user: {
      refType: userType,
      annotations: {
        label: 'Active',
      },
    },
  },
  annotations: {
    name: 'test',
    apiName: 123,
    other: 'bla',
    [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
      {
        value: 'name',
        indexed: false,
        highlighted: true,
      },
      {
        value: 'active',
        indexed: true,
        highlighted: false,
      },
      {
        value: 'doesNotExist',
        indexed: true,
        highlighted: true,
      },
    ],
    [CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES]: [
      {
        value: 'name',
        indexed: false,
        highlighted: true,
      },
      {
        value: 'apiName',
        indexed: true,
        highlighted: false,
      },
      {
        value: 'doesNotExist',
        indexed: true,
        highlighted: true,
      },
    ],
  },
})
const inst = new InstanceElement(
  'test inst',
  obj,
  {
    active: true,
    name: 'test inst',
    user: {
      id: 12345,
    },
  }
)


describe('getImportantValues', () => {
  let elementSource: ReadOnlyElementsSource
  beforeEach(() => { elementSource = buildElementsSourceFromElements([obj, userType]) })
  it('should get the right important values for an object type', async () => {
    const res = await getImportantValues({
      element: obj,
      elementSource,
    })
    expect(res).toEqual([
      { name: 'test' },
      { apiName: 123 },
      { doesNotExist: undefined },
    ])
  })
  it('should get the right important values for an instance', async () => {
    const res = await getImportantValues({
      element: inst,
      elementSource,
    })
    expect(res).toEqual([
      { name: 'test inst' },
      { active: true },
      { doesNotExist: undefined },
    ])
  })
  it('should get the right important values for a field', async () => {
    const field = new Field(
      obj,
      'test field',
      userType,
      {
        label: 'Active',
      }
    )
    const res = await getImportantValues({
      element: field,
      elementSource,
      indexedOnly: false,
    })
    expect(res).toEqual([{ label: 'Active' }])
  })
  it('should return an empty object if no important values are defined', async () => {
    const objNoImportant = new ObjectType({
      elemID: new ElemID('salto', 'obj'),
      fields: {
        active: {
          refType: BuiltinTypes.BOOLEAN,
        },
        name: {
          refType: BuiltinTypes.STRING,
        },
        user: {
          refType: userType,
          annotations: {
            label: 'Active',
          },
        },
      },
      annotations: {
        name: 'test',
        apiName: 123,
        other: 'bla',
      },
    })
    const elementSourceNoImportant = buildElementsSourceFromElements([objNoImportant, userType])
    const res = await getImportantValues({
      element: inst,
      elementSource: elementSourceNoImportant,
    })
    expect(res).toEqual({})
  })
  it('should return only indexed values', async () => {
    const res = await getImportantValues({
      element: inst,
      elementSource,
      indexedOnly: true,
    })
    expect(res).toEqual([{ active: true }, { doesNotExist: undefined }])
  })
  it('should return only highlighted values', async () => {
    const res = await getImportantValues({
      element: inst,
      elementSource,
      highlightedOnly: true,
    })
    expect(res).toEqual([{ name: 'test inst' }, { doesNotExist: undefined }])
  })
  it('should not return inner values if highlighted', async () => {
    const obj2 = new ObjectType({
      elemID: new ElemID('salto', 'obj2'),
      fields: {
        name: {
          refType: BuiltinTypes.STRING,
        },
        user: {
          refType: userType,
        },
      },
      annotations: {
        [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
          {
            value: 'name',
            indexed: false,
            highlighted: true,
          },
          {
            value: 'user.id',
            indexed: true,
            highlighted: true,
          },
        ],
      },
    })
    const inst2 = new InstanceElement(
      'test inst2',
      obj2,
      {
        name: 'test inst',
        user: {
          id: 12345,
        },
      }
    )
    elementSource = buildElementsSourceFromElements([obj2])
    const res = await getImportantValues({
      element: inst2,
      elementSource,
      highlightedOnly: true,
    })
    expect(res).toEqual([{ name: 'test inst' }])
  })
  it('should return only  primitive values if indexed is true', async () => {
    // check undefined, number, array of primitive, string --> need to return
    // reference, other obj --> should not return
    const obj2 = new ObjectType({
      elemID: new ElemID('salto', 'obj2'),
      fields: {
        string: {
          refType: BuiltinTypes.STRING,
        },
        number: {
          refType: BuiltinTypes.NUMBER,
        },
        boolean: {
          refType: BuiltinTypes.BOOLEAN,
        },
        stringArray: {
          refType: BuiltinTypes.UNKNOWN,
        },
        undefinedVal: {
          refType: BuiltinTypes.UNKNOWN,
        },
        reference: {
          refType: BuiltinTypes.UNKNOWN,
        },
        obj: {
          refType: userType,
        },
      },
      annotations: {
        [CORE_ANNOTATIONS.IMPORTANT_VALUES]: [
          {
            value: 'string',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'number',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'boolean',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'stringArray',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'undefinedVal',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'reference',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'obj.id',
            indexed: true,
            highlighted: false,
          },
          {
            value: 'obj',
            indexed: true,
            highlighted: false,
          },
        ],
      },
    })
    const inst2 = new InstanceElement(
      'test inst2',
      obj2,
      {
        string: 'test inst',
        number: 1,
        boolean: true,
        stringArray: ['1', '2'],
        undefinedVal: undefined,
        reference: new ReferenceExpression(inst.elemID),
        obj: {
          id: 12345,
        },
      }
    )
    const res = await getImportantValues({
      element: inst2,
      elementSource,
      indexedOnly: true,
    })
    expect(res).toEqual([
      { string: 'test inst' },
      { number: 1 },
      { boolean: true },
      { stringArray: ['1', '2'] },
      { undefinedVal: undefined },
      { reference: new ReferenceExpression(inst.elemID) },
      { id: 12345 },
    ])
  })
})
