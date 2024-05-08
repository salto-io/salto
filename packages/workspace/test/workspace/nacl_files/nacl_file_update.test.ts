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
  updateNaclFileData,
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
  annotations: {
    anno1: 'Annotation 1',
    anno2: 'Annotation 2',
    anno3: 'Annotation 3',
  },
  path: ['this', 'is', 'happening'],
})

const mockInstance = new InstanceElement('mock', mockType, {
  file: 'data.nacl',
  numArray: [1, 2, 3],
  strArray: ['a', 'b', 'c'],
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
      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'this/is/happening.nacl',
            start: { col: 1, line: Infinity, byte: Infinity },
            end: { col: 1, line: Infinity, byte: Infinity },
          },
        },
      ])
    })

    it('should use the default filename when no path is provided', () => {
      const noPath = mockType.clone()
      noPath.path = undefined
      const change: DetailedChange = { ...toChange({ after: noPath }), id: noPath.elemID }
      result = getChangeLocations(change, new Map())
      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'unsorted.nacl',
            start: { col: 1, line: Infinity, byte: Infinity },
            end: { col: 1, line: Infinity, byte: Infinity },
          },
        },
      ])
    })
  })

  describe('with addition of field', () => {
    it('should add the field before a following field', () => {
      const change: DetailedChange = {
        ...toChange({ after: mockType.fields.numArray }),
        id: mockType.fields.numArray.elemID,
        baseChange: toChange({ after: mockType }),
        path: ['file'],
      }
      const sourceMap = new Map([
        [
          mockType.fields.obj.elemID.getFullName(),
          [
            {
              filename: 'file.nacl',
              start: { line: 2, col: 5, byte: 12 },
              end: { line: 5, col: 5, byte: 26 },
            },
          ],
        ],
      ])
      result = getChangeLocations(change, sourceMap)
      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: { line: 2, col: 5, byte: 12 },
            end: { line: 2, col: 5, byte: 12 },
          },
          indexInParent: 1,
        },
      ])
    })

    it('should add the field at the end of the parent when no following fields are found', () => {
      const change: DetailedChange = {
        ...toChange({ after: mockType.fields.numArray }),
        id: mockType.fields.numArray.elemID,
        baseChange: toChange({ after: mockType }),
        path: ['file'],
      }
      const sourceMap = new Map([
        [
          mockType.elemID.getFullName(),
          [
            {
              filename: 'file.nacl',
              start: { line: 1, col: 1, byte: 0 },
              end: { line: 10, col: 2, byte: 126 },
            },
          ],
        ],
        [
          mockType.fields.file.elemID.getFullName(),
          [
            {
              filename: 'file.nacl',
              start: { line: 2, col: 5, byte: 12 },
              end: { line: 5, col: 5, byte: 26 },
            },
          ],
        ],
      ])
      result = getChangeLocations(change, sourceMap)
      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: { line: 10, col: 1, byte: 125 },
            end: { line: 10, col: 1, byte: 125 },
          },
          requiresIndent: true,
        },
      ])
    })

    it("should add the field to the end of the file when the parent isn't in the source map", () => {
      const change: DetailedChange = {
        ...toChange({ after: mockType.fields.numArray }),
        id: mockType.fields.numArray.elemID,
        baseChange: toChange({ after: mockType }),
        path: ['file'],
      }
      result = getChangeLocations(change, new Map())
      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: { line: Infinity, col: 1, byte: Infinity },
            end: { line: Infinity, col: 1, byte: Infinity },
          },
        },
      ])
    })

    it('should add the field to the end of the parent when the base change is undefined', () => {
      const change: DetailedChange = {
        ...toChange({ after: mockType.fields.numArray }),
        id: mockType.fields.numArray.elemID,
        path: ['file'],
      }
      const sourceMap = new Map([
        [
          mockType.elemID.getFullName(),
          [
            {
              filename: 'file.nacl',
              start: { line: 1, col: 1, byte: 0 },
              end: { line: 10, col: 2, byte: 126 },
            },
          ],
        ],
        [
          mockType.fields.obj.elemID.getFullName(),
          [
            {
              filename: 'file.nacl',
              start: { line: 2, col: 5, byte: 12 },
              end: { line: 5, col: 5, byte: 26 },
            },
          ],
        ],
      ])
      result = getChangeLocations(change, sourceMap)
      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: { line: 10, col: 1, byte: 125 },
            end: { line: 10, col: 1, byte: 125 },
          },
          requiresIndent: true,
        },
      ])
    })
  })

  describe('with addition of annotation', () => {
    it('should add the annotation before a following annotation', () => {
      const change: DetailedChange = {
        ...toChange({ after: mockType.annotations.anno2 }),
        id: mockType.elemID.createNestedID('attr', 'anno2'),
        baseChange: toChange({ after: mockType }),
        path: ['file'],
      }
      const sourceMap = new Map([
        [
          mockType.elemID.createNestedID('attr', 'anno3').getFullName(),
          [
            {
              filename: 'file.nacl',
              start: { line: 2, col: 5, byte: 12 },
              end: { line: 5, col: 5, byte: 26 },
            },
          ],
        ],
      ])
      result = getChangeLocations(change, sourceMap)
      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: { line: 2, col: 5, byte: 12 },
            end: { line: 2, col: 5, byte: 12 },
          },
          indexInParent: 1,
        },
      ])
    })
  })

  describe('with addition of value', () => {
    it('should add the value before a following value', () => {
      const change: DetailedChange = {
        ...toChange({ after: mockInstance.value.numArray }),
        id: mockInstance.elemID.createNestedID('numArray'),
        baseChange: toChange({ after: mockInstance }),
        path: ['file'],
      }
      const sourceMap = new Map([
        [
          mockInstance.elemID.createNestedID('strArray').getFullName(),
          [
            {
              filename: 'file.nacl',
              start: { line: 2, col: 5, byte: 12 },
              end: { line: 5, col: 5, byte: 26 },
            },
          ],
        ],
      ])
      result = getChangeLocations(change, sourceMap)
      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: { line: 2, col: 5, byte: 12 },
            end: { line: 2, col: 5, byte: 12 },
          },
          indexInParent: 1,
        },
      ])
    })
  })
})

