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
import { InstanceElement, ObjectType, ElemID, BuiltinTypes, ListType } from '@salto-io/adapter-api'
import {
  createPathIndex, serializedPathIndex, deserializedPathIndex, PathIndex, updatePathIndex,
  deserializedPathsIndex, serializePathIndexByService,
} from '../../src/workspace/path_index'

jest.spyOn(PathIndex.prototype, 'push')

const nestedType = new ObjectType({
  elemID: new ElemID('salto', 'nested'),
  fields: {
    str: {
      type: BuiltinTypes.STRING,
    },
    num: {
      type: BuiltinTypes.NUMBER,
    },
    list: {
      type: new ListType(BuiltinTypes.NUMBER),
    },
  },
})
// singlePathObject
const singlePathObject = new ObjectType({
  elemID: new ElemID('salto', 'singlePathObj'),
  fields: {
    simple: {
      type: BuiltinTypes.STRING,
    },
    nested: {
      type: nestedType,
    },
  },
  annotationTypes: {
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
const singlePathObjectOtherService = new ObjectType({
  elemID: new ElemID('salto2', 'singlePathObj'),
  fields: {
    simple: {
      type: BuiltinTypes.STRING,
    },
    nested: {
      type: nestedType,
    },
  },
  annotationTypes: {
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
  path: ['salto2', 'obj', 'simple'],
})
// multiPathObject
// singlePathObject
const multiPathAnnoObj = new ObjectType({
  elemID: new ElemID('salto', 'multiPathObj'),
  annotationTypes: {
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
// singlePathObject
const multiPathFieldsObj = new ObjectType({
  elemID: new ElemID('salto', 'multiPathObj'),
  fields: {
    simple: {
      type: BuiltinTypes.STRING,
    },
    nested: {
      type: nestedType,
    },
  },
  path: ['salto', 'obj', 'multi', 'fields'],
})
// singlePathInstance
const singlePathInstance = new InstanceElement('singlePathInst', singlePathObject, { simple: 'Simple',
  nested: {
    str: 'Str',
    num: 7,
    list: [1, 2, 3],
  } },
['salto', 'inst', 'simple'],)
// multiPathInstance
const multiPathInstance1 = new InstanceElement('multiPathInst', singlePathObject, { simple: 'Simple',
  nested: {
    list: [1, 2, 3],
  } },
['salto', 'inst', 'nested', '1'],)
const multiPathInstance2 = new InstanceElement('multiPathInst', singlePathObject, { nested: {
  str: 'Str',
  num: 7,
} },
['salto', 'inst', 'nested', '2'],)

describe('create path index', () => {
  const pathIndex = createPathIndex([
    singlePathObject,
    singlePathInstance,
    multiPathAnnoObj,
    multiPathFieldsObj,
    multiPathInstance1,
    multiPathInstance2,
  ])
  describe('elements which are defined in a single fragment', () => {
    it('should return the proper path for top level elements', () => {
      const instPath = pathIndex.get(singlePathInstance.elemID.getFullName())
      expect(instPath).toEqual([singlePathInstance.path])

      const objPath = pathIndex.get(singlePathObject.elemID.getFullName())
      expect(objPath).toEqual([singlePathObject.path])
    })
    it('should return the top level element path for nested ids', () => {
      const nestedInstIds = [
        singlePathInstance.elemID.createNestedID('simple'),
        singlePathInstance.elemID.createNestedID('nested'),
        singlePathInstance.elemID.createNestedID('nested').createNestedID('str'),
        singlePathInstance.elemID.createNestedID('nested').createNestedID('num'),
        singlePathInstance.elemID.createNestedID('nested').createNestedID('list'),
      ].map(id => id.getFullName())
      const nestedObjIds = [
        singlePathObject.elemID.createNestedID('field').createNestedID('simple'),
        singlePathObject.elemID.createNestedID('field').createNestedID('nested'),
        singlePathObject.elemID.createNestedID('annotation').createNestedID('simple'),
        singlePathObject.elemID.createNestedID('annotation').createNestedID('nested'),
        singlePathObject.elemID.createNestedID('attr').createNestedID('simple'),
        singlePathObject.elemID.createNestedID('attr').createNestedID('nested'),
        singlePathObject.elemID.createNestedID('attr').createNestedID('nested').createNestedID('str'),
        singlePathObject.elemID.createNestedID('attr').createNestedID('nested').createNestedID('num'),
        singlePathObject.elemID.createNestedID('attr').createNestedID('nested').createNestedID('list'),
      ].map(id => id.getFullName())
      nestedInstIds.forEach(id => expect(pathIndex.get(id)).toEqual([singlePathInstance.path]))
      nestedObjIds.forEach(id => expect(pathIndex.get(id)).toEqual([singlePathObject.path]))
    })
    it('should return the prefix id path if the id is not in the index', () => {
      const id = singlePathObject.elemID.createNestedID('field')
        .createNestedID('simple').createNestedID('nope').getFullName()
      expect(pathIndex.get(id)).toEqual([singlePathObject.path])
    })
    it('should return the proper path for annotations which are not defined as anno types', () => {
      const id = multiPathAnnoObj.elemID.createNestedID('attr')
        .createNestedID('notDefined').getFullName()
      expect(pathIndex.get(id)).toEqual([multiPathAnnoObj.path])
    })
  })
  describe('elements which are defined in a multiple fragments', () => {
    it('should return all paths for top level elements', () => {
      const instPath = pathIndex.get(multiPathInstance1.elemID.getFullName())
      expect(instPath).toEqual([multiPathInstance1.path, multiPathInstance2.path])

      const objPath = pathIndex.get(multiPathAnnoObj.elemID.getFullName())
      expect(objPath).toEqual([multiPathAnnoObj.path, multiPathFieldsObj.path])
    })
    it('should return all paths for nested ids which are defined in multiple fragments', () => {
      const sharedNestedID = multiPathInstance1.elemID.createNestedID('nested').getFullName()
      expect(pathIndex.get(sharedNestedID))
        .toEqual([multiPathInstance1.path, multiPathInstance2.path])
    })
    it('should return the path given in the defining element fragment for nested id', () => {
      const nestedInst1Ids = [
        multiPathInstance1.elemID.createNestedID('simple'),
        multiPathInstance1.elemID.createNestedID('nested').createNestedID('list'),
      ].map(id => id.getFullName())

      const nestedInst2Ids = [
        multiPathInstance2.elemID.createNestedID('nested').createNestedID('str'),
        multiPathInstance2.elemID.createNestedID('nested').createNestedID('num'),
      ].map(id => id.getFullName())

      const nestedObjFieldsIds = [
        multiPathAnnoObj.elemID.createNestedID('field').createNestedID('simple'),
        multiPathAnnoObj.elemID.createNestedID('field').createNestedID('nested'),
      ].map(id => id.getFullName())

      const nestedObjAnnoIds = [
        multiPathAnnoObj.elemID.createNestedID('annotation').createNestedID('simple'),
        multiPathAnnoObj.elemID.createNestedID('annotation').createNestedID('nested'),
        multiPathAnnoObj.elemID.createNestedID('attr').createNestedID('simple'),
        multiPathAnnoObj.elemID.createNestedID('attr').createNestedID('nested'),
        multiPathAnnoObj.elemID.createNestedID('attr').createNestedID('nested').createNestedID('str'),
        multiPathAnnoObj.elemID.createNestedID('attr').createNestedID('nested').createNestedID('num'),
        multiPathAnnoObj.elemID.createNestedID('attr').createNestedID('nested').createNestedID('list'),
      ].map(id => id.getFullName())

      nestedInst1Ids.forEach(id => expect(pathIndex.get(id)).toEqual([multiPathInstance1.path]))
      nestedInst2Ids.forEach(id => expect(pathIndex.get(id)).toEqual([multiPathInstance2.path]))

      nestedObjAnnoIds.forEach(id => expect(pathIndex.get(id)).toEqual([multiPathAnnoObj.path]))
      nestedObjFieldsIds.forEach(id => expect(pathIndex.get(id)).toEqual([multiPathFieldsObj.path]))
    })
  })
  describe('path index serialization', () => {
    it('symmetric operation', () => {
      expect(deserializedPathIndex(serializedPathIndex(pathIndex))).toEqual(pathIndex)
    })
  })
  describe('path index multiple serialization', () => {
    let multipleServicePathIndex: PathIndex
    beforeEach(() => {
      multipleServicePathIndex = createPathIndex([
        singlePathObject,
        singlePathObjectOtherService,
        singlePathInstance,
        multiPathAnnoObj,
        multiPathFieldsObj,
        multiPathInstance1,
        multiPathInstance2,
      ])
    })
    it('symmetric operation on multiple path indexes', () => {
      const serialized = serializePathIndexByService(multipleServicePathIndex)
      expect(deserializedPathsIndex(Object.values(serialized))).toEqual(multipleServicePathIndex)
    })
  })
  describe('complexity', () => {
    it('should not set pathes for unmergeable elements', () => {
      const mockPush = PathIndex.prototype.push as jest.Mock
      expect(mockPush).not.toHaveBeenCalledWith([
        'salto.singlePathObj.instance.multiPathInst.nested.list',
        ['salto', 'inst', 'nested', '1'],
      ])
    })
  })
})

describe('updatePathIndex', () => {
  const pathIndex = createPathIndex([singlePathObject])
  it('should add new elements and maintain old ones', () => {
    const newPathIndex = updatePathIndex(pathIndex, [multiPathAnnoObj], ['salto'])
    let path = newPathIndex.get(singlePathObject.elemID.getFullName())
    expect(path).toEqual([singlePathObject.path])
    path = newPathIndex.get(multiPathAnnoObj.elemID.getFullName())
    expect(path).toEqual([multiPathAnnoObj.path])
  })
})
