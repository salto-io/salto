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
import { InstanceElement, StaticFile, ElemID, BuiltinTypes, ObjectType, ListType } from '@salto-io/adapter-api'
import { getNestedStaticFiles, getChangeLocations } from '../../../src/workspace/nacl_files/nacl_file_update'
import { SourceRange } from '../../../src/parser'

const mockType = new ObjectType({
  elemID: new ElemID('salto', 'mock'),
  fields: {
    file: { type: BuiltinTypes.STRING },
    numArray: { type: new ListType(BuiltinTypes.NUMBER) },
    strArray: { type: new ListType(BuiltinTypes.STRING) },
    obj: {
      type: new ListType(new ObjectType({
        elemID: new ElemID('salto', 'obj'),
        fields: {
          field: { type: BuiltinTypes.STRING },
        },
      })),
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
    expect(getNestedStaticFiles(mockInstanceWithFiles).map(f => f.filepath)).toEqual([
      'arr',
      'plain',
      'obj',
    ])
  })

  it('should detect all files when starting with an object', () => {
    expect(getNestedStaticFiles(mockInstanceWithFiles.value.obj[0]).map(f => f.filepath))
      .toEqual([
        'obj',
      ])
  })

  it('should detect all files when starting with an array', () => {
    expect(getNestedStaticFiles(mockInstanceWithFiles.value.numArray).map(f => f.filepath))
      .toEqual([
        'arr',
      ])
  })

  it('should detect the file when starting with a plain attribute', () => {
    expect(getNestedStaticFiles(mockInstanceWithFiles.value.file).map(f => f.filepath))
      .toEqual([
        'plain',
      ])
  })
})

describe('getChangeLocations', () => {
  it('should use eof when adding new elements that are not found in the source map', () => {
    expect(getChangeLocations(
      {
        action: 'add',
        data: { after: { new: 'data' } },
        id: new ElemID('salesforce', 'type', 'instance', 'name'),
      },
      new Map<string, SourceRange[]>(),
    )[0].location).toEqual({
      filename: '',
      start: { col: 1, line: 1, byte: 0 },
      end: { col: 1, line: 1, byte: 0 },
      // if there are existing elements in the file, don't override them
      eof: true,
    })
  })
})
