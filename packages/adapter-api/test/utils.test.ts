import {
  BuiltinTypes,
  ElemID, Field, InstanceElement, ObjectType, PrimitiveTypes,
  PrimitiveValue, Values,
} from '../src/elements'
import {
  transform,
} from '../src/utils'

describe('Test utils.ts', () => {
  const mockElem = new ElemID('mockAdapter', 'test')
  const mockType = new ObjectType({
    elemID: mockElem,
    fields: {
      str: new Field(mockElem, 'str', BuiltinTypes.STRING),
      bool: new Field(mockElem, 'bool', BuiltinTypes.BOOLEAN),
      num: new Field(mockElem, 'num', BuiltinTypes.NUMBER),
      emptyStr: new Field(mockElem, 'emptyStr', BuiltinTypes.STRING),
      numArray: new Field(mockElem, 'numArray', BuiltinTypes.NUMBER, {}, true),
      obj: new Field(mockElem, 'obj', new ObjectType({
        elemID: mockElem,
        fields: {
          field: new Field(mockElem, 'field', BuiltinTypes.STRING),
          value: new Field(mockElem, 'value', BuiltinTypes.STRING),
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
            anotherVal: { objTest: 123 },
          },
        },
        {
          field: 'firstField',
          value: {
            val: 'someString123',
            anotherVal: { objTest: true },
          },
        },
        {
          field: 'firstField',
          value: {
            val: false,
            anotherVal: { objTest: 123 },
          },
        },
      ],
    },
  )
  describe('transform func', () => {
    let resp: Values

    describe('should return undefined when:', () => {
      it('empty string', () => {
        expect(transform({ str: '' }, mockType)).toBeUndefined()
      })

      it('values are not exists as fields in the type', () => {
        expect(transform({ notExist1: '', notExist2: 'true' }, mockType)).toBeUndefined()
      })
    })


    describe('when apply the default transformPrimitives func', () => {
      beforeEach(async () => {
        // @ts-ignore
        resp = transform(mockInstance.value, mockType)
      })

      it('should remove emptyStr field', () => {
        expect(resp).toBeDefined()
        expect(resp.str).toEqual('val')
        expect(resp.emptyStr).toBeUndefined()
        expect(resp.bool).toEqual('true')
        expect(resp.num).toEqual('99')
        expect(resp.numArray).toHaveLength(3)
        expect(resp.notExist).toBeUndefined()
        expect(resp.emptyStrArray).toBeUndefined()
        expect(resp.obj).toEqual(mockInstance.value.obj)
      })
    })

    const transformPrimitiveTest = (val: PrimitiveValue, primitive: PrimitiveTypes):
      PrimitiveValue | undefined => {
      switch (primitive) {
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
        expect(resp).toBeDefined()
        expect(resp.notExist).toBeUndefined()
        expect(resp.str).toEqual('val')
        expect(resp.emptyStr).toBeUndefined()
        expect(resp.bool).toEqual(true)
        expect(resp.num).toEqual(99)
        expect(resp.numArray).toHaveLength(3)
      })
    })

    describe('when strict was received as false', () => {
      beforeEach(async () => {
        // @ts-ignore
        resp = transform(mockInstance.value, mockType, transformPrimitiveTest, false)
      })

      it('should transform primitive types', () => {
        expect(resp).toBeDefined()
        expect(resp.str).toEqual('val')
        expect(resp.emptyStr).toBeUndefined()
        expect(resp.bool).toEqual(true)
        expect(resp.num).toEqual(99)
        expect(resp.numArray).toHaveLength(3)
        expect(resp.notExist).toEqual('notExist')
      })
    })
  })
})
