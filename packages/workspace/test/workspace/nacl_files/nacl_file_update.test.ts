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
  Element,
  BuiltinTypes,
  ObjectType,
  ListType,
  toChange,
  DetailedChange,
} from '@salto-io/adapter-api'
import { dumpElements, parse, SourceMap } from '@salto-io/parser/src/parser'
import { SourcePos } from '@salto-io/parser/src/parser/internal/types'
import {
  getNestedStaticFiles,
  getChangeLocations,
  DetailedChangeWithSource,
  updateNaclFileData,
} from '../../../src/workspace/nacl_files/nacl_file_update'

const createMockType = ({
  dropFields = [],
  withAnnotations = false,
  dropAnnotations = [],
}: {
  dropFields?: ('file' | 'numArray' | 'strArray' | 'obj')[]
  withAnnotations?: boolean
  dropAnnotations?: ('anno1' | 'anno2' | 'anno3')[]
}): ObjectType => {
  const fields = {
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
  }
  dropFields.forEach(field => delete fields[field])

  const annotations = {
    anno1: 'Annotation 1',
    anno2: 'Annotation 2',
    anno3: 'Annotation 3',
  }
  dropAnnotations.forEach(annotation => delete annotations[annotation])

  return new ObjectType({
    elemID: new ElemID('salto', 'mock'),
    fields,
    annotations: withAnnotations ? annotations : undefined,
    path: ['this', 'is', 'happening'],
  })
}

const createMockInstance = (withAnnotations = false): InstanceElement =>
  new InstanceElement('mock', createMockType({ withAnnotations }), {
    file: 'data.nacl',
    numArray: [1, 2, 3],
    strArray: ['a', 'b', 'c'],
  })

