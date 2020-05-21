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
/* eslint-disable @typescript-eslint/camelcase */
import {
  ObjectType, ElemID, Field, BuiltinTypes, InstanceElement, CORE_ANNOTATIONS,
  ReferenceExpression, PrimitiveType, PrimitiveTypes, Field as TypeField,
  ListType, getRestriction, createRestriction, VariableExpression, Variable, StaticFile,
} from '@salto-io/adapter-api'
import {
  validateElements, InvalidValueValidationError, CircularReferenceValidationError,
  InvalidValueRangeValidationError, IllegalReferenceValidationError,
  UnresolvedReferenceValidationError, InvalidValueTypeValidationError,
  InvalidStaticFileError,
} from '../src/core/validator'
import { MissingStaticFile, AccessDeniedStaticFile } from '../src/workspace/static_files/common'

import { IllegalReference } from '../src/parser/internal/converters'

describe('Elements validation', () => {
  const baseElemID = new ElemID('salto', 'simple')
  const simpleType = new ObjectType({
    elemID: baseElemID,
    fields: {
      str: new Field(baseElemID, 'str', BuiltinTypes.STRING, {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['str'] }),
      }),
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
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['val1', 'val2'] }),
    },
  })

  const restrictedRangeType = new PrimitiveType({
    elemID: new ElemID('salto', 'simple', 'type', 'restrictedRangeType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        min: 1, max: 10,
      }),
    },
  })

  const restrictedRangeNoMinType = new PrimitiveType({
    elemID: new ElemID('salto', 'simple', 'type', 'restrictedRangeNoMinType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max: 10 }),
    },
  })

  const restrictedRangeNoMaxType = new PrimitiveType({
    elemID: new ElemID('salto', 'simple', 'type', 'restrictedRangeNoMaxType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 1 }),
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
      list: new Field(nestedElemID, 'list', new ListType(BuiltinTypes.STRING), {}),
      listOfList: new Field(nestedElemID, 'listOfList', new ListType(new ListType(BuiltinTypes.STRING))),
      listOfObject: new Field(nestedElemID, 'listOfObject', new ListType(simpleType)),
      reqStr: new Field(nestedElemID, 'reqStr', BuiltinTypes.STRING),
      restrictStr: new Field(nestedElemID, 'restrictStr', BuiltinTypes.STRING, {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['restriction1', 'restriction2'],
        }),
      }),
      restrictNumber: new Field(nestedElemID, 'restrictNumber', BuiltinTypes.NUMBER, {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          min: 1,
          max: 10,
        }),
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

  const noResElemID = new ElemID('salto', 'no_res_type')
  const emptyType = new ObjectType({
    elemID: new ElemID('salto', 'empty'),
  })
  const noRestrictionsType = new ObjectType({
    elemID: noResElemID,
    fields: {
      someVal: new Field(noResElemID, 'someVal', emptyType),
    },
  })

  describe('validate types', () => {
    let clonedType: ObjectType

    beforeEach(() => {
      clonedType = nestedType.clone()
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

      const badObj = nestedType.clone()
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
        listOfList: [['item1', 'item2'], ['item3']],
        listOfObject: [{
          str: 'str',
          num: 2,
          bool: true,
        }],
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

    const varElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'exists')
    const variable = new Variable(varElemId, false)
    const varInst = new InstanceElement(
      'withVar',
      simpleType,
      {
        str: 'str',
        num: 12,
        bool: new VariableExpression(varElemId),
      }
    )

    const illegalValueVarInst = new InstanceElement(
      'withVar',
      simpleType,
      {
        str: 'str',
        num: new VariableExpression(varElemId),
        bool: true,
      }
    )

    const illegalRefInst = new InstanceElement(
      'illegalRef',
      simpleType,
      {
        bool: new IllegalReference('foo.bla.bar', 'illegal elem id type "bar"'),
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
      extInst = nestedInstance.clone()
    })

    describe('validate values/annotations corresponding', () => {
      let extType: ObjectType
      beforeEach(() => {
        extType = nestedType.clone()
      })
      describe('required annotation', () => {
        it('should succeed when all required fields exist with values', () => {
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
          extType.fields.reqStr.annotations[CORE_ANNOTATIONS.REQUIRED] = true
          extInst.type = extType
          const errors = validateElements([extInst])
          expect(errors).toHaveLength(1)
          expect(errors[0].message).toMatch('Field reqStr is required but has no value')
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('reqStr'))
        })

        it('should return error when required object field is missing', () => {
          extType.fields.reqNested.annotations[CORE_ANNOTATIONS.REQUIRED] = true
          extInst.type = extType
          const errors = validateElements([extInst])
          expect(errors).toHaveLength(1)
          expect(errors[0].message)
            .toMatch(`Field ${extType.fields.reqNested.name} is required but has no value`)
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('reqNested'))
        })

        it('should return error when lists elements missing required fields', () => {
          extType.fields.reqNested.type = new ListType(extType.fields.reqNested.type)
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
          extType.fields.restrictStr
            .annotations[CORE_ANNOTATIONS.RESTRICTION] = createRestriction({
              enforce_value: false,
              values: ['val1', 'val2'],
            })
          extInst.value.restrictStr = 'wrongValue'
          extInst.type = extType
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should succeed when restriction values is not a list', () => {
          extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.RESTRICTION] = { values: 'str' }
          extInst.type = extType
          extInst.value.restrictStr = 'str'
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should succeed when restriction values are not defined and enforce_values is undefined', () => {
          extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.RESTRICTION] = {}
          extInst.type = extType
          extInst.value.restrictStr = 'str'
          expect(validateElements([extInst])).toHaveLength(0)
        })

        it('should succeed when restriction values are not defined and _restriction is undefined', () => {
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

        it('should return an error when fields values do not match restriction values with explicit _restriction.enforce_value', () => {
          getRestriction(extType.fields.restrictStr).enforce_value = true
          extInst.type = extType
          testValuesAreNotListedButEnforced()
        })

        it('should return an error when annotations values do not match restriction values', () => {
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
          extType.fields.restrictedAnnotation.annotations.range = 7
          const errors = validateElements([extType])
          expect(errors).toHaveLength(0)
        })

        it('should return an error when annotations value is bigger than max restriction', () => {
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

        it('should return an error when list fields values do not match restriction values', () => {
          extType.fields.list.annotations[CORE_ANNOTATIONS.RESTRICTION] = createRestriction({
            values: ['restriction'],
          })
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

      it('should ignore static files that are valid', () => {
        const instWithFile = new InstanceElement(
          'withFile',
          new ObjectType({
            elemID: new ElemID('salesforce', 'test'),
            annotationTypes: {
              ServiceId: BuiltinTypes.SERVICE_ID,
            },
            fields: {
              someFile: new Field(
                new ElemID('salesforce', 'test'),
                'someFile',
                new PrimitiveType({
                  elemID: new ElemID('salesforce', 'string'),
                  primitive: PrimitiveTypes.STRING,
                }),
              ),
            },
          }),
          {
            someFile: new StaticFile('path', 'hash'),
          },
        )

        const errors = validateElements([instWithFile])
        expect(errors).toHaveLength(0)
      })

      it('should fail for invalid static files', () => {
        const instWithFile = new InstanceElement(
          'withFile',
          new ObjectType({
            elemID: new ElemID('salesforce', 'test'),
            annotationTypes: {
              ServiceId: BuiltinTypes.SERVICE_ID,
            },
            fields: {
              someFile: new Field(
                new ElemID('salesforce', 'test'),
                'someFile',
                new PrimitiveType({
                  elemID: new ElemID('salesforce', 'string'),
                  primitive: PrimitiveTypes.STRING,
                }),
              ),
            },
          }),
          {
            someFile: new MissingStaticFile('aa'),
          },
        )

        const errors = validateElements([instWithFile])
        expect(errors).toHaveLength(1)
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
        expect(errors).toHaveLength(2)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested'))
        // TODO: The second error is a stange UX and we should not have it
        expect(errors[1].elemID).toEqual(extInst.elemID.createNestedID('nested', 'bool'))
      })

      it('should not return an error when matching list item', () => {
        extInst.value.list.push('abc')
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(0)
      })

      it('should return error in list of list item mismatch', () => {
        extInst.value.listOfList[0].push(1)
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('listOfList', '0'))
      })

      it('should not return an error when matching list object item', () => {
        extInst.value.listOfObject.push({
          str: 'str',
          num: 3,
          bool: false,
        })
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(0)
      })

      it('should return error when not a list in list of lists', () => {
        extInst.value.listOfList = [1]
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('listOfList', '0'))
      })

      it('should return error when item instead of list', () => {
        extInst.value.listOfObject = {
          str: 'str',
          num: 3,
          bool: false,
        }
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('listOfObject'))
      })

      it('should return an error when not matching list object item (missing req)', () => {
        extInst.value.listOfObject.push({
          abc: 'dsadas',
        })
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('listOfObject', '1', 'bool'))
      })

      it('should return an error when primitive instead of list object item', () => {
        extInst.value.listOfObject.push(1)
        const errors = validateElements([extInst])
        expect(errors).toHaveLength(2)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('listOfObject', '1'))
        // TODO: The second error is a strange UX and we should not have it
        expect(errors[1].elemID).toEqual(extInst.elemID.createNestedID('listOfObject', '1', 'bool'))
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
        expect(errors[0]).toBeInstanceOf(CircularReferenceValidationError)
      })

      it('should return error when encountering a reference to self', () => {
        const refToSelfInst = new InstanceElement(
          'unresolved',
          simpleType,
          {
            str: 'str',
            num: 12,
          }
        )
        refToSelfInst.value.bool = new ReferenceExpression(
          refToSelfInst.elemID.createNestedID('bool')
        )
        const errors = validateElements([refToSelfInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(refToSelfInst.elemID.createNestedID('bool'))
        expect(errors[0]).toBeInstanceOf(CircularReferenceValidationError)
      })

      it('should validate throw error on reference that points to a bad type', () => {
        const errors = validateElements([wrongRefInst, extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(wrongRefInst.elemID.createNestedID('bool'))
      })

      it('should return error when encountering an illegal reference target', () => {
        const errors = validateElements([illegalRefInst])
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(illegalRefInst.elemID.createNestedID('bool'))
        expect(errors[0]).toBeInstanceOf(IllegalReferenceValidationError)
      })
    })

    describe('variable validation', () => {
      it('should return error when encountering an unresolved variable expression', () => {
        const errors = validateElements([varInst])
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(UnresolvedReferenceValidationError)
        expect(errors[0].elemID).toEqual(varInst.elemID.createNestedID('bool'))
      })

      it('should not return error when encountering a valid variable expression', () => {
        const errors = validateElements([varInst, variable])
        expect(errors).toHaveLength(0)
      })
      it('should return error when the type of a variable\'s value is incorrect', () => {
        const errors = validateElements([illegalValueVarInst, variable])
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueTypeValidationError)
        expect(errors[0].elemID).toEqual(varInst.elemID.createNestedID('num'))
      })
      it('should return error when a Variable element serves as a value', () => {
        const varElementInst = new InstanceElement(
          'withVarElement',
          noRestrictionsType,
          {
            someVal: new Variable(varElemId, 5),
          }
        )
        const errors = validateElements([varElementInst])
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
        expect(errors[0].elemID).toEqual(varElementInst.elemID.createNestedID('someVal'))
        expect(errors[0].message).toMatch('not a variable')
      })
      it('should return error when the value is an object (not supported for now)', () => {
        const objVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'objVar')
        const objVar = new Variable(objVarElemId, { key: 'val' })
        const errors = validateElements([objVar])
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
        expect(errors[0].elemID).toEqual(objVarElemId)
        expect(errors[0].message).toMatch(`${JSON.stringify({ key: 'val' })}`)
      })
      it('should return error when the value is a reference to an element', () => {
        const instVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'instVar')
        const objVar = new Variable(instVarElemId, new ReferenceExpression(extInst.elemID))
        const errors = validateElements([objVar, extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
        expect(errors[0].elemID).toEqual(instVarElemId)
        expect(errors[0].message).toMatch('a primitive')
      })
      it('should return error when the value is a reference to an object', () => {
        const instVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'instVar')
        const objVar = new Variable(instVarElemId,
          new ReferenceExpression(extInst.elemID.createNestedID('nested')))
        const errors = validateElements([objVar, extInst])
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
        expect(errors[0].elemID).toEqual(instVarElemId)
        expect(errors[0].message).toMatch('a primitive')
      })
      it('should return error when the value is an unresolved reference', () => {
        const refVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'refVar')
        const refVar = new Variable(refVarElemId,
          new ReferenceExpression(new ElemID('salesforce', 'nonexistent')))
        const errors = validateElements([refVar])
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(UnresolvedReferenceValidationError)
        expect(errors[0].elemID).toEqual(refVarElemId)
      })
      it('should return error when there is a circular reference of variables', () => {
        const refVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'refVar')
        const refVarElemId2 = new ElemID(ElemID.VARIABLES_NAMESPACE, 'refVar2')
        const refVar = new Variable(refVarElemId,
          new VariableExpression(refVarElemId2))
        const refVar2 = new Variable(refVarElemId2,
          new VariableExpression(refVarElemId))
        const errors = validateElements([refVar, refVar2])
        expect(errors).toHaveLength(2)
        expect(errors[0]).toBeInstanceOf(CircularReferenceValidationError)
        expect(errors[0].elemID).toEqual(refVarElemId)
      })
      it('should return error when the value is referencing itself', () => {
        const refVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'refVar')
        const refVar = new Variable(refVarElemId,
          new VariableExpression(refVarElemId))
        const errors = validateElements([refVar])
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(CircularReferenceValidationError)
        expect(errors[0].elemID).toEqual(refVarElemId)
      })
      it('should not return error when the value is a number/string/boolean', () => {
        const numVar = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'numVar'), 6)
        const boolVar = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'boolVar'), true)
        const strVar = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'strVar'), 'hi')
        const errors = validateElements([numVar, boolVar, strVar])
        expect(errors).toHaveLength(0)
      })
      it('should not return error when the value is a reference to a primitive', () => {
        const numVar = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'numVar'),
          new ReferenceExpression(extInst.elemID.createNestedID('flatnum')))
        const errors = validateElements([numVar, extInst])
        expect(errors).toHaveLength(0)
      })
    })
  })
  describe('InvalidStaticFileError', () => {
    const elemID = new ElemID('adapter', 'bla')
    it('should have correct message for missing', () =>
      expect(
        new InvalidStaticFileError({ elemID, value: new MissingStaticFile('path') })
          .message
      ).toEqual('Error validating "adapter.bla": Missing static file: path'))
    it('should have correct message for invalid', () =>
      expect(
        new InvalidStaticFileError({ elemID, value: new AccessDeniedStaticFile('path') })
          .message
      ).toEqual('Error validating "adapter.bla": Unable to access static file: path'))
  })
})
