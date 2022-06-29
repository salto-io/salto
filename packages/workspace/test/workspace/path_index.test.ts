/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { ObjectType, ElemID, BuiltinTypes, createRefToElmWithValue, getTopLevelPath, InstanceElement, DetailedChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { PathIndex, getFromPathIndex, Path, splitElementByPath, splitDetailedChange } from '../../src/workspace/path_index'
import { InMemoryRemoteMap } from '../../src/workspace/remote_map'

// TODO: go over all this file and add those missing tests that I removed
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

describe('splitElementByPath', () => {
  describe('ObjectType', () => {
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
      fields: {
        stdField: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            anotherTest: 'test',
          },
        },
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
            anotherTest: 'test',
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
      path: new collections.treeMap.TreeMap<string>([
        [objElemId.getFullName(), getTopLevelPath(objFragAnnotations)],
        [objElemId.createNestedID('field', 'stdField').getFullName(), getTopLevelPath(objFragStdFields)],
        [objElemId.createNestedID('field', 'customField').getFullName(), getTopLevelPath(objFragCustomFields)],
        [objElemId.createNestedID('field', 'stdField', 'anotherTest').getFullName(), getTopLevelPath(objFragAnnotations)],
      ]),
    })
    const singlePathObj = new ObjectType({
      elemID: new ElemID('salto', 'singlePath'),
      fields: {
        stdField: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            test: 'test',
            anotherTest: 'test',
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
            anotherTest: 'test',
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
    const fullObjFrags = [objFragStdFields, objFragCustomFields, objFragAnnotations]
    it('should split an element with multiple pathes', async () => {
      const splitedElements = await splitElementByPath(objFull, new InMemoryRemoteMap<Path[]>())
      fullObjFrags.forEach(
        frag => expect(splitedElements.filter(elem => elem.isEqual(frag))).toHaveLength(1)
      )
    })
    it('should return a single object for an element with one path', async () => {
      const splitedElements = await splitElementByPath(
        singlePathObj, new InMemoryRemoteMap<Path[]>()
      )
      expect(splitedElements).toHaveLength(1)
      expect(splitedElements[0]).toEqual(singlePathObj)
    })
    it('should return the element for an element with no pathes', async () => {
      const splitedElements = await splitElementByPath(noPathObj, new InMemoryRemoteMap<Path[]>())
      expect(splitedElements).toHaveLength(1)
      expect(splitedElements[0]).toEqual(noPathObj)
    })
  })
  describe('InstanceElement', () => {
    const objType = new ObjectType({ elemID: new ElemID('salto', 'obj') })
    const name = 'inst'
    const instFragStdFields = new InstanceElement(
      name,
      objType,
      {
        val1: 123,
        val3: 'anotherTest',
        val4: {
          test1: 1,
        },
      },
      ['salto', 'obj', 'sFields'],
    )
    const instFragCustomFields = new InstanceElement(
      name,
      objType,
      {
        val2: 'test',
        val4: {
          test2: 2,
        },
      },
      ['salto', 'obj', 'cFields'],
    )
    const instFragAnnotations = new InstanceElement(
      name,
      objType,
      {},
      ['salto', 'obj', 'anno'],
      {
        anno1: 'test',
        anno2: 'yet another test',
      },
    )
    const full = new InstanceElement(
      name,
      objType,
      {
        val1: 123,
        val2: 'test',
        val3: 'anotherTest',
        val4: {
          test1: 1,
          test2: 2,
        },
      },
      undefined,
      {
        anno1: 'test',
        anno2: 'yet another test',
      },
    )
    full.pathIndex = new collections.treeMap.TreeMap<string>([
      [full.elemID.getFullName(), getTopLevelPath(instFragAnnotations)],
      [full.elemID.createNestedID('val1').getFullName(), getTopLevelPath(instFragStdFields)],
      [full.elemID.createNestedID('val2').getFullName(), getTopLevelPath(instFragCustomFields)],
      [full.elemID.createNestedID('val3').getFullName(), getTopLevelPath(instFragStdFields)],
      [full.elemID.createNestedID('val4').getFullName(), getTopLevelPath(instFragStdFields)],
      [full.elemID.createNestedID('val4', 'test2').getFullName(), getTopLevelPath(instFragCustomFields)],
    ])
    const fullInstFrags = [instFragStdFields, instFragCustomFields, instFragAnnotations]
    it('should split an element with multiple pathes', async () => {
      const splitedElements = await splitElementByPath(full, new InMemoryRemoteMap<Path[]>())
      fullInstFrags.forEach(
        frag => expect(splitedElements.filter(elem => elem.isEqual(frag))).toHaveLength(1)
      )
    })
  })
})

describe('splitDetailedChange', () => {
  describe('InstanceElement', () => {
    const detailedChange: DetailedChange = {
      action: 'add',
      id: ElemID.fromFullName('salto.obj.instance.inst.myMap'),
      data: { after: { a: 1, b: { c: 2, d: 3 } } },
      pathIndex: new collections.treeMap.TreeMap<string>([
        ['salto.obj.instance.inst.myMap', ['test']],
        ['salto.obj.instance.inst.myMap.b.c', ['my', 'nested', 'test']],
      ]),
    }
    const splittedDetailedChangeA = {
      action: 'add',
      id: ElemID.fromFullName('salto.obj.instance.inst.myMap'),
      data: { after: { a: 1, b: { d: 3 } } },
      pathIndex: new collections.treeMap.TreeMap<string>([
        ['salto.obj.instance.inst.myMap', ['test']],
      ]),
    }
    const splittedDetailedChangeB = {
      action: 'add',
      id: ElemID.fromFullName('salto.obj.instance.inst.myMap'),
      data: { after: { b: { c: 2 } } },
      pathIndex: new collections.treeMap.TreeMap<string>([
        ['salto.obj.instance.inst.myMap', ['my', 'nested', 'test']],
      ]),
    }
    const fullDCFrags = [splittedDetailedChangeA, splittedDetailedChangeB]
    it('should split an element with multiple pathes', () => {
      const splitedChanges = splitDetailedChange(detailedChange)
      fullDCFrags.forEach(
        frag => expect(splitedChanges.filter(elem => _.isEqual(elem, frag))).toHaveLength(1)
      )
    })
  })
})
