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
      str: new Field(baseElemID, 'str', BuiltinTypes.STRING, { _restriction: { values: ['str'] } }),
      num: new Field(baseElemID, 'num', BuiltinTypes.NUMBER),
      bool: new Field(baseElemID, 'bool', BuiltinTypes.BOOLEAN, { _required: true }),
    },
    annotationsDescriptor: {
      annostr: BuiltinTypes.STRING,
      annonum: BuiltinTypes.NUMBER,
      annoboolean: BuiltinTypes.BOOLEAN,
    },
    annotations: {
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
      restrictStr: new Field(nestedElemID, 'restrictStr', BuiltinTypes.STRING, {
        _restriction: {
          values: [
            'restriction1', 'restriction2',
          ],
        },
      }),
      reqNested: new Field(nestedElemID, 'reqNested', simpleType, {
      }),
    },
    annotationsDescriptor: {
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
      clonedType.fields.nested.annotations.unspecstr = 'unspec'
      clonedType.fields.nested.annotations.unspecnum = 1
      clonedType.fields.nested.annotations.unspecbool = false
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(0)
    })

    it('should return error on bad str primitive type', () => {
      clonedType.fields.nested.annotations.annostr = 1
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
    })

    it('should return error on bad num primitive type', () => {
      clonedType.fields.nested.annotations.annonum = 'str'
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
    })

    it('should return error on bad bool primitive type', () => {
      clonedType.fields.nested.annotations.annoboolean = 1
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
    })

    it('should return error on nested annotation mismatch', () => {
      clonedType.annotations.nested = { str: 1 }
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
    })

    it('should return error object/primitive mismatch', () => {
      clonedType.fields.nested.annotations.annostr = {}

      const badObj = _.cloneDeep(nestedType)
      badObj.annotations.nested = 'not an object'
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
        list: ['item', 'item2'],
        restrictStr: 'restriction1',
      }
    )

    let extInst: InstanceElement

    beforeEach(() => {
      extInst = _.cloneDeep(nestedInstance)
    })

    describe('validate values/annotations corresponding', () => {
      describe('required annotation', () => {
        it('should succeed when all required fields exist with values', () => {
          const extType = _.cloneDeep(nestedType)

          extType.fields.reqNested.annotations[Type.REQUIRED] = true
          extType.fields.reqStr.annotations[Type.REQUIRED] = true
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

          extType.fields.reqStr.annotations[Type.REQUIRED] = true
          extInst.type = extType
          const errors = validateElements([extInst])
          expect(errors).toHaveLength(1)
          expect(errors[0].message).toEqual(`Field ${extType.fields.reqStr.name} is required but has no value`)
        })

        it('should return error when required object field is missing', () => {
          const extType = _.cloneDeep(nestedType)

          extType.fields.reqNested.annotations[Type.REQUIRED] = true
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

      describe('restriction annotation', () => {
        it('should succeed when all values corresponds to restrictions', () => {
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should succeed when restrictions values doesnt a list', () => {
          const extType = _.cloneDeep(nestedType)
          extType.fields.restrictStr.annotations[Type.RESTRICTION] = { values: 'str' }
          extInst.type = extType
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should return an error when fields values doesnt match restrictions', () => {
          extInst.value.restrictStr = 'wrongValue'
          extInst.value.nested.str = 'wrongValue2'

          const errors = validateElements([extInst])
          expect(errors).toHaveLength(2)
          expect(errors.some(err => _.isEqual(err.message, `Value ${extInst.value.restrictStr} doesn't valid for field ${nestedType.fields
            .restrictStr.elemID.getFullName()},
            can accept only ${nestedType.fields.restrictStr.annotations[Type.RESTRICTION]
    .values}`))).toBeTruthy()
          expect(errors.some(err => _.isEqual(err.message, `Value ${extInst.value.nested.str} doesn't valid for field ${simpleType.fields
            .str.elemID.getFullName()},
            can accept only ${simpleType.fields.str.annotations[Type.RESTRICTION]
    .values}`))).toBeTruthy()
        })


        it('should return an error when list fields values doesnt match restrictions', () => {
          const extType = _.cloneDeep(nestedType)
          extType.fields.list.annotations[Type.RESTRICTION] = { values: ['restriction'] }
          extInst.type = extType

          expect(validateElements([extInst])).toHaveLength(2)
        })
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
        expect(errors).toHaveLength(2)
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
