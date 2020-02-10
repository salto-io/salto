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
import _ from 'lodash'
import {
  ObjectType, ElemID, Field, BuiltinTypes, InstanceElement, CORE_ANNOTATIONS,
  ReferenceExpression, PrimitiveType, PrimitiveTypes, Field as TypeField,
  RESTRICTION_ANNOTATIONS,
} from 'adapter-api'
import { validateElements, InvalidValueValidationError,
  InvalidValueRangeValidationError } from '../src/core/validator'

describe('Elements validation', () => {
  const baseElemID = new ElemID('salto', 'simple')
  const simpleType = new ObjectType({
    elemID: baseElemID,
    fields: {
      str: new Field(baseElemID, 'str', BuiltinTypes.STRING, { _values: ['str'] }),
      num: new Field(baseElemID, 'num', BuiltinTypes.NUMBER),
      bool: new Field(baseElemID, 'bool', BuiltinTypes.BOOLEAN, { _required: true }),
    },
    annotationTypes: {
      annostr: BuiltinTypes.STRING,
      annonum: BuiltinTypes.NUMBER,
      annoboolean: BuiltinTypes.BOOLEAN,
    },
    annotations: {
      annostr: 'str',
    },
  })

  const restrictedType = new PrimitiveType({
    elemID: new ElemID('salto', 'simple', 'type', 'restrictedType'),
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true },
      [CORE_ANNOTATIONS.VALUES]: ['val1', 'val2'],
    },
  })

  const restrictedRangeType = new PrimitiveType({
    elemID: new ElemID('salto', 'simple', 'type', 'restrictedRangeType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: {
        [RESTRICTION_ANNOTATIONS.MIN]: 1, [RESTRICTION_ANNOTATIONS.MAX]: 10,
      },
    },
  })

  const restrictedRangeNoMinType = new PrimitiveType({
    elemID: new ElemID('salto', 'simple', 'type', 'restrictedRangeNoMinType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.MAX]: 10 },
    },
  })

  const restrictedRangeNoMaxType = new PrimitiveType({
    elemID: new ElemID('salto', 'simple', 'type', 'restrictedRangeNoMaxType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: { [RESTRICTION_ANNOTATIONS.MIN]: 1 },
    },
  })

  const restrictedAnnotation = new PrimitiveType({
    elemID: new ElemID('salto', 'simple', 'type', 'restrictedAnnotation'),
    primitive: PrimitiveTypes.STRING,
    annotationTypes: {
      temp: restrictedType,
      range: restrictedRangeType,
      rangeNoMin: restrictedRangeNoMinType,
      rangeNoMax: restrictedRangeNoMaxType,
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
        _values: [
          'restriction1', 'restriction2',
        ],
      }),
      restrictNumber: new Field(nestedElemID, 'restrictNumber', BuiltinTypes.NUMBER, {
        [CORE_ANNOTATIONS.RESTRICTION]: {
          [RESTRICTION_ANNOTATIONS.MIN]: 1,
          [RESTRICTION_ANNOTATIONS.MAX]: 10,
        },
      }),
      restrictedAnnotation: new Field(nestedElemID, 'restrictedAnnotation', restrictedAnnotation, {
        temp: 'val1',
        range: 5,
        rangeNoMin: 5,
        rangeNoMax: 5,
      }),
      reqNested: new Field(nestedElemID, 'reqNested', simpleType, {
      }),
    },
    annotationTypes: {
      nested: simpleType,
      restrictedPrimitive: restrictedType,
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
      expect(errors[0].elemID).toEqual(clonedType.fields.nested.elemID.createNestedID('annostr'))
    })

    it('should return error on bad num primitive type', () => {
      clonedType.fields.nested.annotations.annonum = 'str'
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(clonedType.fields.nested.elemID.createNestedID('annonum'))
    })

    it('should return error on bad bool primitive type', () => {
      clonedType.fields.nested.annotations.annoboolean = 1
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(clonedType.fields.nested.elemID.createNestedID('annoboolean'))
    })

    it('should return error on nested annotation mismatch', () => {
      clonedType.annotations.nested = { str: 1 }
      const errors = validateElements([clonedType])
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(clonedType.elemID.createNestedID('attr', 'nested', 'str'))
    })

    it('should return error object/primitive mismatch', () => {
      clonedType.fields.nested.annotations.annostr = {}

      const badObj = _.cloneDeep(nestedType)
      badObj.annotations.nested = 'not an object'
      const errors = validateElements([badObj, clonedType])
      expect(errors).toHaveLength(2)
    })

    it('should allow list of object annotation value when annotationType is object', () => {
      const elemID = new ElemID('salto', 'simple')
      const objWithListAnnotation = new ObjectType({
        elemID,
        fields: {
        },
        annotationTypes: {
          notList: new ObjectType({ elemID,
            fields: {
              simple: new TypeField(elemID, 'simple', BuiltinTypes.STRING),
            } }),
        },
        annotations: {
          notList: [{ simple: 'str1' }, { simple: 'str2' }],
        },
      })
      const errors = validateElements([objWithListAnnotation])
      expect(errors).toHaveLength(0)
    })

    it('should allow list of primitive annotation value when annotationType is primitive', () => {
      const elemID = new ElemID('salto', 'simple')
      const objWithListAnnotation = new ObjectType({
        elemID,
        fields: {
        },
        annotationTypes: {
          notList: BuiltinTypes.STRING,
        },
        annotations: {
          notList: ['str1', 'str2'],
        },
      })
      const errors = validateElements([objWithListAnnotation])
      expect(errors).toHaveLength(0)
    })

    it('should return error for list of primitive annotation value when annotationType is an object', () => {
      const elemID = new ElemID('salto', 'simple')
      const objWithListAnnotation = new ObjectType({
        elemID,
        fields: {
        },
        annotationTypes: {
          notList: new ObjectType({ elemID,
            fields: {
              simple: new TypeField(elemID, 'simple', BuiltinTypes.STRING),
            } }),
        },
        annotations: {
          notList: ['str1', 'str2'],
        },
      })
      const errors = validateElements([objWithListAnnotation])
      expect(errors).toHaveLength(2)
    })

    it('should return error for list of object annotation value when annotationType is a primitive', () => {
      const elemID = new ElemID('salto', 'simple')
      const objWithListAnnotation = new ObjectType({
        elemID,
        fields: {
        },
        annotationTypes: {
          notList: BuiltinTypes.STRING,
        },
        annotations: {
          notList: [{ simple: 'str1' }, { simple: 'str2' }],
        },
      })
      const errors = validateElements([objWithListAnnotation])
      expect(errors).toHaveLength(2)
    })
  })

  describe('validate instances', () => {
    const nestedInstance = new InstanceElement(
      'nestedinst',
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

    const circularRefInst = new InstanceElement(
      'unresolved',
      simpleType,
      {
        str: 'str',
        num: 12,
      }
    )

    const unresolvedRefInst = new InstanceElement(
      'unresolved',
      simpleType,
      {
        str: 'str',
        num: 12,
        bool: new ReferenceExpression(nestedInstance.elemID.createNestedID('nope')),
      }
    )

    const circularRefInst2 = new InstanceElement(
      'unresolved',
      simpleType,
      {
        str: 'str',
        num: 12,
        bool: new ReferenceExpression(circularRefInst.elemID.createNestedID('bool')),
      }
    )

    circularRefInst.value.bool = new ReferenceExpression(circularRefInst2.elemID.createNestedID('bool'))

    const wrongRefInst = new InstanceElement(
      'unresolved',
      simpleType,
      {
        str: 'str',
        num: 12,
        bool: new ReferenceExpression(nestedInstance.elemID.createNestedID('flatnum')),
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

          extType.fields.reqNested.annotations[CORE_ANNOTATIONS.REQUIRED] = true
          extType.fields.reqStr.annotations[CORE_ANNOTATIONS.REQUIRED] = true
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

          extType.fields.reqStr.annotations[CORE_ANNOTATIONS.REQUIRED] = true
          extInst.type = extType
          const errors = validateElements([extInst])
          expect(errors).toHaveLength(1)
          expect(errors[0].message).toMatch('Field reqStr is required but has no value')
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('reqStr'))
        })

        it('should return error when required object field is missing', () => {
          const extType = _.cloneDeep(nestedType)

          extType.fields.reqNested.annotations[CORE_ANNOTATIONS.REQUIRED] = true
          extInst.type = extType
          const errors = validateElements([extInst])
          expect(errors).toHaveLength(1)
          expect(errors[0].message)
            .toMatch(`Field ${extType.fields.reqNested.name} is required but has no value`)
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('reqNested'))
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
            .toMatch(`Field ${simpleType.fields.bool.name} is required but has no value`)
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('reqNested', '1', 'bool'))
        })
      })

      describe('values annotation', () => {
        it('should succeed when all values corresponds to values annotation', () => {
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should succeed when restriction values are not enforced even if the value not in _values', () => {
          const extType = _.cloneDeep(nestedType)
          extType.fields.restrictStr
            .annotations[CORE_ANNOTATIONS.RESTRICTION] = {
              [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: false,
            }
          extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.VALUES] = ['val1', 'val2']
          extInst.value.restrictStr = 'wrongValue'
          extInst.type = extType
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should succeed when restriction values is not a list', () => {
          const extType = _.cloneDeep(nestedType)
          extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.VALUES] = 'str'
          extInst.type = extType
          extInst.value.restrictStr = 'str'
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should succeed when restriction values are not defined and enforce_values is undefined', () => {
          const extType = _.cloneDeep(nestedType)
          delete extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.VALUES]
          extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.RESTRICTION] = {}
          extInst.type = extType
          extInst.value.restrictStr = 'str'
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should succeed when restriction values are not defined and _restriction is undefined', () => {
          const extType = _.cloneDeep(nestedType)
          delete extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.VALUES]
          delete extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.RESTRICTION]
          extInst.type = extType
          extInst.value.restrictStr = 'str'
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should fail when value is not inside the range', () => {
          extInst.value.restrictNumber = 0
          const errors = validateElements([extInst])
          expect(errors).toHaveLength(1)
          expect(errors[0]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[0].message).toMatch('Value "0" is not valid')
          expect(errors[0].message).toMatch('bigger than 1 and smaller than 10')
          expect(errors[0].elemID).toEqual(
            extInst.elemID.createNestedID('restrictNumber')
          )
        })

        const testValuesAreNotListedButEnforced = (): void => {
          extInst.value.restrictStr = 'wrongValue'
          extInst.value.nested.str = 'wrongValue2'

          const errors = validateElements([extInst])
          expect(errors).toHaveLength(2)

          expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
          expect(errors[0].message).toMatch('Value "wrongValue2" is not valid')
          expect(errors[0].message).toMatch('expected one of: "str"')
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', 'str'))

          expect(errors[1]).toBeInstanceOf(InvalidValueValidationError)
          expect(errors[1].message).toMatch('Value "wrongValue" is not valid')
          expect(errors[1].message).toMatch('expected one of: "restriction1", "restriction2"')
          expect(errors[1].elemID).toEqual(extInst.elemID.createNestedID('restrictStr'))
        }

        it('should return an error when fields values doesnt match restriction values with explicit _restriction.enforce_value', () => {
          const extType = _.cloneDeep(nestedType)
          // eslint-disable-next-line @typescript-eslint/camelcase
          extType.fields.restrictStr
            .annotations[CORE_ANNOTATIONS.RESTRICTION] = {
              [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: true,
            }
          extInst.type = extType
          testValuesAreNotListedButEnforced()
        })

        it('should return an error when annotations values doesnt match restriction values', () => {
          const extType = _.cloneDeep(nestedType)
          extType.fields.restrictedAnnotation.annotations.temp = 'wrong'
          const errors = validateElements([extType])
          expect(errors).toHaveLength(1)

          expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
          expect(errors[0].message).toMatch('Value "wrong" is not valid')
          expect(errors[0].message).toMatch('expected one of: "val1", "val2"')
          expect(errors[0].elemID).toEqual(
            extType.elemID.createNestedID('field', 'restrictedAnnotation', 'temp')
          )
        })

        it('should succeed when annotation value is inside the range', () => {
          const extType = _.cloneDeep(nestedType)
          extType.fields.restrictedAnnotation.annotations.range = 7
          const errors = validateElements([extType])
          expect(errors).toHaveLength(0)
        })

        it('should return an error when annotations value is bigger than max restriction', () => {
          const extType = _.cloneDeep(nestedType)
          extType.fields.restrictedAnnotation.annotations.range = 11
          extType.fields.restrictedAnnotation.annotations.rangeNoMin = 11
          const errors = validateElements([extType])
          expect(errors).toHaveLength(2)

          expect(errors[0]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[0].message).toMatch('Value "11" is not valid')
          expect(errors[0].message).toMatch('bigger than 1 and smaller than 10')
          expect(errors[0].elemID).toEqual(
            extType.elemID.createNestedID('field', 'restrictedAnnotation', 'range')
          )

          expect(errors[1]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[1].message).toMatch('Value "11" is not valid')
          expect(errors[1].message).toMatch('smaller than 10')
          expect(errors[1].elemID).toEqual(
            extType.elemID.createNestedID('field', 'restrictedAnnotation', 'rangeNoMin')
          )
        })

        it('should return an error when annotations value is smaller than min restriction', () => {
          const extType = _.cloneDeep(nestedType)
          extType.fields.restrictedAnnotation.annotations.range = 0
          extType.fields.restrictedAnnotation.annotations.rangeNoMax = 0
          const errors = validateElements([extType])
          expect(errors).toHaveLength(2)

          expect(errors[0]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[0].message).toMatch('Value "0" is not valid')
          expect(errors[0].message).toMatch('bigger than 1 and smaller than 10')
          expect(errors[0].elemID).toEqual(
            extType.elemID.createNestedID('field', 'restrictedAnnotation', 'range')
          )

          expect(errors[1]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[1].message).toMatch('Value "0" is not valid')
          expect(errors[1].message).toMatch('bigger than 1')
          expect(errors[1].elemID).toEqual(
            extType.elemID.createNestedID('field', 'restrictedAnnotation', 'rangeNoMax')
          )
        })

        it('should return an error when list fields values doesnt match restriction values', () => {
          const extType = _.cloneDeep(nestedType)
          extType.fields.list.annotations[CORE_ANNOTATIONS.VALUES] = ['restriction']
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
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('flatstr'))
      })

      it('should return error on bad num primitive type', () => {
        extInst.value.flatnum = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('flatnum'))
      })

      it('should return error on bad bool primitive type', () => {
        extInst.value.flatbool = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('flatbool'))
      })

      it('should return error on nested string value mismatch', () => {
        extInst.value.nested.str = 1
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(2)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', 'str'))
        expect(errors[1].elemID).toEqual(extInst.elemID.createNestedID('nested', 'str'))
      })

      it('should return error on nested num value mismatch', () => {
        extInst.value.nested.num = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', 'num'))
      })

      it('should return error on nested bool value mismatch', () => {
        extInst.value.nested.bool = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', 'bool'))
      })

      it('should return error object/primitive mismatch', () => {
        extInst.value.nested = 'str'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(2)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested'))
        expect(errors[1].elemID).toEqual(extInst.elemID.createNestedID('nested', 'bool'))
      })

      it('should return error list/primitive mismatch', () => {
        extInst.value.list = 'not a list'
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('list'))
      })

      it('should return error list/object mismatch', () => {
        extInst.value = { nested: [] }
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', 'bool'))
      })

      it('should return error list item mismatch', () => {
        extInst.value.list.push(1)
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('list', '2'))
      })
    })

    describe('reference validation', () => {
      it('should return error when encountering an unresolved reference', () => {
        const errors = validateElements([unresolvedRefInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(unresolvedRefInst.elemID.createNestedID('bool'))
      })

      it('should return error when encountering a circular reference', () => {
        const errors = validateElements([circularRefInst, circularRefInst2])
        expect(errors).toHaveLength(2)
        expect(errors[0].elemID).toEqual(circularRefInst.elemID.createNestedID('bool'))
      })

      it('should validate throw error on reference that points to a bad type', () => {
        const errors = validateElements([wrongRefInst, extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(wrongRefInst.elemID.createNestedID('bool'))
      })
    })
  })
})
