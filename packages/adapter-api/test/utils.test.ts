import {
  Field, InstanceElement, ObjectType, PrimitiveTypes, PrimitiveField, PrimitiveType,
} from '../src/elements'
import { PrimitiveValue, Values } from '../src/values'
import { ElemID } from '../src/element_id'
import { BuiltinTypes } from '../src/builtins'
import {
  transform, resolvePath,
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
      emptyStr: new Field(mockElem, 'emptyStr', BuiltinTypes.STRING),
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
      emptyStr: '',
      bool: 'true',
      num: '99',
      numArray: ['12', '13', '14'],
      notExist: 'notExist',
      emptyStrArray: ['', ''],
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
              deepNumber: '12345',
              deepName: '',
            },
          },
        },
      ],
    },
  )

  describe('transform func', () => {
    describe('should return undefined when:', () => {
      it('empty string', () => {
        expect(transform({ str: '' }, mockType)).toBeUndefined()
      })

      it('values are not exists as fields in the type', () => {
        expect(transform({ notExist1: '', notExist2: 'true' }, mockType)).toBeUndefined()
      })
    })

    describe('should return values when:', () => {
      let resp: Values

      describe('when apply the default transformPrimitives func', () => {
        beforeEach(async () => {
          // @ts-ignore
          resp = transform(mockInstance.value, mockType)
        })

        it('should remove emptyStr field', () => {
          expect(resp.bool).toEqual('true')
          expect(resp.num).toEqual('99')

          expect(resp.notExist).toBeUndefined()
        })

        it('should transform inner object', () => {
          expect(resp.obj[0]).toEqual(mockInstance.value.obj[0])
          expect(resp.obj[0].innerObj.magical.deepName)
            .toEqual(mockInstance.value.obj[0].innerObj.magical.deepName)
          expect(resp.obj[1]).not.toEqual(mockInstance.value.obj[1])
          expect(resp.obj[1].innerObj.listOfNames).toBeUndefined()
          expect(resp.obj[1].innerObj.magical.notExist2).toBeUndefined()
          expect(resp.obj[2]).not.toEqual(mockInstance.value.obj[2])
          expect(resp.obj[2].innerObj.magical.deepNumber).toEqual('12345')
        })
      })

      const transformPrimitiveTest = (val: PrimitiveValue, field: PrimitiveField):
        PrimitiveValue | undefined => {
        switch (field.type.primitive) {
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
          // @ts-ignore
          resp = transform(mockInstance.value, mockType, transformPrimitiveTest)
        })

        it('should transform primitive types', () => {
          expect(resp.notExist).toBeUndefined()
          expect(resp.bool).toEqual(true)
          expect(resp.num).toEqual(99)
        })

        it('should transform inner object', () => {
          expect(resp.obj[0]).not.toEqual(mockInstance.value.obj[0])
          expect(resp.obj[0].innerObj.magical.deepName)
            .toEqual(mockInstance.value.obj[0].innerObj.magical.deepName)

          expect(resp.obj[0].innerObj.magical.deepNumber)
            .toEqual(888)
          expect(resp.obj[0].value.anotherVal).toBeUndefined()
          expect(resp.obj[1].innerObj.magical.deepNumber).toBeUndefined()
          expect(resp.obj[1]).not.toEqual(mockInstance.value.obj[1])
          expect(resp.obj[1].innerObj.listOfNames).toBeUndefined()
          expect(resp.obj[1].innerObj.magical.notExist2).toBeUndefined()
          expect(resp.obj[2]).not.toEqual(mockInstance.value.obj[2])
          expect(resp.obj[2].innerObj.magical.deepNumber).toEqual(12345)
        })
      })

      describe('when strict was received as false', () => {
        beforeEach(async () => {
          // @ts-ignore
          resp = transform(mockInstance.value, mockType, transformPrimitiveTest, false)
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

      afterEach(async () => {
        /**
         *  primitive fields
         */
        expect(resp).toBeDefined()
        expect(resp.str).toEqual('val')
        expect(resp.emptyStr).toBeUndefined()
        expect(resp.numArray).toHaveLength(3)

        /**
         *  non primitive fields
         */
        expect(resp.emptyStrArray).toBeUndefined()
        expect(resp.obj).not.toEqual(mockInstance.value.obj)

        expect(resp.obj[0].field).toEqual('firstField')
        expect(resp.obj[1].field).toEqual('true')
        expect(resp.obj[2].field).toEqual('123')

        expect(resp.obj[1].innerObj.magical.deepName)
          .toEqual(mockInstance.value.obj[1].innerObj.magical.deepName)
        expect(resp.obj[2].innerObj.magical.deepName).toBeUndefined()
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
