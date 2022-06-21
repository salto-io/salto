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
import { ObjectType, ElemID, BuiltinTypes, createRefToElmWithValue, getTopLevelPath, InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { PathIndex, getFromPathIndex, Path, splitElementByPath } from '../../src/workspace/path_index'
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

describe('split element by path', () => {
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
      path: new collections.treeMap.TreeMap<string>([
        [objElemId.getFullName(), getTopLevelPath(objFragAnnotations)],
        [objElemId.createNestedID('attr', 'anno').getFullName(), getTopLevelPath(objFragAnnotations)],
        [objElemId.createNestedID('annotation', 'anno').getFullName(), getTopLevelPath(objFragAnnotations)],
        [objElemId.createNestedID('field', 'stdField').getFullName(), getTopLevelPath(objFragStdFields)],
        [objElemId.createNestedID('field', 'customField').getFullName(), getTopLevelPath(objFragCustomFields)],
      ]),
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
      },
      ['salto', 'obj', 'sFields'],
    )
    const instFragCustomFields = new InstanceElement(
      name,
      objType,
      {
        val2: 'test',
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
      },
      undefined,
      {
        anno1: 'test',
        anno2: 'yet another test',
      },
    )
    full.pathIndex = new collections.treeMap.TreeMap<string>([
      [full.elemID.getFullName(), getTopLevelPath(instFragAnnotations)],
      [full.elemID.createNestedID('anno1').getFullName(), getTopLevelPath(instFragAnnotations)],
      [full.elemID.createNestedID('anno2').getFullName(), getTopLevelPath(instFragAnnotations)],
      [full.elemID.createNestedID('val1').getFullName(), getTopLevelPath(instFragStdFields)],
      [full.elemID.createNestedID('val2').getFullName(), getTopLevelPath(instFragCustomFields)],
      [full.elemID.createNestedID('val3').getFullName(), getTopLevelPath(instFragStdFields)],
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
