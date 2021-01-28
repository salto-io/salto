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
import { ObjectType, ElemID, BuiltinTypes, ListType } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import {
  updatePathIndex, getElementsPathHints, Path,
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
const multiPathAnnoObj = new ObjectType({
  elemID: new ElemID('salto', 'multiPathObj'),
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

describe('updatePathIndex', () => {
  it('should add new elements and maintain old ones', async () => {
    const map = new InMemoryRemoteMap<Path[]>()
    await map.setAll(await getElementsPathHints([singlePathObject]))
    await updatePathIndex(map, [multiPathAnnoObj], ['salto'])
    let path = await map.get(singlePathObject.elemID.getFullName())
    expect(path).toEqual([singlePathObject.path])
    path = await map.get(multiPathAnnoObj.elemID.getFullName())
    expect(path).toEqual([multiPathAnnoObj.path])
  })
})
