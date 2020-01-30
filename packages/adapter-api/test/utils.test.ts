import _ from 'lodash'
import {
  Field, InstanceElement, ObjectType, PrimitiveTypes, PrimitiveType, TypeMap,
} from '../src/elements'
import { Values } from '../src/values'
import { ElemID } from '../src/element_id'
import { BuiltinTypes } from '../src/builtins'
import {
  transform, resolvePath, TransformValueFunc, isPrimitiveType,
} from '../src/utils'

describe('Test utils.ts', () => {
  const mockElem = new ElemID('mockAdapter', 'test')
  const mockType = new ObjectType({
    elemID: mockElem,
    annotationTypes: {
      testAnno: new PrimitiveType({
        elemID: new ElemID('mockAdapter', 'str'),
        primitive: PrimitiveTypes.STRING,
        annotations: { testAnno: 'TEST ANNO TYPE' },
      }),
    },
    annotations: {
      testAnno: 'TEST ANNO',
    },
    fields: {
      str: new Field(mockElem, 'str', BuiltinTypes.STRING, {
        testAnno: 'TEST FIELD ANNO',
      }),
      bool: new Field(mockElem, 'bool', BuiltinTypes.BOOLEAN),
      num: new Field(mockElem, 'num', BuiltinTypes.NUMBER),
      numArray: new Field(mockElem, 'numArray', BuiltinTypes.NUMBER, {}, true),
      obj: new Field(mockElem, 'obj', new ObjectType({
        elemID: mockElem,
        fields: {
          field: new Field(mockElem, 'field', BuiltinTypes.STRING),
          value: new Field(mockElem, 'value', BuiltinTypes.STRING),
          innerObj: new Field(mockElem, 'innerObj', new ObjectType({
            elemID: mockElem,
            fields: {
              name: new Field(mockElem, 'name', BuiltinTypes.STRING),
              listOfNames: new Field(mockElem, 'listOfNames', BuiltinTypes.STRING, {}, true),
              magical: new Field(mockElem, 'magical', new ObjectType({
                elemID: mockElem,
                fields: {
                  deepNumber: new Field(mockElem, 'deepNumber', BuiltinTypes.NUMBER),
                  deepName: new Field(mockElem, 'deepName', BuiltinTypes.STRING),
                },
              })),
            },
          })),
        },
      }), {}, true),
    },
  })

  const mockInstance = new InstanceElement(
    'mockInstance',
    mockType,
    {
      str: 'val',
      bool: 'true',
      num: '99',
      numArray: ['12', '13', '14'],
      notExist: 'notExist',
      notExistArray: ['', ''],
      obj: [
        {
          field: 'firstField',
          value: {
            val: 'someString',
            anotherVal: { objTest: '123' },
          },
          innerObj: {
            name: 'oren',
            listOfNames: ['abc', 'qwe', 'opiu'],
            magical: {
              deepNumber: '888',
              deepName: 'innerName',
            },
          },
        },
        {
          field: 'true',
          value: ['123', '456'],
          innerObj: {
            name: 'name1',
            listOfNames: ['', '', ''],
            magical: {
              deepName: 'innerName1',
              notExist2: 'false',
            },
          },
        },
        {
          field: '123',
          innerObj: {
            name: 'name1',
            listOfNames: ['str4', 'str1', 'str2'],
            magical: {
              deepNumber: '',
              deepName: '',
            },
          },
        },
      ],
    },
  )

  describe('transform func', () => {
    let resp: Values

    describe('with empty transformPrimitives func', () => {
      let transfromFunc: jest.Mock
      beforeEach(() => {
        transfromFunc = jest.fn().mockImplementation(val => val)
      })

      describe('when called with instance and object type', () => {
        beforeEach(async () => {
          const result = transform(mockInstance.value, mockType, transfromFunc)
          expect(result).toBeDefined()
          resp = result as Values
        })

        it('should call transform on top level primitive values', () => {
          const primitiveFieldNames = ['str', 'bool', 'num']
          primitiveFieldNames.forEach(field => {
            expect(transfromFunc).toHaveBeenCalledWith(
              mockInstance.value[field], mockType.fields[field],
            )
          })
        })

        it('should call transfrom on array elements', () => {
          (mockInstance.value.numArray as string[]).forEach(
            val => expect(transfromFunc).toHaveBeenCalledWith(val, mockType.fields.numArray)
          )
        })

        it('should call transfrom on primitive types in nested objects', () => {
          const getField = (type: ObjectType, path: (string | number)[]): Field => {
            if (typeof path[0] === 'number') {
              return getField(type, path.slice(1))
            }
            const field = type.fields[path[0]]
            return path.length === 1 ? field : getField(field.type as ObjectType, path.slice(1))
          }
          const nestedPrimitivePaths = [
            ['obj', 0, 'field'],
            ['obj', 1, 'field'],
            ['obj', 2, 'field'],
            ['obj', 0, 'innerObj', 'name'],
            ['obj', 0, 'innerObj', 'magical', 'deepName'],
          ]
          nestedPrimitivePaths.forEach(
            path => expect(transfromFunc).toHaveBeenCalledWith(
              _.get(mockInstance.value, path), getField(mockType, path),
            )
          )
        })

        it('should omit undefined fields in object', () => {
          expect(resp).not.toHaveProperty('notExist')
          expect(resp).not.toHaveProperty('notExistArray')
        })

        it('should omit undefined fields in nested objects', () => {
          const { magical } = resp?.obj[1]?.innerObj
          expect(magical).toBeDefined()
          expect(magical).not.toHaveProperty('notExist2')
        })

        it('should keep all defined field values', () => {
          Object.keys(mockType.fields)
            .filter(key => !['obj', 'emptyStr', 'emptyArray'].includes(key))
            .forEach(key => {
              expect(resp[key]).toEqual(mockInstance.value[key])
            })
        })

        it('should keep all nested defined fields values', () => {
          expect(resp.obj[0]).toEqual(mockInstance.value.obj[0])
        })
      })
      describe('when called with type map', () => {
        let origValue: Values
        let typeMap: TypeMap
        beforeEach(() => {
          origValue = { str: 'asd', num: '10', bool: 'true', nums: ['1', '2'], notExist: 'a' }
          typeMap = {
            str: BuiltinTypes.STRING,
            num: BuiltinTypes.NUMBER,
            bool: BuiltinTypes.BOOLEAN,
            nums: BuiltinTypes.NUMBER,
          }
          const result = transform(origValue, typeMap, transfromFunc)
          expect(result).toBeDefined()
          resp = result as Values
        })
        it('should call transfrom func on all defined types', () => {
          const mockField = (name: string): Field => new Field(new ElemID(''), name, typeMap[name])
          const primitiveTypes = ['str', 'num', 'bool']
          primitiveTypes.forEach(
            name => expect(transfromFunc).toHaveBeenCalledWith(origValue[name], mockField(name))
          )
          origValue.nums.forEach(
            (val: string) => expect(transfromFunc).toHaveBeenCalledWith(val, mockField('nums'))
          )
        })
        it('should omit undefined fields values', () => {
          expect(resp).not.toHaveProperty('notExist')
        })
        it('should keep all defined fields values', () => {
          expect(origValue).toMatchObject(resp)
        })
      })
    })

    const transformPrimitiveTest: TransformValueFunc = (val, field) => {
      const fieldType = field?.type
      if (!isPrimitiveType(fieldType)) {
        return val
      }
      switch (fieldType.primitive) {
        case PrimitiveTypes.NUMBER:
          return Number(val)
        case PrimitiveTypes.BOOLEAN:
          return val.toString().toLowerCase() === 'true'
        case PrimitiveTypes.STRING:
          return val.toString().length === 0 ? undefined : val.toString()
        default:
          return val
      }
    }

    describe('when transformPrimitives was received', () => {
      beforeEach(async () => {
        const result = transform(mockInstance.value, mockType, transformPrimitiveTest)
        expect(result).toBeDefined()
        resp = result as Values
      })

      it('should transform primitive types', () => {
        expect(resp.str).toEqual('val')
        expect(resp.bool).toEqual(true)
        expect(resp.num).toEqual(99)
      })

      it('should transform inner object', () => {
        expect(resp.obj[0].innerObj.magical.deepNumber).toEqual(888)
      })
    })

    describe('when strict is false', () => {
      beforeEach(async () => {
        const result = transform(mockInstance.value, mockType, transformPrimitiveTest, false)
        expect(result).toBeDefined()
        resp = result as Values
      })

      it('should transform primitive types', () => {
        expect(resp.emptyStr).toBeUndefined()
        expect(resp.bool).toEqual(true)
        expect(resp.num).toEqual(99)
        expect(resp.notExist).toEqual('notExist')
      })

      it('should transform inner object', () => {
        expect(resp.obj[0]).not.toEqual(mockInstance.value.obj[0])
        expect(resp.obj[0].value.anotherVal).toBeUndefined()
        expect(resp.obj[1].innerObj.magical.deepNumber).toBeUndefined()
        expect(resp.obj[1].innerObj.magical.notExist2).toEqual('false')
        expect(resp.obj[2]).not.toEqual(mockInstance.value.obj[2])
      })
    })
  })

  describe('resolve path func', () => {
    it('should fail when the base element is not a parent of the full elemID', () => {
      expect(resolvePath(mockType, new ElemID('salto', 'nope'))).toBe(undefined)
    })
    it('should fail on a non existing path', () => {
      expect(resolvePath(mockType, mockElem.createNestedID('field', 'nope'))).toBe(undefined)
    })
    it('should return base element when no path is provided', () => {
      expect(resolvePath(mockType, mockType.elemID)).toEqual(mockType)
    })
    it('should resolve a field annotation path', () => {
      expect(resolvePath(
        mockType,
        mockType.fields.str.elemID.createNestedID('testAnno')
      )).toBe('TEST FIELD ANNO')
    })
    it('should resolve an annotation path', () => {
      expect(resolvePath(
        mockType,
        mockType.elemID.createNestedID('attr', 'testAnno')
      )).toBe('TEST ANNO')
    })
    it('should resolve an annotation type path', () => {
      expect(resolvePath(
        mockType,
        mockType.elemID.createNestedID('annotation', 'testAnno', 'testAnno')
      )).toBe('TEST ANNO TYPE')
    })
    it('should resolve an instance value path', () => {
      expect(resolvePath(
        mockInstance,
        mockInstance.elemID.createNestedID('str')
      )).toBe('val')
    })
  })
})
