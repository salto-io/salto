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
  Field,
  Change,
} from '@salto-io/adapter-api'
import { dumpElements, parse, SourceMap } from '@salto-io/parser/src/parser'
import { getDetailedChanges } from '@salto-io/adapter-utils'
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
  metaType,
}: {
  dropFields?: ('file' | 'numArray' | 'strArray' | 'obj')[]
  withAnnotations?: boolean
  dropAnnotations?: ('anno1' | 'anno2' | 'anno3')[]
  metaType?: ObjectType
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
    metaType,
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
    return member === 'start'
      ? { ...pos }
      : {
          ...pos,
          col: pos.col - 1,
          byte: pos.byte - 1,
        }
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
            indexInParent: 3,
            newInParent: true,
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
      const newField = new Field(mockType, 'newField', BuiltinTypes.STRING)
      const change: DetailedChange = {
        ...toChange({ after: newField }),
        id: newField.elemID,
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
            newInParent: true,
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

  describe('with list changes', () => {
    let instance: InstanceElement
    let sourceMap: SourceMap
    let baseChange: Change
    let result: DetailedChangeWithSource[]

    beforeEach(async () => {
      instance = createMockInstance()
      baseChange = toChange({ before: createMockInstance(), after: instance })
      sourceMap = await sourceMapForElement(instance)
    })

    describe('when item is added', () => {
      beforeEach(() => {
        instance.value.strArray = ['x'].concat(instance.value.strArray)
        const changes = getDetailedChanges(baseChange, { compareListItems: true })
        result = changes.flatMap(change => getChangeLocations(change, sourceMap))
      })
      it('should return all changes', () => {
        expect(result).toHaveLength(4)
      })
      it('should have addition change', () => {
        const additionChange = result.find(change =>
          change.elemIDs?.after?.isEqual(instance.elemID.createNestedID('strArray', '0')),
        )
        expect(additionChange).toEqual({
          id: instance.elemID.createNestedID('strArray', '0'),
          elemIDs: { after: instance.elemID.createNestedID('strArray', '0') },
          action: 'add',
          data: { after: 'x' },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray', '0').getFullName())?.[0],
        })
      })
      it('should have modification changes', () => {
        const modificationChange1 = result.find(change =>
          change.elemIDs?.before?.isEqual(instance.elemID.createNestedID('strArray', '0')),
        )
        const modificationChange2 = result.find(change =>
          change.elemIDs?.before?.isEqual(instance.elemID.createNestedID('strArray', '1')),
        )
        const modificationChange3 = result.find(change =>
          change.elemIDs?.before?.isEqual(instance.elemID.createNestedID('strArray', '2')),
        )
        expect(modificationChange1).toEqual({
          id: instance.elemID.createNestedID('strArray', '1'),
          elemIDs: {
            before: instance.elemID.createNestedID('strArray', '0'),
            after: instance.elemID.createNestedID('strArray', '1'),
          },
          action: 'modify',
          data: { before: 'a', after: 'a' },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray', '1').getFullName())?.[0],
        })
        expect(modificationChange2).toEqual({
          id: instance.elemID.createNestedID('strArray', '2'),
          elemIDs: {
            before: instance.elemID.createNestedID('strArray', '1'),
            after: instance.elemID.createNestedID('strArray', '2'),
          },
          action: 'modify',
          data: { before: 'b', after: 'b' },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray', '2').getFullName())?.[0],
        })
        expect(modificationChange3).toEqual({
          id: instance.elemID.createNestedID('strArray', '3'),
          elemIDs: {
            before: instance.elemID.createNestedID('strArray', '2'),
            after: instance.elemID.createNestedID('strArray', '3'),
          },
          action: 'modify',
          data: { before: 'c', after: 'c' },
          baseChange,
          location: {
            filename: 'file.nacl',
            start: locationForElement(instance.elemID.createNestedID('strArray'), sourceMap, 'end'),
            end: locationForElement(instance.elemID.createNestedID('strArray'), sourceMap, 'end'),
            indexInParent: 3,
            newInParent: true,
          },
          requiresIndent: true,
        })
      })
    })

    describe('when item is removed', () => {
      beforeEach(() => {
        instance.value.strArray = instance.value.strArray.slice(1)
        const changes = getDetailedChanges(baseChange, { compareListItems: true })
        result = changes.flatMap(change => getChangeLocations(change, sourceMap))
      })
      it('should return all changes', () => {
        expect(result).toHaveLength(3)
      })
      it('should have removal change', () => {
        const removalChange = result.find(change =>
          change.elemIDs?.before?.isEqual(instance.elemID.createNestedID('strArray', '0')),
        )
        expect(removalChange).toEqual({
          id: instance.elemID.createNestedID('strArray', '0'),
          elemIDs: { before: instance.elemID.createNestedID('strArray', '0') },
          action: 'remove',
          data: { before: 'a' },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray', '0').getFullName())?.[0],
        })
      })
      it('should have modification change', () => {
        const modificationChange = result.find(change =>
          change.elemIDs?.before?.isEqual(instance.elemID.createNestedID('strArray', '1')),
        )
        expect(modificationChange).toEqual({
          id: instance.elemID.createNestedID('strArray', '1'),
          elemIDs: {
            before: instance.elemID.createNestedID('strArray', '1'),
            after: instance.elemID.createNestedID('strArray', '0'),
          },
          action: 'modify',
          data: { before: 'b', after: 'b' },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray', '0').getFullName())?.[0],
        })
      })
      it('should have a change for the new last item in the list', () => {
        const modificationChange = result.find(
          change => change.id.isEqual(instance.elemID.createNestedID('strArray', '1')) && change.elemIDs === undefined,
        )
        expect(modificationChange).toEqual({
          id: instance.elemID.createNestedID('strArray', '1'),
          action: 'modify',
          data: { before: 'b', after: 'c' },
          baseChange,
          location: {
            ...sourceMap.get(instance.elemID.createNestedID('strArray', '1').getFullName())?.[0],
            end: sourceMap.get(instance.elemID.createNestedID('strArray', '2').getFullName())?.[0].end,
          },
        })
      })
    })

    describe('when there are position changes', () => {
      beforeEach(() => {
        instance.value.strArray = [instance.value.strArray[1], instance.value.strArray[0]].concat(
          instance.value.strArray.slice(2),
        )

        const changes = getDetailedChanges(baseChange, { compareListItems: true })
        result = changes.flatMap(change => getChangeLocations(change, sourceMap))
      })
      it('should return all changes', () => {
        expect(result).toHaveLength(2)
      })
      it('should have modification changes', () => {
        const modificationChange1 = result.find(change =>
          change.elemIDs?.before?.isEqual(instance.elemID.createNestedID('strArray', '0')),
        )
        const modificationChange2 = result.find(change =>
          change.elemIDs?.before?.isEqual(instance.elemID.createNestedID('strArray', '1')),
        )
        expect(modificationChange1).toEqual({
          id: instance.elemID.createNestedID('strArray', '1'),
          elemIDs: {
            before: instance.elemID.createNestedID('strArray', '0'),
            after: instance.elemID.createNestedID('strArray', '1'),
          },
          action: 'modify',
          data: { before: 'a', after: 'a' },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray', '1').getFullName())?.[0],
        })
        expect(modificationChange2).toEqual({
          id: instance.elemID.createNestedID('strArray', '0'),
          elemIDs: {
            before: instance.elemID.createNestedID('strArray', '1'),
            after: instance.elemID.createNestedID('strArray', '0'),
          },
          action: 'modify',
          data: { before: 'b', after: 'b' },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray', '0').getFullName())?.[0],
        })
      })
    })

    describe('when all items were removed', () => {
      beforeEach(() => {
        instance.value.strArray = []

        const changes = getDetailedChanges(baseChange, { compareListItems: true })
        result = changes.flatMap(change => getChangeLocations(change, sourceMap))
      })
      it('should have only one change on the list', () => {
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
          id: instance.elemID.createNestedID('strArray'),
          action: 'modify',
          data: { before: ['a', 'b', 'c'], after: [] },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray').getFullName())?.[0],
        })
      })
    })

    describe('when there are mixed changes', () => {
      beforeEach(() => {
        instance.value.strArray = ['c', 'd']

        const changes = getDetailedChanges(baseChange, { compareListItems: true })
        result = changes.flatMap(change => getChangeLocations(change, sourceMap))
      })
      it('should return all changes', () => {
        expect(result).toHaveLength(3)
      })
      it('should have modification change', () => {
        const modificationChange = result.find(change =>
          change.elemIDs?.before?.isEqual(instance.elemID.createNestedID('strArray', '2')),
        )
        expect(modificationChange).toEqual({
          id: instance.elemID.createNestedID('strArray', '1'),
          elemIDs: {
            before: instance.elemID.createNestedID('strArray', '2'),
            after: instance.elemID.createNestedID('strArray', '0'),
          },
          action: 'modify',
          data: { before: 'c', after: 'c' },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray', '0').getFullName())?.[0],
        })
      })
      it('should have removal change', () => {
        const removalChange = result.find(change =>
          change.elemIDs?.before?.isEqual(instance.elemID.createNestedID('strArray', '0')),
        )
        expect(removalChange).toEqual({
          id: instance.elemID.createNestedID('strArray', '0'),
          elemIDs: {
            before: instance.elemID.createNestedID('strArray', '0'),
          },
          action: 'remove',
          data: { before: 'a' },
          baseChange,
          location: sourceMap.get(instance.elemID.createNestedID('strArray', '0').getFullName())?.[0],
        })
      })
      it('should have a change for the new last item in the list', () => {
        const modificationChange = result.find(
          change => change.id.isEqual(instance.elemID.createNestedID('strArray', '1')) && change.elemIDs === undefined,
        )
        expect(modificationChange).toEqual({
          id: instance.elemID.createNestedID('strArray', '1'),
          action: 'modify',
          data: { before: 'b', after: 'd' },
          baseChange,
          location: {
            ...sourceMap.get(instance.elemID.createNestedID('strArray', '1').getFullName())?.[0],
            end: sourceMap.get(instance.elemID.createNestedID('strArray', '2').getFullName())?.[0].end,
          },
        })
      })
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

  const mockTypeMetaNacl = `type salto.mock is salto.meta {
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
            start: { col: 1, line: 0, byte: 0 },
            end: { col: 2, line: 9, byte: mockTypeNacl.length - 1 },
          },
        },
      ]
    })

    it('should return a newline', async () => {
      const result = await updateNaclFileData(mockTypeNacl, changes, {})
      expect(result).toEqual('\n')
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

  describe('when data contains an element which is completely replaced', () => {
    beforeAll(() => {
      const mockType = createMockType({
        metaType: new ObjectType({ elemID: new ElemID('salto', 'meta') }),
      })
      changes = [
        {
          ...toChange({ before: createMockType({}), after: mockType }),
          id: mockType.elemID,
          location: {
            filename: 'file',
            start: { col: 1, line: 0, byte: 0 },
            end: { col: 1, line: 9, byte: mockTypeNacl.length - 1 },
          },
        },
      ]
    })

    it('should add the element to the data', async () => {
      const result = await updateNaclFileData(mockTypeNacl, changes, {})
      expect(result).toEqual(mockTypeMetaNacl)
    })
  })

  describe('when list is updated', () => {
    let instance: InstanceElement
    let currentData: string
    let sourceMap: SourceMap
    let baseChange: Change
    let result: string

    beforeEach(async () => {
      instance = createMockInstance()
      baseChange = toChange({ before: createMockInstance(), after: instance })
      currentData = await dumpElements([instance])
      sourceMap = (await parse(Buffer.from(currentData), 'file.nacl')).sourceMap
    })

    describe('when item is added', () => {
      beforeEach(async () => {
        instance.value.strArray = ['x'].concat(instance.value.strArray)
        result = await updateNaclFileData(
          currentData,
          getDetailedChanges(baseChange, { compareListItems: true }).flatMap(change =>
            getChangeLocations(change, sourceMap),
          ),
          {},
        )
      })
      it('should dump correctly', () => {
        expect(result).toMatch(`strArray = [
    "x",
    "a",
    "b",
    "c",
  ]`)
      })
    })

    describe('when item is removed', () => {
      beforeEach(async () => {
        instance.value.strArray = instance.value.strArray.slice(1)
        result = await updateNaclFileData(
          currentData,
          getDetailedChanges(baseChange, { compareListItems: true }).flatMap(change =>
            getChangeLocations(change, sourceMap),
          ),
          {},
        )
      })
      it('should dump correctly', () => {
        expect(result).toMatch(`strArray = [
    "b",
    "c",
  ]`)
      })
    })

    describe('when there are position changes', () => {
      beforeEach(async () => {
        instance.value.strArray = [instance.value.strArray[1], instance.value.strArray[0]].concat(
          instance.value.strArray.slice(2),
        )
        result = await updateNaclFileData(
          currentData,
          getDetailedChanges(baseChange, { compareListItems: true }).flatMap(change =>
            getChangeLocations(change, sourceMap),
          ),
          {},
        )
      })
      it('should dump correctly', () => {
        expect(result).toMatch(`strArray = [
    "b",
    "a",
    "c",
  ]`)
      })
    })

    describe('when all items were removed', () => {
      beforeEach(async () => {
        instance.value.strArray = []
        result = await updateNaclFileData(
          currentData,
          getDetailedChanges(baseChange, { compareListItems: true }).flatMap(change =>
            getChangeLocations(change, sourceMap),
          ),
          {},
        )
      })
      it('should dump correctly', () => {
        expect(result).toMatch(`strArray = [
  ]`)
      })
    })

    describe('when there are mixed changes', () => {
      beforeEach(async () => {
        instance.value.strArray = ['c', 'd']
        result = await updateNaclFileData(
          currentData,
          getDetailedChanges(baseChange, { compareListItems: true }).flatMap(change =>
            getChangeLocations(change, sourceMap),
          ),
          {},
        )
      })
      it('should dump correctly', () => {
        expect(result).toMatch(`strArray = [
    "c",
    "d",
  ]`)
      })
    })
  })
})
