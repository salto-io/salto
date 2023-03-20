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
import { ObjectType, ElemID, BuiltinTypes, ListType, InstanceElement, TypeReference, createRefToElmWithValue, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { updatePathIndex, getElementsPathHints, PathIndex, getFromPathIndex, Path,
  overridePathIndex, splitElementByPath, getTopLevelPathHints } from '../../src/workspace/path_index'
import { InMemoryRemoteMap } from '../../src/workspace/remote_map'

const { awu } = collections.asynciterable

const nestedType = new ObjectType({
  elemID: new ElemID('salto', 'nested'),
  fields: {
    str: {
      refType: BuiltinTypes.STRING,
    },
    num: {
      refType: BuiltinTypes.NUMBER,
    },
    list: {
      refType: new ListType(BuiltinTypes.NUMBER),
    },
  },
})
// singlePathObject
const singlePathObject = new ObjectType({
  elemID: new ElemID('salto', 'singlePathObj'),
  fields: {
    simple: {
      refType: BuiltinTypes.STRING,
    },
    nested: {
      refType: nestedType,
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
const oldPartiallyFetchedObject = new ObjectType({
  elemID: new ElemID('salto', 'partial'),
  fields: {
    simple: {
      refType: BuiltinTypes.STRING,
    },
    nested: {
      refType: nestedType,
    },
  },
  path: ['salto', 'obj', 'oldPartial'],
})
const updatedPartiallyFetchedObject = new ObjectType({
  elemID: new ElemID('salto', 'partial'),
  fields: {
    simple: {
      refType: BuiltinTypes.STRING,
    },
    nested: {
      refType: nestedType,
    },
  },
  path: ['salto', 'obj', 'newPartial'],
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
      refType: BuiltinTypes.STRING,
    },
  },
  path: ['salto', 'obj', 'multi', 'fields'],
})

const multiPathInstanceTypeID = new ElemID('salto', 'obj')

const multiPathInstanceA = new InstanceElement(
  'inst',
  new TypeReference(multiPathInstanceTypeID),
  {
    a: 'A',
  },
  ['salto', 'inst', 'A']
)

const multiPathInstanceB = new InstanceElement(
  'inst',
  new TypeReference(multiPathInstanceTypeID),
  {
    b: 'B',
  },
  ['salto', 'inst', 'B'],
  {
    [CORE_ANNOTATIONS.CHANGED_BY]: 'Me',
  },
)

const multiPathInstanceFull = new InstanceElement(
  'inst',
  new TypeReference(multiPathInstanceTypeID),
  {
    a: 'A',
    b: 'B',
  },
  undefined,
  {
    [CORE_ANNOTATIONS.CHANGED_BY]: 'Me',
  },
)
describe('topLevelPathIndex', () => {
  it('get top level path hints should return correct path hints', () => {
    expect(getTopLevelPathHints(
      [
        multiPathAnnoObj,
        multiPathFieldsObj,
        multiPathInstanceA,
        multiPathInstanceB,
      ]
    )).toEqual([
      {
        key: 'salto.multiPathObj',
        value: [
          ['salto', 'obj', 'multi', 'anno'],
          ['salto', 'obj', 'multi', 'fields'],
        ],
      },
      {
        key: 'salto.obj.instance.inst',
        value: [
          ['salto', 'inst', 'A'],
          ['salto', 'inst', 'B'],
        ],
      },
    ])
  })
  it('should only add new top level elements paths to index', async () => {
    const topLevelPathIndex = new InMemoryRemoteMap<Path[]>()
    await topLevelPathIndex.setAll(getTopLevelPathHints([singlePathObject, oldPartiallyFetchedObject]))
    await updatePathIndex({
      index: topLevelPathIndex,
      elements: [
        multiPathAnnoObj,
        multiPathFieldsObj,
        multiPathInstanceA,
        multiPathInstanceB,
        // when there is a partial fetch, the adapter name will be in accountsToMaintain
        // but there will also be elements of that adapter in the elements array
        updatedPartiallyFetchedObject,
      ],
      accountsToMaintain: ['salto'],
      isTopLevel: true,
    })
    expect(await awu(topLevelPathIndex.entries()).toArray()).toEqual(
      [
        ...getTopLevelPathHints(
          [
            multiPathAnnoObj,
            multiPathFieldsObj,
            multiPathInstanceA,
            multiPathInstanceB,
            updatedPartiallyFetchedObject,
            singlePathObject,
          ]
        ),
      ]
    )
  })
})

describe('updatePathIndex', () => {
  let index: PathIndex
  beforeAll(async () => {
    index = new InMemoryRemoteMap<Path[]>()
    await index.setAll(getElementsPathHints([singlePathObject, oldPartiallyFetchedObject]))
    await updatePathIndex({
      index,
      elements: [
        multiPathAnnoObj,
        multiPathFieldsObj,
        multiPathInstanceA,
        multiPathInstanceB,
        // when there is a partial fetch, the adapter name will be in accountsToMaintain
        // but there will also be elements of that adapter in the elements array
        updatedPartiallyFetchedObject,
      ],
      accountsToMaintain: ['salto'],
      isTopLevel: false,
    })
  })
  it('should add new elements with proper paths', async () => {
    expect(await index.get(multiPathObjID.getFullName()))
      .toEqual([
        ['salto', 'obj', 'multi', 'anno'],
        ['salto', 'obj', 'multi', 'fields'],
      ])
    expect(await index.get(multiPathFieldsObj.elemID.createNestedID('field').getFullName()))
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
    expect(
      await index.get(multiPathInstanceA.elemID
        .createNestedID(CORE_ANNOTATIONS.CHANGED_BY).getFullName()),
    ).toEqual([
      ['salto', 'inst', 'B'],
    ])
  })

  it('should maintatin old elements', async () => {
    expect(await index.get(singlePathObject.elemID.getFullName()))
      .toEqual([singlePathObject.path])
  })
  it('partial fetch flow should update pathIndex', async () => {
    expect(await index.get(updatedPartiallyFetchedObject.elemID.getFullName()))
      .toEqual([updatedPartiallyFetchedObject.path])
  })
})

describe('getFromPathIndex', () => {
  const index: PathIndex = new InMemoryRemoteMap<Path[]>()
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

describe('split element by path', () => {
  const objElemId = new ElemID('salto', 'obj')
  const objFragStdFields = new ObjectType({
    elemID: objElemId,
    fields: {
      stdField: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          test: 'test',
        },
      },
    },
    path: ['salto', 'obj', 'standardFields'],
  })
  const objFragCustomFields = new ObjectType({
    elemID: objElemId,
    fields: {
      customField: {
        refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
        annotations: {
          test: 'test',
        },
      },
    },
    path: ['salto', 'obj', 'customFields'],
  })
  const objFragAnnotations = new ObjectType({
    elemID: objElemId,
    annotationRefsOrTypes: {
      anno: createRefToElmWithValue(BuiltinTypes.STRING),
    },
    annotations: {
      anno: 'Hey',
    },
    path: ['salto', 'obj', 'annotations'],
  })

  const objFull = new ObjectType({
    elemID: objElemId,
    fields: {
      stdField: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          test: 'test',
        },
      },
      customField: {
        refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
        annotations: {
          test: 'test',
        },
      },
    },
    annotationRefsOrTypes: {
      anno: createRefToElmWithValue(BuiltinTypes.STRING),
    },
    annotations: {
      anno: 'Hey',
    },
  })

  const singlePathObj = new ObjectType({
    elemID: new ElemID('salto', 'singlePath'),
    fields: {
      stdField: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          test: 'test',
        },
      },
      customField: {
        refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
        annotations: {
          test: 'test',
        },
      },
    },
    annotationRefsOrTypes: {
      anno: createRefToElmWithValue(BuiltinTypes.STRING),
    },
    annotations: {
      anno: 'Is it me',
    },

    path: ['salto', 'existing', 'all'],
  })

  const noPathObj = new ObjectType({
    elemID: new ElemID('salto', 'noPath'),
    fields: {
      stdField: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          test: 'test',
        },
      },
      customField: {
        refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
        annotations: {
          test: 'test',
        },
      },
    },
    annotationRefsOrTypes: {
      anno: createRefToElmWithValue(BuiltinTypes.STRING),
    },
    annotations: {
      anno: 'You\'r looking for?',
    },

  })

  const fullObjFrags = [
    objFragStdFields, objFragCustomFields, objFragAnnotations,
  ]
  const unmergedElements = [
    ...fullObjFrags, singlePathObj, noPathObj, multiPathInstanceA, multiPathInstanceB,
  ]
  const pi = new InMemoryRemoteMap<Path[]>()

  beforeAll(async () => {
    await overridePathIndex(pi, unmergedElements)
  })

  it('should split an element with multiple pathes', async () => {
    const splitedElements = await splitElementByPath(objFull, pi)
    fullObjFrags.forEach(
      frag => expect(splitedElements.filter(elem => elem.isEqual(frag))).toHaveLength(1)
    )
  })

  it('should have instance annotations in a single fragment', async () => {
    const splittedInstance = await splitElementByPath(multiPathInstanceFull, pi)
    expect(splittedInstance).toHaveLength(2)
    const fragmentsWithAnnoVal = splittedInstance.filter(instFrag =>
      instFrag.annotations[CORE_ANNOTATIONS.CHANGED_BY])
    expect(fragmentsWithAnnoVal).toHaveLength(1)
  })

  it('should return a single object for an element with one path', async () => {
    const splitedElements = await splitElementByPath(singlePathObj, pi)
    expect(splitedElements).toHaveLength(1)
    expect(splitedElements[0]).toEqual(singlePathObj)
  })

  it('should return the element for an element with no pathes', async () => {
    const splitedElements = await splitElementByPath(noPathObj, pi)
    expect(splitedElements).toHaveLength(1)
    expect(splitedElements[0]).toEqual(noPathObj)
  })
})
