import _ from 'lodash'
import {
  ObjectType, ElemID, Field, BuiltinTypes, InstanceElement, Type,
} from 'adapter-api'
import validateElements from '../src/core/validator'

describe('Elements validation', () => {
  const baseElemID = new ElemID('salto', 'simple')
  const simpleType = new ObjectType({
    elemID: baseElemID,
    fields: {
      str: new Field(baseElemID, 'str', BuiltinTypes.STRING),
      num: new Field(baseElemID, 'num', BuiltinTypes.NUMBER),
      bool: new Field(baseElemID, 'bool', BuiltinTypes.BOOLEAN, { _required: true }),
    },
    annotations: {
      annostr: BuiltinTypes.STRING,
      annonum: BuiltinTypes.NUMBER,
      annoboolean: BuiltinTypes.BOOLEAN,
    },
    annotationsValues: {
      annostr: 'str',
    },
  })

  const nestedElemID = new ElemID('salto', 'nested')
  const nestedType = new ObjectType({
    elemID: nestedElemID,
    fields: {
      nested: new Field(nestedElemID, 'nested', simpleType, {
        annonum: 1,
        annoboolean: true,
      }),
      flatstr: new Field(nestedElemID, 'flatstr', BuiltinTypes.STRING),
      flatnum: new Field(nestedElemID, 'flatnum', BuiltinTypes.NUMBER),
      flatbool: new Field(nestedElemID, 'flatbool', BuiltinTypes.BOOLEAN),
      list: new Field(nestedElemID, 'list', BuiltinTypes.STRING, {}, true),
      reqStr: new Field(nestedElemID, 'reqStr', BuiltinTypes.STRING),
      reqNested: new Field(nestedElemID, 'reqNested', simpleType, {
      }),
    },
    annotations: {
      nested: simpleType,
    },
  })

  describe('validate types', () => {
    let clonedType: ObjectType

    beforeEach(() => {
      clonedType = _.cloneDeep(nestedType)
    })

    it('should validate a correct type', () => {
      const errors = validateElements([BuiltinTypes.STRING, simpleType, nestedType])
      expect(errors).toHaveLength(0)
    })

    it('should allow unspecified annotations', () => {
      clonedType.fields.nested.getAnnotationsValues().unspecstr = 'unspec'
      clonedType.fields.nested.getAnnotationsValues().unspecnum = 1
      clonedType.fields.nested.getAnnotationsValues().unspecbool = false
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(0)
    })

    it('should return error on bad str primitive type', () => {
      clonedType.fields.nested.getAnnotationsValues().annostr = 1
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
    })

    it('should return error on bad num primitive type', () => {
      clonedType.fields.nested.getAnnotationsValues().annonum = 'str'
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
    })

    it('should return error on bad bool primitive type', () => {
      clonedType.fields.nested.getAnnotationsValues().annoboolean = 1
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
    })

    it('should return error on nested annotation mismatch', () => {
      clonedType.getAnnotationsValues().nested = { str: 1 }
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
    })

    it('should return error object/primitive mismatch', () => {
      clonedType.fields.nested.getAnnotationsValues().annostr = {}

      const badObj = _.cloneDeep(nestedType)
      badObj.getAnnotationsValues().nested = 'not an object'
      const errors = validateElements([badObj, clonedType])
      expect(errors).toHaveLength(2)
    })
  })

  describe('validate instances', () => {
    const nestedInstance = new InstanceElement(
      new ElemID('salto', 'nestedinst'),
      nestedType,
      {
        nested: {
          str: 'str',
          num: 1,
          bool: true,
        },
        flatstr: 'str',
        flatnum: 1,
        flatbool: true,
        list: ['item', 'item'],
      }
    )

    let extInst: InstanceElement

    beforeEach(() => {
      extInst = _.cloneDeep(nestedInstance)
    })

    describe('validate values/annotations corresponding', () => {
      it('should succeed when all required fields exist with values', () => {
        const extType = _.cloneDeep(nestedType)

        extType.fields.reqNested.getAnnotationsValues()[Type.REQUIRED] = true
        extType.fields.reqStr.getAnnotationsValues()[Type.REQUIRED] = true
        extInst.type = extType
        extInst.value.reqStr = 'string'
        extInst.value.reqNested = {
          str: 'str',
          num: 1,
          bool: true,
        }
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(0)
      })

      it('should return error when required primitive field is missing', () => {
        const extType = _.cloneDeep(nestedType)

        extType.fields.reqStr.getAnnotationsValues()[Type.REQUIRED] = true
        extInst.type = extType
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].message).toEqual(`Field ${extType.fields.reqStr.name} is required but has no value`)
      })

      it('should return error when required object field is missing', () => {
        const extType = _.cloneDeep(nestedType)

        extType.fields.reqNested.getAnnotationsValues()[Type.REQUIRED] = true
        extInst.type = extType
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].message)
          .toEqual(`Field ${extType.fields.reqNested.name} is required but has no value`)
      })

      it('should return error when lists elements missing required fields', () => {
        const extType = _.cloneDeep(nestedType)

        extType.fields.reqNested.isList = true
        extInst.type = extType
        extInst.value.reqNested = [
          {
            str: 'str',
            num: 1,
            bool: true,
          },
          {
            str: 'str',
            num: 1,
          },
        ]

        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].message)
          .toEqual(`Field ${simpleType.fields.bool.name} is required but has no value`)
      })
    })

    describe('validate values correctness', () => {
      it('should validate a correct type', () => {
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(0)
      })

      it('should allow unspecified values', () => {
        extInst.value.unspecstr = 'unspec'
        extInst.value.unspecnum = 1
        extInst.value.unspecbool = false
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(0)
      })

      it('should return error on bad str primitive type', () => {
        extInst.value.flatstr = 1
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
      })

      it('should return error on bad num primitive type', () => {
        extInst.value.flatnum = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
      })

      it('should return error on bad bool primitive type', () => {
        extInst.value.flatbool = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
      })

      it('should return error on nested string value mismatch', () => {
        extInst.value.nested.str = 1
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
      })

      it('should return error on nested num value mismatch', () => {
        extInst.value.nested.num = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
      })

      it('should return error on nested bool value mismatch', () => {
        extInst.value.nested.bool = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
      })

      it('should return error object/primitive mismatch', () => {
        extInst.value.nested = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(2)
      })

      it('should return error list/primitive mismatch', () => {
        extInst.value.list = 'not a list'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
      })

      it('should return error list/object mismatch', () => {
        extInst.value = { nested: [] }
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(2)
      })

      it('should return error list item mismatch', () => {
        extInst.value.list.push(1)
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
      })
    })
  })
})
