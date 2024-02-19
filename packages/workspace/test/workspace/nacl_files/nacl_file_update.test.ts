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
import {
  InstanceElement,
  StaticFile,
  ElemID,
  BuiltinTypes,
  ObjectType,
  ListType,
  toChange,
  DetailedChange,
} from '@salto-io/adapter-api'
import {
  getNestedStaticFiles,
  getChangeLocations,
  DetailedChangeWithSource,
} from '../../../src/workspace/nacl_files/nacl_file_update'

const mockType = new ObjectType({
  elemID: new ElemID('salto', 'mock'),
  fields: {
    file: { refType: BuiltinTypes.STRING },
    numArray: { refType: new ListType(BuiltinTypes.NUMBER) },
    strArray: { refType: new ListType(BuiltinTypes.STRING) },
    obj: {
      refType: new ListType(
        new ObjectType({
          elemID: new ElemID('salto', 'obj'),
          fields: {
            field: { refType: BuiltinTypes.STRING },
          },
        }),
      ),
    },
  },
  path: ['this', 'is', 'happening'],
})

describe('getNestedStaticFiles', () => {
  const mockInstanceWithFiles = new InstanceElement(
    'mockInstance',
    mockType,
    {
      numArray: ['12', '13', new StaticFile({ filepath: 'arr', hash: 'X' })],
      strArray: 'should be list',
      file: new StaticFile({ filepath: 'plain', hash: 'X' }),
      obj: [
        {
          field: new StaticFile({ filepath: 'obj', hash: 'X' }),
        },
      ],
    },
    ['yes', 'this', 'is', 'path'],
  )

  it('should detect all files when starting with an element', () => {
    expect(
      getNestedStaticFiles(mockInstanceWithFiles)
        .map(f => f.filepath)
        .sort(),
    ).toEqual(['arr', 'plain', 'obj'].sort())
  })

  it('should detect all files when starting with an object', () => {
    expect(getNestedStaticFiles(mockInstanceWithFiles.value.obj[0]).map(f => f.filepath)).toEqual(['obj'])
  })

  it('should detect all files when starting with an array', () => {
    expect(getNestedStaticFiles(mockInstanceWithFiles.value.numArray).map(f => f.filepath)).toEqual(['arr'])
  })

  it('should detect the file when starting with a plain attribute', () => {
    expect(getNestedStaticFiles(mockInstanceWithFiles.value.file).map(f => f.filepath)).toEqual(['plain'])
  })
})

describe('getChangeLocations', () => {
  let result: DetailedChangeWithSource[]
  describe('with addition of top level element', () => {
    it('should add the element at the end of the file', () => {
      const change: DetailedChange = { ...toChange({ after: mockType }), id: mockType.elemID }
      result = getChangeLocations(change, new Map())
      expect(result).toHaveLength(1)
      expect(result[0].location.start).toEqual({ col: 1, line: Infinity, byte: Infinity })
      expect(result[0].location.end).toEqual({ col: 1, line: Infinity, byte: Infinity })
      expect(result[0].location.filename).toEqual('this/is/happening.nacl')
    })
    it('should use the default filename when no path is provided', () => {
      const noPath = mockType.clone()
      noPath.path = undefined
      const change: DetailedChange = { ...toChange({ after: noPath }), id: noPath.elemID }
      result = getChangeLocations(change, new Map())
      expect(result).toHaveLength(1)
      expect(result[0].location.start).toEqual({ col: 1, line: Infinity, byte: Infinity })
      expect(result[0].location.end).toEqual({ col: 1, line: Infinity, byte: Infinity })
      expect(result[0].location.filename).toEqual('unsorted.nacl')
    })
  })
})