describe('getNestedStaticFiles', () => {
  const mockInstanceWithFiles = new InstanceElement(
    'mockInstance',
    createMockType({}),
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
  const sourceMapForElement = async (elem: Element): Promise<SourceMap> =>
    (await parse(Buffer.from(await dumpElements([elem])), 'file.nacl')).sourceMap

  const locationForElement = (elemID: ElemID, sourceMap: SourceMap, member: 'start' | 'end' = 'start'): SourcePos => {
    const pos = sourceMap.get(elemID.getFullName())?.[0][member]
    if (pos === undefined) {
      throw new Error('location is undefined')
    }
    pos.col -= 1
    pos.byte -= 1
    return pos
  }

  describe('with addition of top level element', () => {
    it('should add the element at the end of the file', () => {
      const mockType = createMockType({})
      const change: DetailedChange = { ...toChange({ after: mockType }), id: mockType.elemID }
      const result = getChangeLocations(change, new Map())
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
      const noPath = createMockType({})
      noPath.path = undefined
      const change: DetailedChange = { ...toChange({ after: noPath }), id: noPath.elemID }
      const result = getChangeLocations(change, new Map())
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
    it('should add the field before a following field', async () => {
      const mockTypeBefore = createMockType({ dropFields: ['numArray'] })
      const mockType = createMockType({})
      const change: DetailedChange = {
        ...toChange({ after: mockType.fields.numArray }),
        id: mockType.fields.numArray.elemID,
        baseChange: toChange({ before: mockTypeBefore, after: mockType }),
        path: ['file'],
      }
      const sourceMap = await sourceMapForElement(mockTypeBefore)
      const result = getChangeLocations(change, sourceMap)
      const pos = locationForElement(mockTypeBefore.fields.strArray.elemID, sourceMap)

      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: pos,
            end: pos,
            indexInParent: 1,
          },
        },
      ])
    })

    it('should add the field at the end of the parent when no following fields are found', async () => {
      const mockTypeBefore = createMockType({ dropFields: ['obj'] })
      const mockType = createMockType({})
      const change: DetailedChange = {
        ...toChange({ after: mockType.fields.obj }),
        id: mockType.fields.obj.elemID,
        baseChange: toChange({ before: mockTypeBefore, after: mockType }),
        path: ['file'],
      }
      const sourceMap = await sourceMapForElement(mockTypeBefore)
      const result = getChangeLocations(change, sourceMap)
      const pos = locationForElement(mockTypeBefore.elemID, sourceMap, 'end')

      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: pos,
            end: pos,
          },
          requiresIndent: true,
        },
      ])
    })

    it("should add the field to the end of the file when the parent isn't in the source map", () => {
      const mockType = createMockType({})
      const change: DetailedChange = {
        ...toChange({ after: mockType.fields.numArray }),
        id: mockType.fields.numArray.elemID,
        baseChange: toChange({ before: createMockType({ dropFields: ['numArray'] }), after: mockType }),
        path: ['file'],
      }
      const result = getChangeLocations(change, new Map())
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

    it('should add the field to the end of the parent when the base change is undefined', async () => {
      const mockType = createMockType({})
      const change: DetailedChange = {
        ...toChange({ after: mockType.fields.numArray }),
        id: mockType.fields.numArray.elemID,
        path: ['file'],
      }
      const sourceMap = await sourceMapForElement(mockType)
      const result = getChangeLocations(change, sourceMap)
      const pos = locationForElement(mockType.elemID, sourceMap, 'end')

      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: pos,
            end: pos,
          },
          requiresIndent: true,
        },
      ])
    })
  })

  describe('with addition of annotation', () => {
    it('should add the annotation before a following annotation', async () => {
      const mockTypeBefore = createMockType({ withAnnotations: true, dropAnnotations: ['anno2'] })
      const mockType = createMockType({ withAnnotations: true })
      const change: DetailedChange = {
        ...toChange({ after: mockType.annotations.anno2 }),
        id: mockType.elemID.createNestedID('attr', 'anno2'),
        baseChange: toChange({
          before: mockTypeBefore,
          after: mockType,
        }),
        path: ['file'],
      }
      const sourceMap = await sourceMapForElement(mockTypeBefore)
      const result = getChangeLocations(change, sourceMap)
      const pos = locationForElement(mockType.elemID.createNestedID('attr', 'anno3'), sourceMap)

      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: pos,
            end: pos,
            indexInParent: 1,
          },
        },
      ])
    })
  })

  describe('with addition of value', () => {
    it('should add the value before a following value', async () => {
      const mockInstanceBefore = new InstanceElement('mock', createMockType({}), {
        file: 'data.nacl',
        strArray: ['a', 'b', 'c'],
      })
      const mockInstance = createMockInstance()
      const change: DetailedChange = {
        ...toChange({ after: mockInstance.value.numArray }),
        id: mockInstance.elemID.createNestedID('numArray'),
        baseChange: toChange({
          before: mockInstanceBefore,
          after: mockInstance,
        }),
        path: ['file'],
      }
      const sourceMap = await sourceMapForElement(mockInstanceBefore)
      const result = getChangeLocations(change, sourceMap)
      const pos = locationForElement(mockInstance.elemID.createNestedID('strArray'), sourceMap)

      expect(result).toEqual([
        {
          ...change,
          location: {
            filename: 'file.nacl',
            start: pos,
            end: pos,
            indexInParent: 1,
          },
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
}
`

  const mockTypeMissingEndNacl = `type salto.mock {
  string file {
  }
  "List<number>" numArray {
  }
  "List<string>" strArray {
  }
}
`

  const mockTypeMissingMiddleNacl = `type salto.mock {
  string file {
  }
  "List<string>" strArray {
  }
  "List<salto.obj>" obj {
  }
}
`

  const mockTypeMissingMultipleMiddleNacl = `type salto.mock {
  string file {
  }
  "List<salto.obj>" obj {
  }
}
`

  describe('when the data is empty and there is an element addition', () => {
    beforeEach(() => {
      const mockType = createMockType({})
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
      const mockType = createMockType({})
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
      const mockType = createMockType({})
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
      const mockType = createMockType({})
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
      const mockType = createMockType({})
      changes = [
        {
          ...toChange({ after: mockType.fields.strArray }),
          id: mockType.fields.numArray.elemID,
          location: {
            filename: 'file',
            start: { col: 3, line: 3, byte: 40 },
            end: { col: 3, line: 3, byte: 40 },
            indexInParent: 3,
          },
        },
        {
          ...toChange({ after: mockType.fields.numArray }),
          id: mockType.fields.numArray.elemID,
          location: {
            filename: 'file',
            start: { col: 3, line: 3, byte: 40 },
            end: { col: 3, line: 3, byte: 40 },
            indexInParent: 2,
          },
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
      const mockType = createMockType({})
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
      const mockType = createMockType({})
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
