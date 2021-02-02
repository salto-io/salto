/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType, ElemID, BuiltinTypes, ListType, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import {
  updatePathIndex, getElementsPathHints, PathIndex, getFromPathIndex,
} from '../../src/workspace/path_index'
import { InMemoryRemoteMap } from '../../src/workspace/remote_map'

const nestedType = new ObjectType({
  elemID: new ElemID('salto', 'nested'),
  fields: {
    str: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
    },
    num: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
    },
    list: {
      refType: createRefToElmWithValue(new ListType(BuiltinTypes.NUMBER)),
    },
  },
})
// singlePathObject
const singlePathObject = new ObjectType({
  elemID: new ElemID('salto', 'singlePathObj'),
  fields: {
    simple: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
    },
    nested: {
      refType: createRefToElmWithValue(nestedType),
    },
  },
  annotationRefsOrTypes: {
    simple: BuiltinTypes.STRING,
    nested: nestedType,
  },
  annotations: {
    simple: 'simple',
    nested: {
      str: 'Str',
      num: 7,
      list: [1, 2, 3],
    },
  },
  path: ['salto', 'obj', 'simple'],
})
// multiPathObject
// singlePathObject
const multiPathObjID = new ElemID('salto', 'multiPathObj')
const multiPathAnnoObj = new ObjectType({
  elemID: multiPathObjID,
  annotationRefsOrTypes: {
    simple: BuiltinTypes.STRING,
    nested: nestedType,
  },
  annotations: {
    simple: 'simple',
    nested: {
      str: 'Str',
      num: 7,
      list: [1, 2, 3],
    },
    notDefined: 'where is my def?!',
  },
  path: ['salto', 'obj', 'multi', 'anno'],
})

const multiPathFieldsObj = new ObjectType({
  elemID: multiPathObjID,
  fields: {
    field: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
    },
  },
  path: ['salto', 'obj', 'multi', 'fields'],
})

const multiPathInstanceTypeID = new ElemID('salto', 'obj')

const multiPathInstanceA = new InstanceElement(
  'inst',
  new ReferenceExpression(multiPathInstanceTypeID),
  {
    a: 'A',
  },
  ['salto', 'inst', 'A']
)

const multiPathInstanceB = new InstanceElement(
  'inst',
  new ReferenceExpression(multiPathInstanceTypeID),
  {
    b: 'B',
  },
  ['salto', 'inst', 'B']
)

describe('updatePathIndex', () => {
  let index: PathIndex
  beforeAll(async () => {
    index = new InMemoryRemoteMap()
    await index.setAll(getElementsPathHints([singlePathObject]))
    await updatePathIndex(index, [
      multiPathAnnoObj,
      multiPathFieldsObj,
      multiPathInstanceA,
      multiPathInstanceB,
    ], ['salto'])
  })
  it('should add new elements with proper paths', async () => {
    expect(await index.get(multiPathObjID.getFullName()))
      .toEqual([
        ['salto', 'obj', 'multi', 'anno'],
        ['salto', 'obj', 'multi', 'fields'],
      ])
    expect(await index.get(multiPathFieldsObj.fields.field.elemID.getFullName()))
      .toEqual([
        ['salto', 'obj', 'multi', 'fields'],
      ])
    expect(await index.get(multiPathObjID.createNestedID('attr', 'simple').getFullName()))
      .toEqual([
        ['salto', 'obj', 'multi', 'anno'],
      ])
    expect(await index.get(multiPathInstanceA.elemID.getFullName()))
      .toEqual([
        ['salto', 'inst', 'A'],
        ['salto', 'inst', 'B'],
      ])
    expect(await index.get(multiPathInstanceA.elemID.createNestedID('a').getFullName()))
      .toEqual([
        ['salto', 'inst', 'A'],
      ])
    expect(await index.get(multiPathInstanceA.elemID.createNestedID('b').getFullName()))
      .toEqual([
        ['salto', 'inst', 'B'],
      ])
  })

  it('should maintatin old elements', async () => {
    expect(await index.get(singlePathObject.elemID.getFullName()))
      .toEqual([singlePathObject.path])
  })
})

describe('getFromPathIndex', () => {
  const index: PathIndex = new InMemoryRemoteMap()
  const parentID = new ElemID('salto.parent')
  const nestedID = parentID.createNestedID('attr', 'one')
  const nestedPath = ['salto', 'one']
  const parentPath = ['salto', 'two']
  beforeAll(async () => {
    await index.setAll([
      { key: parentID.getFullName(), value: [nestedPath, parentPath] },
      { key: nestedID.getFullName(), value: [nestedPath] },
    ])
  })

  it('should get an exact elemID match', async () => {
    expect(await getFromPathIndex(nestedID, index)).toEqual([nestedPath])
    expect(await getFromPathIndex(parentID, index)).toEqual([nestedPath, parentPath])
  })

  it('should get the closest parent of the elemID if no exact match', async () => {
    expect(await getFromPathIndex(
      nestedID.createNestedID('stam', 'something'),
      index
    )).toEqual([nestedPath])
    expect(await getFromPathIndex(
      parentID.createNestedID('attr', 'something'),
      index
    )).toEqual([nestedPath, parentPath])
  })

  it('should return an empty array if no parent matches are found', async () => {
    expect(await getFromPathIndex(new ElemID('salto', 'nothing'), index)).toEqual([])
  })
})
