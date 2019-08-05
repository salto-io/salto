import _ from 'lodash'
import {
  ObjectType, ElemID, Field, BuiltinTypes, InstanceElement,
} from 'adapter-api'
import validateElements from '../src/core/validator'

describe('Elements validation', () => {
  const baseElemID = new ElemID('salto', 'simple')
  const simpleType = new ObjectType({
    elemID: baseElemID,
    fields: {
      str: new Field(baseElemID, 'str', BuiltinTypes.STRING),
      num: new Field(baseElemID, 'num', BuiltinTypes.NUMBER),
      bool: new Field(baseElemID, 'bool', BuiltinTypes.BOOLEAN),
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
    },
    annotations: {
      nested: simpleType,
    },
  })

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

  describe('validate types', () => {
    it('should validate a correct type', () => {
      const errors = validateElements([BuiltinTypes.STRING, simpleType, nestedType])
      expect(errors.length).toBe(0)
    })

    it('should allow unspecified annotations', () => {
      const extType = _.cloneDeep(nestedType)
      extType.fields.nested.annotationsValues.unspecstr = 'unspec'
      extType.fields.nested.annotationsValues.unspecnum = 1
      extType.fields.nested.annotationsValues.unspecbool = false
      const errors = validateElements([extType])
      expect(errors.length).toBe(0)
    })
    it('should return error on bad str primitive type', () => {
      const badStr = _.cloneDeep(nestedType)
      badStr.fields.nested.annotationsValues.annostr = 1
      const errors = validateElements([badStr])
      expect(errors.length).toBe(1)
    })
    it('should return error on bad num primitive type', () => {
      const badNum = _.cloneDeep(nestedType)
      badNum.fields.nested.annotationsValues.annonum = 'str'
      const errors = validateElements([badNum])
      expect(errors.length).toBe(1)
    })

    it('should return error on bad bool primitive type', () => {
      const badBool = _.cloneDeep(nestedType)
      badBool.fields.nested.annotationsValues.annoboolean = 1
      const errors = validateElements([badBool])
      expect(errors.length).toBe(1)
    })

    it('should return error on nested annotation mismatch', () => {
      const badNested = _.cloneDeep(nestedType)
      badNested.annotationsValues.nested = { str: 1 }
      const errors = validateElements([badNested])
      expect(errors.length).toBe(1)
    })

    it('should return error object/primitive mismatch', () => {
      const badPrim = _.cloneDeep(nestedType)
      badPrim.fields.nested.annotationsValues.annostr = {}

      const badObj = _.cloneDeep(nestedType)
      badObj.annotationsValues.nested = 'not an object'
      const errors = validateElements([badObj, badPrim])
      expect(errors.length).toBe(2)
    })
  })

  describe('validate instances', () => {
    it('should validate a correct type', () => {
      const errors = validateElements([nestedInstance])
      expect(errors.length).toBe(0)
    })

    it('should allow unspecified values', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.unspecstr = 'unspec'
      extInst.value.unspecnum = 1
      extInst.value.unspecbool = false
      const errors = validateElements([extInst])
      expect(errors.length).toBe(0)
    })

    it('should return error on bad str primitive type', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.flatstr = 1
      const errors = validateElements([extInst])
      expect(errors.length).toBe(1)
    })

    it('should return error on bad num primitive type', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.flatnum = 'str'
      const errors = validateElements([extInst])
      expect(errors.length).toBe(1)
    })

    it('should return error on bad bool primitive type', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.flatbool = 'str'
      const errors = validateElements([extInst])
      expect(errors.length).toBe(1)
    })

    it('should return error on nested string value mismatch', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.nested.str = 1
      const errors = validateElements([extInst])
      expect(errors.length).toBe(1)
    })

    it('should return error on nested num value mismatch', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.nested.num = 'str'
      const errors = validateElements([extInst])
      expect(errors.length).toBe(1)
    })

    it('should return error on nested bool value mismatch', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.nested.bool = 'str'
      const errors = validateElements([extInst])
      expect(errors.length).toBe(1)
    })

    it('should return error object/primitive mismatch', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.nested = 'str'
      const errors = validateElements([extInst])
      expect(errors.length).toBe(1)
    })

    it('should return error list/primitive mismatch', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.list = 'not a list'
      const errors = validateElements([extInst])
      expect(errors.length).toBe(1)
    })

    it('should return error list/object mismatch', () => {
      // const badList = _.cloneDeep(nestedInstance)
      // badList.value.list = {}
      const badObj = _.cloneDeep(nestedInstance)
      badObj.value = { nested: [] }
      const errors = validateElements([badObj])
      expect(errors.length).toBe(1)
    })

    it('should return error list item mismatch', () => {
      const extInst = _.cloneDeep(nestedInstance)
      extInst.value.list.push(1)
      const errors = validateElements([extInst])
      expect(errors.length).toBe(1)
    })
  })
})