describe('updateNaclFileData', () => {
  let changes: DetailedChangeWithSource[]

  const mockTypeNacl = `type salto.mock {
  string file {
  }
  "List<number>" numArray {
  }
  "List<string>" strArray {
  }
  "List<salto.obj>" obj {
  }
  anno1 = "Annotation 1"
  anno2 = "Annotation 2"
  anno3 = "Annotation 3"
}
`

  const mockTypeMissingEndNacl = `type salto.mock {
  string file {
  }
  "List<number>" numArray {
  }
  "List<string>" strArray {
  }
  anno1 = "Annotation 1"
  anno2 = "Annotation 2"
  anno3 = "Annotation 3"
}
`

  const mockTypeMissingMiddleNacl = `type salto.mock {
  string file {
  }
  "List<string>" strArray {
  }
  "List<salto.obj>" obj {
  }
  anno1 = "Annotation 1"
  anno2 = "Annotation 2"
  anno3 = "Annotation 3"
}
`

  const mockTypeMissingMultipleMiddleNacl = `type salto.mock {
  string file {
  }
  "List<salto.obj>" obj {
  }
  anno1 = "Annotation 1"
  anno2 = "Annotation 2"
  anno3 = "Annotation 3"
}
`

  describe('when the data is empty and there is an element addition', () => {
    beforeEach(() => {
      changes = [
        {
          ...toChange({ after: mockType }),
          id: mockType.elemID,
          location: {
            filename: 'file',
            start: { col: 1, line: Infinity, byte: Infinity },
            end: { col: 1, line: Infinity, byte: Infinity },
          },
        },
      ]
    })

    it('should add the element to the data', async () => {
      const result = await updateNaclFileData('', changes, {})
      expect(result).toEqual(mockTypeNacl)
    })
  })

  describe('when data contains an element which is removed', () => {
    beforeAll(() => {
      changes = [
        {
          ...toChange({ before: mockType }),
          id: mockType.elemID,
          location: {
            filename: 'file',
            start: { col: 0, line: 0, byte: 0 },
            end: { col: 1, line: 10, byte: mockTypeNacl.length },
          },
        },
      ]
    })

    it('should return an empty result', async () => {
      const result = await updateNaclFileData(mockTypeNacl, changes, {})
      expect(result).toEqual('')
    })
  })

  describe('when data contains an element to which fields are added at the end', () => {
    beforeAll(() => {
      changes = [
        {
          ...toChange({ after: mockType.fields.obj }),
          id: mockType.fields.obj.elemID,
          location: {
            filename: 'file',
            start: { col: 1, line: 7, byte: 102 },
            end: { col: 1, line: 7, byte: 102 },
          },
          requiresIndent: true,
        },
      ]
    })

    it('should add the fields to the element', async () => {
      const result = await updateNaclFileData(mockTypeMissingEndNacl, changes, {})
      expect(result).toEqual(mockTypeNacl)
    })
  })

  describe('when data contains an element to which fields are added in the middle', () => {
    beforeAll(() => {
      changes = [
        {
          ...toChange({ after: mockType.fields.numArray }),
          id: mockType.fields.numArray.elemID,
          location: {
            filename: 'file',
            start: { col: 3, line: 3, byte: 40 },
            end: { col: 3, line: 3, byte: 40 },
          },
        },
      ]
    })

    it('should add the fields to the element', async () => {
      const result = await updateNaclFileData(mockTypeMissingMiddleNacl, changes, {})
      expect(result).toEqual(mockTypeNacl)
    })
  })

  describe('when data contains an element to which multiple fields are added in the middle', () => {
    beforeAll(() => {
      changes = [
        {
          ...toChange({ after: mockType.fields.strArray }),
          id: mockType.fields.numArray.elemID,
          location: {
            filename: 'file',
            start: { col: 3, line: 3, byte: 40 },
            end: { col: 3, line: 3, byte: 40 },
          },
          indexInParent: 3,
        },
        {
          ...toChange({ after: mockType.fields.numArray }),
          id: mockType.fields.numArray.elemID,
          location: {
            filename: 'file',
            start: { col: 3, line: 3, byte: 40 },
            end: { col: 3, line: 3, byte: 40 },
          },
          indexInParent: 2,
        },
      ]
    })

    it('should add the fields to the element in order', async () => {
      const result = await updateNaclFileData(mockTypeMissingMultipleMiddleNacl, changes, {})
      expect(result).toEqual(mockTypeNacl)
    })
  })

  describe('when data contains an element from which a field is removed at the end', () => {
    beforeAll(() => {
      changes = [
        {
          ...toChange({ before: mockType.fields.obj }),
          id: mockType.fields.obj.elemID,
          location: {
            filename: 'file',
            start: { col: 2, line: 7, byte: 102 },
            end: { col: 2, line: 8, byte: 131 },
          },
        },
      ]
    })

    it('should remove the field and preceding whitespaces from the element', async () => {
      const result = await updateNaclFileData(mockTypeNacl, changes, {})
      expect(result).toEqual(mockTypeMissingEndNacl)
    })
  })

  describe('when data contains an element from which a field is removed in the middle', () => {
    beforeAll(() => {
      changes = [
        {
          ...toChange({ before: mockType.fields.numArray }),
          id: mockType.fields.numArray.elemID,
          location: {
            filename: 'file',
            start: { col: 2, line: 3, byte: 39 },
            end: { col: 2, line: 4, byte: 69 },
          },
        },
      ]
    })

    it('should remove the field and preceding whitespaces from the element', async () => {
      const result = await updateNaclFileData(mockTypeNacl, changes, {})
      expect(result).toEqual(mockTypeMissingMiddleNacl)
    })
  })
})
