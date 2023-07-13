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
  ObjectType,
  ElemID,
  BuiltinTypes,
  ListType,
  InstanceElement,
  TypeReference,
  createRefToElmWithValue,
  CORE_ANNOTATIONS,
  Element,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  updatePathIndex, getElementsPathHints, PathIndex, getFromPathIndex, Path,
  splitElementByPath, getTopLevelPathHints, updateTopLevelPathIndex, PathIndexArgs,
} from '../../src/workspace/path_index'
import { InMemoryRemoteMap, RemoteMapEntry } from '../../src/workspace/remote_map'

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

const createSinglePathObject = (nameAddition = ''): ObjectType => new ObjectType({
  elemID: new ElemID('salto', `singlePathObj${nameAddition}`),
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
const singlePathObject = createSinglePathObject()

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

const createMultiPathAnnObject = (nameAddition = ''): ObjectType => new ObjectType({
  elemID: new ElemID('salto', `multiPathObj${nameAddition}`),
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
const multiPathAnnoObj = createMultiPathAnnObject()

const createMultiPathFieldsObj = (nameAddition = ''): ObjectType => new ObjectType({
  elemID: new ElemID('salto', `multiPathObj${nameAddition}`),
  fields: {
    field: {
      refType: BuiltinTypes.STRING,
    },
  },
  path: ['salto', 'obj', 'multi', 'fields'],
})
const multiPathFieldsObj = createMultiPathFieldsObj()

const multiPathInstanceTypeID = new ElemID('salto', 'obj')
const createMultiPathInstanceA = (nameAddition = ''): InstanceElement => new InstanceElement(
  `inst${nameAddition}`,
  new TypeReference(multiPathInstanceTypeID),
  {
    a: 'A',
  },
  ['salto', 'inst', 'A']
)
const multiPathInstanceA = createMultiPathInstanceA()

const createMultiPathInstanceB = (nameAddition = ''): InstanceElement => new InstanceElement(
  `inst${nameAddition}`,
  new TypeReference(multiPathInstanceTypeID),
  {
    b: 'B',
  },
  ['salto', 'inst', 'B'],
  {
    [CORE_ANNOTATIONS.CHANGED_BY]: 'Me',
  },
)
const multiPathInstanceB = createMultiPathInstanceB()

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
    await updateTopLevelPathIndex({
      pathIndex: topLevelPathIndex,
      unmergedElements: [
        multiPathAnnoObj,
        multiPathFieldsObj,
        multiPathInstanceA,
        multiPathInstanceB,
        // when there is a partial fetch, the account name will be in accountsToMaintain
        // but there will also be elements of that account in the elements array
        updatedPartiallyFetchedObject,
      ],
      removedElementsFullNames: new Set<string>(),
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

describe('getFromPathIndex', () => {
  const index: PathIndex = new InMemoryRemoteMap<Path[]>()
  const parentID = new ElemID('salto.parent')
  const nestedID = parentID.createNestedID('attr', 'one')
  const nestedWithNoPathID = parentID.createNestedID('attr', 'two')
  const nestedOfNestedWithNoPathID = nestedID.createNestedID('stam', 'something')
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

  it('should get the closest parent of the elemID if no exact match, but only a single hint if parent has multiple', async () => {
    expect(await getFromPathIndex(
      nestedOfNestedWithNoPathID,
      index
    )).toEqual([nestedPath])
    const parentMissPaths = await getFromPathIndex(nestedWithNoPathID, index)
    expect(parentMissPaths).toHaveLength(1)
    expect([[nestedPath], [parentPath]]).toContainEqual(parentMissPaths)
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

  const singleFieldObjElemId = new ElemID('salto', 'obj2')
  const singleFieldObj = new ObjectType({
    elemID: singleFieldObjElemId,
    fields: {
      uriField: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          test: 'test',
        },
      },
    },
    path: ['salto', 'obj2', 'field'],
  })

  const singleFieldObjAnnotations = new ObjectType({
    elemID: singleFieldObjElemId,
    annotationRefsOrTypes: {
      anno: createRefToElmWithValue(BuiltinTypes.STRING),
    },
    annotations: {
      anno: 'Bye',
    },
    path: ['salto', 'obj2', 'annotations'],
  })

  const singleFieldObjFull = new ObjectType({
    elemID: singleFieldObjElemId,
    fields: {
      uriField: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          test: 'test',
        },
      },
    },
    annotationRefsOrTypes: {
      anno: createRefToElmWithValue(BuiltinTypes.STRING),
    },
    annotations: {
      anno: 'Bye',
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
  const singleFieldObjFrags = [
    singleFieldObj, singleFieldObjAnnotations,
  ]
  const unmergedElements = [
    ...fullObjFrags, ...singleFieldObjFrags, singlePathObj, noPathObj, multiPathInstanceA, multiPathInstanceB,
  ]
  const pi = new InMemoryRemoteMap<Path[]>()

  beforeAll(async () => {
    await updatePathIndex({ pathIndex: pi, unmergedElements })
  })

  it('should split an element with multiple pathes', async () => {
    const splitedElements = await splitElementByPath(objFull, pi)
    fullObjFrags.forEach(
      frag => expect(splitedElements.filter(elem => elem.isEqual(frag))).toHaveLength(1)
    )
  })

  it('should split an element with one fields file', async () => {
    const splitedElements = await splitElementByPath(singleFieldObjFull, pi)
    singleFieldObjFrags.forEach(
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

describe('updatePathIndex', () => {
  const createObjectsFunctions = [
    createSinglePathObject,
    createMultiPathAnnObject,
    createMultiPathFieldsObj,
    createMultiPathInstanceA,
    createMultiPathInstanceB,
  ]
  const objectsToAdd = createObjectsFunctions.map(f => f('add'))
  const objectsToRemove = createObjectsFunctions.map(f => f('remove'))
  const objectsToModifyBefore = createObjectsFunctions.map(f => f('modify'))
  const objectsToModifyAfter = objectsToModifyBefore.map(e => e.clone())
  objectsToModifyAfter.forEach(e => { e.path = e.path && [...e.path, 'modify'] })

  const runTest = async (
    updatePathIndexFunc: (args: PathIndexArgs) => Promise<void>,
    pathHintsFunc: (unmergedElements: Element[]) => RemoteMapEntry<Path[]>[]): Promise<void> => {
    const index = new InMemoryRemoteMap<Path[]>()
    await index.setAll(pathHintsFunc([...objectsToModifyBefore, ...objectsToRemove]))
    await updatePathIndexFunc({
      pathIndex: index,
      unmergedElements: [
        ...objectsToAdd,
        ...objectsToModifyAfter,
      ],
      removedElementsFullNames: new Set<string>([
        'salto.multiPathObjremove.attr.nested', // Removes the 'nested' field from multiPathAnnObject
        createMultiPathInstanceA('remove').elemID.createTopLevelParentID().parent.getFullName(), // Removes instance A and B
      ]),
    })
    const indexEntries = await awu(index.entries()).toArray()

    const removedMultiPathAnnObject = objectsToRemove[1].clone()
    delete removedMultiPathAnnObject.annotations.nested

    expect(indexEntries).toEqual(expect.arrayContaining(
      [
        ...pathHintsFunc([
          ...objectsToAdd,
          ...objectsToModifyAfter,
          objectsToRemove[0],
          removedMultiPathAnnObject, // only the 'nested' field was removed
          objectsToRemove[2],
          // [3] and [4] were removed
        ]),
      ]
    ))
  }

  it('should update pathIndex correctly', async () => {
    await runTest(updatePathIndex, getElementsPathHints)
  })
  it('should update topLevelPathIndex correctly', async () => {
    await runTest(updateTopLevelPathIndex, getTopLevelPathHints)
  })

  it('should override pathIndex when called without removedElementsFullNames', async () => {
    const index = new InMemoryRemoteMap<Path[]>()
    await index.setAll(getElementsPathHints([...objectsToModifyBefore, ...objectsToRemove]))
    await updatePathIndex({ pathIndex: index, unmergedElements: [...objectsToAdd] })

    const indexEntries = await awu(index.entries()).toArray()
    expect(indexEntries).toEqual(expect.arrayContaining(
      [
        ...getElementsPathHints([
          ...objectsToAdd,
        ]),
      ]
    ))
  })
})

describe('getElementsPathHints', () => {
  const elemId = new ElemID('salto', 'obj')
  it('should return one path hint for singlePathObject with no annotations and fields', async () => {
    const singlePath = new ObjectType({
      elemID: elemId,
      path: ['salto', 'obj', 'simple'],
    })
    const pathHints = getElementsPathHints([singlePath])
    expect(pathHints.length).toEqual(1)
  })

  it('should return one path hint for annotations and one for fields', async () => {
    const singleFieldObj = new ObjectType({
      elemID: elemId,
      fields: {
        uriField: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            test: 'test',
          },
        },
      },
      path: ['salto', 'obj', 'field'],
    })

    const singleFieldObjAnnotations = new ObjectType({
      elemID: elemId,
      annotationRefsOrTypes: {
        anno: createRefToElmWithValue(BuiltinTypes.STRING),
      },
      annotations: {
        anno: 'Bye',
      },
      path: ['salto', 'obj', 'annotations'],
    })
    const pathHints = getElementsPathHints([singleFieldObj, singleFieldObjAnnotations])
    expect(pathHints.length).toEqual(4)
    const fieldHints = pathHints.filter(p => p.key.includes('field'))
    expect(fieldHints.length).toEqual(1)
    expect(fieldHints[0].value.length).toEqual(1)
    const annoHints = pathHints.filter(p => p.key.includes('annotation'))
    expect(annoHints.length).toEqual(1)
    expect(annoHints[0].value.length).toEqual(1)
  })

  it('should return path hints for divided annotations and divided fields', async () => {
    const objFragStdFields = new ObjectType({
      elemID: elemId,
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
      elemID: elemId,
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
    const objFragAnnotationsOne = new ObjectType({
      elemID: elemId,
      annotationRefsOrTypes: {
        anno: createRefToElmWithValue(BuiltinTypes.STRING),
      },
      annotations: {
        anno: 'Hey',
      },
      path: ['salto', 'obj', 'annotationsOne'],
    })
    const objFragAnnotationsTwo = new ObjectType({
      elemID: elemId,
      annotationRefsOrTypes: {
        ping: createRefToElmWithValue(BuiltinTypes.STRING),
      },
      annotations: {
        ping: 'pong',
      },
      path: ['salto', 'obj', 'annotationsTwo'],
    })
    const pathHints = getElementsPathHints([
      objFragAnnotationsOne, objFragAnnotationsTwo, objFragStdFields, objFragCustomFields,
    ])
    expect(pathHints.length).toEqual(10)
    const fieldHints = pathHints.filter(p => p.key.includes('field'))
    expect(fieldHints.length).toEqual(3)
    expect(fieldHints[0].value.length).toEqual(2)
    const annoHints = pathHints.filter(p => p.key.includes('annotation'))
    expect(annoHints.length).toEqual(3)
    expect(annoHints[0].value.length).toEqual(2)
    const attrHints = pathHints.filter(p => p.key.includes('attr'))
    expect(attrHints.length).toEqual(3)
    expect(attrHints[0].value.length).toEqual(2)
  })

  it('should return path hints for nested fields', async () => {
    const objFragFieldOne = new ObjectType({
      elemID: elemId,
      fields: {
        myField: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            test: 'test',
          },
        },
      },
      path: ['salto', 'obj', 'one'],
    })
    const objFragFieldTwo = new ObjectType({
      elemID: elemId,
      fields: {
        myField: {
          refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
          annotations: {
            yo: 'yo',
          },
        },
      },
      path: ['salto', 'obj', 'two'],
    })
    const pathHints = getElementsPathHints([objFragFieldOne, objFragFieldTwo])
    const fieldHints = pathHints.filter(p => p.key.includes('field'))
    expect(fieldHints.length).toEqual(4)
    expect(fieldHints[0].value.length).toEqual(2)
  })

  it('should return path hints for instances', async () => {
    const pathHints = getElementsPathHints([multiPathInstanceA, multiPathInstanceB])
    expect(pathHints.length).toEqual(4)
  })
})
