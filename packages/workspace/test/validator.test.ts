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
/* eslint-disable camelcase */
import {
  ObjectType,
  ElemID,
  BuiltinTypes,
  InstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  PrimitiveType,
  PrimitiveTypes,
  MapType,
  ListType,
  getRestriction,
  createRestriction,
  VariableExpression,
  Variable,
  StaticFile,
  createRefToElmWithValue,
  TypeReference,
  TemplateExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { parser } from '@salto-io/parser'
import {
  validateElements,
  InvalidValueValidationError,
  CircularReferenceValidationError,
  InvalidValueRangeValidationError,
  IllegalReferenceValidationError,
  UnresolvedReferenceValidationError,
  InvalidValueTypeValidationError,
  InvalidStaticFileError,
  RegexMismatchValidationError,
  InvalidValueMaxLengthValidationError,
  InvalidValueMaxListLengthValidationError,
} from '../src/validator'
import { MissingStaticFile, AccessDeniedStaticFile } from '../src/workspace/static_files/common'
import { createInMemoryElementSource } from '../src/workspace/elements_source'
import { getFieldsAndAnnoTypes } from './utils'

describe('Elements validation', () => {
  const baseElemID = new ElemID('salto', 'simple')
  const simpleType = new ObjectType({
    elemID: baseElemID,
    fields: {
      str: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['str'] }),
        },
      },
      num: { refType: BuiltinTypes.NUMBER },
      bool: {
        refType: BuiltinTypes.BOOLEAN,
        annotations: { _required: true },
      },
    },
    annotationRefsOrTypes: {
      annostr: BuiltinTypes.STRING,
      annonum: BuiltinTypes.NUMBER,
      annoboolean: BuiltinTypes.BOOLEAN,
    },
    annotations: {
      annostr: 'str',
    },
  })

  const withSimpleTypeElemID = new ElemID('netsuite', 'hasSimple')
  const withSimpleTypeField = new ObjectType({
    elemID: withSimpleTypeElemID,
    fields: {
      simple: { refType: simpleType },
    },
  })

  const restrictedType = new PrimitiveType({
    elemID: new ElemID('salto', 'restrictedType'),
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['val1', 'val2'] }),
    },
  })

  const restrictedRangeType = new PrimitiveType({
    elemID: new ElemID('salto', 'restrictedRangeType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        min: 1,
        max: 10,
      }),
    },
  })

  const restrictedStringMaxLengthType = new PrimitiveType({
    elemID: new ElemID('salto', 'restrictedStringMaxLengthType'),
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
        max_length: 4,
      }),
    },
  })

  const objWithRestirctedAnnoType = new ObjectType({
    elemID: new ElemID('salesorce', 'objWithRestirctedAnnoType'),
    annotationRefsOrTypes: {
      withRestriction: restrictedStringMaxLengthType,
    },
    annotations: {
      withRestriction: '1',
    },
  })

  const restrictedRangeNoMinType = new PrimitiveType({
    elemID: new ElemID('salto', 'restrictedRangeNoMinType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max: 10 }),
    },
  })

  const restrictedRangeNoMaxType = new PrimitiveType({
    elemID: new ElemID('salto', 'restrictedRangeNoMaxType'),
    primitive: PrimitiveTypes.NUMBER,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ min: 1 }),
    },
  })

  const restrictedRegexOnlyLowerType = new PrimitiveType({
    elemID: new ElemID('salto', 'restrictedRegexOnlyLowerType'),
    primitive: PrimitiveTypes.STRING,
    annotations: {
      [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^[a-z]*$' }),
    },
  })

  const restrictedAnnotation = new PrimitiveType({
    elemID: new ElemID('salto', 'restrictedAnnotation'),
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: {
      temp: restrictedType,
      range: restrictedRangeType,
      rangeNoMin: restrictedRangeNoMinType,
      rangeNoMax: restrictedRangeNoMaxType,
      regexOnlyLower: restrictedRegexOnlyLowerType,
      maxLength: restrictedStringMaxLengthType,
    },
  })

  const nestedElemID = new ElemID('salto', 'nested')
  const nestedType = new ObjectType({
    elemID: nestedElemID,
    fields: {
      nested: {
        refType: simpleType,
        annotations: {
          annonum: 1,
          annoboolean: true,
        },
      },
      flatstr: { refType: BuiltinTypes.STRING },
      flatnum: { refType: BuiltinTypes.NUMBER },
      flatbool: { refType: BuiltinTypes.BOOLEAN },
      list: { refType: new ListType(BuiltinTypes.STRING) },
      listOfList: {
        refType: new ListType(new ListType(BuiltinTypes.STRING)),
      },
      listOfListOfList: {
        refType: new ListType(new ListType(new ListType(BuiltinTypes.STRING))),
      },
      listOfObject: { refType: new ListType(simpleType) },
      map: { refType: new MapType(BuiltinTypes.STRING) },
      mapOfObject: { refType: new MapType(simpleType) },
      mapOfMaps: {
        refType: new MapType(new MapType(BuiltinTypes.STRING)),
      },
      mapOfLists: {
        refType: new MapType(new ListType(BuiltinTypes.STRING)),
      },
      listOfMaps: {
        refType: new ListType(new MapType(BuiltinTypes.STRING)),
      },
      reqStr: { refType: BuiltinTypes.STRING },
      restrictStr: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            values: ['restriction1', 'restriction2'],
          }),
        },
      },
      restrictNumber: {
        refType: BuiltinTypes.NUMBER,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            min: 0,
            max: 10,
          }),
        },
      },
      restrictStringRegex: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            regex: '^[a-z0-9]*$',
          }),
        },
      },
      restrictStringLength: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            max_length: 5,
          }),
        },
      },
      restrictedStringMaxLengthType: {
        refType: restrictedStringMaxLengthType,
      },
      restrictNumberRegex: {
        refType: BuiltinTypes.NUMBER,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            regex: '^1[0-9]*$',
          }),
        },
      },
      restrictedListLength: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            max_list_length: 6,
          }),
        },
      },
      restrictedAnnotation: {
        refType: restrictedAnnotation,
        annotations: {
          temp: 'val1',
          range: 5,
          rangeNoMin: 5,
          rangeNoMax: 5,
          regexOnlyLower: 'abc',
          maxLength: '123',
        },
      },
      reqNested: {
        refType: simpleType,
      },
    },
    annotationRefsOrTypes: {
      nested: simpleType,
      restrictedPrimitive: restrictedType,
      restrictedStringLengthPrimitive: restrictedStringMaxLengthType,
    },
  })

  const noResElemID = new ElemID('salto', 'no_res_type')
  const emptyType = new ObjectType({
    elemID: new ElemID('salto', 'empty'),
  })
  const noRestrictionsType = new ObjectType({
    elemID: noResElemID,
    fields: {
      someVal: { refType: emptyType },
    },
  })

  describe('validate types', () => {
    let clonedType: ObjectType

    beforeEach(() => {
      clonedType = nestedType.clone()
    })

    it('should validate a correct type', async () => {
      const errors = await validateElements(
        [simpleType, nestedType],
        createInMemoryElementSource([nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
      )
      expect(errors).toHaveLength(0)
    })

    it('should allow unspecified annotations', async () => {
      clonedType.fields.nested.annotations.unspecstr = 'unspec'
      clonedType.fields.nested.annotations.unspecnum = 1
      clonedType.fields.nested.annotations.unspecbool = false
      const errors = await validateElements(
        [clonedType],
        createInMemoryElementSource([clonedType, ...(await getFieldsAndAnnoTypes(clonedType))]),
      )
      expect(errors).toHaveLength(0)
    })

    it('should return error on bad str primitive type', async () => {
      clonedType.fields.nested.annotations.annostr = 1
      const errors = await validateElements(
        [clonedType],
        createInMemoryElementSource([clonedType, ...(await getFieldsAndAnnoTypes(clonedType))]),
      )
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(clonedType.fields.nested.elemID.createNestedID('annostr'))
    })

    it('should not return error on template string', async () => {
      clonedType.fields.nested.annotations.annostr = new TemplateExpression({
        parts: ['1', new ReferenceExpression(new ElemID('a', 'b'), 'hello world')],
      })
      const errors = await validateElements(
        [clonedType],
        createInMemoryElementSource([
          new ObjectType({ elemID: new ElemID('a', 'b') }),
          clonedType,
          ...(await getFieldsAndAnnoTypes(clonedType)),
        ]),
      )
      expect(errors).toHaveLength(0)
    })

    it('should return an error on template expression with unresolved reference', async () => {
      clonedType.fields.nested.annotations.annostr = new TemplateExpression({
        parts: ['1', new ReferenceExpression(new ElemID('a', 'b'), 'hello world')],
      })
      const errors = await validateElements(
        [clonedType],
        createInMemoryElementSource([clonedType, ...(await getFieldsAndAnnoTypes(clonedType))]),
      )
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(clonedType.fields.nested.elemID.createNestedID('annostr'))
    })

    it('should return error on bad num primitive type', async () => {
      clonedType.fields.nested.annotations.annonum = 'str'
      const errors = await validateElements(
        [clonedType],
        createInMemoryElementSource([clonedType, ...(await getFieldsAndAnnoTypes(clonedType))]),
      )
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(clonedType.fields.nested.elemID.createNestedID('annonum'))
    })

    it('should return error on bad bool primitive type', async () => {
      clonedType.fields.nested.annotations.annoboolean = 1
      const errors = await validateElements(
        [clonedType],
        createInMemoryElementSource([clonedType, ...(await getFieldsAndAnnoTypes(clonedType))]),
      )
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(clonedType.fields.nested.elemID.createNestedID('annoboolean'))
    })

    it('should return error on nested annotation mismatch', async () => {
      clonedType.annotations.nested = { str: 1 }
      const errors = await validateElements(
        [clonedType],
        createInMemoryElementSource([clonedType, ...(await getFieldsAndAnnoTypes(clonedType))]),
      )
      expect(errors).toHaveLength(1)
      expect(errors[0].elemID).toEqual(clonedType.elemID.createNestedID('attr', 'nested', 'str'))
    })

    it('should return error object/primitive mismatch', async () => {
      clonedType.fields.nested.annotations.annostr = {}

      const badObj = nestedType.clone()
      badObj.annotations.nested = 'not an object'
      const elements = [badObj, clonedType]
      const errors = await validateElements(
        elements,
        createInMemoryElementSource([
          badObj,
          clonedType,
          ...(await getFieldsAndAnnoTypes(badObj)),
          ...(await getFieldsAndAnnoTypes(clonedType)),
        ]),
      )
      expect(errors).toHaveLength(2)
    })

    it('should allow list of object annotation value when annotationType is object', async () => {
      const elemID = new ElemID('salto', 'simple')
      const objWithListAnnotation = new ObjectType({
        elemID,
        annotationRefsOrTypes: {
          notList: new ObjectType({
            elemID,
            fields: { simple: { refType: BuiltinTypes.STRING } },
          }),
        },
        annotations: {
          notList: [{ simple: 'str1' }, { simple: 'str2' }],
        },
      })
      const errors = await validateElements(
        [objWithListAnnotation],
        createInMemoryElementSource([objWithListAnnotation, ...(await getFieldsAndAnnoTypes(objWithListAnnotation))]),
      )
      expect(errors).toHaveLength(0)
    })

    it('should allow list of primitive annotation value when annotationType is primitive', async () => {
      const elemID = new ElemID('salto', 'simple')
      const objWithListAnnotation = new ObjectType({
        elemID,
        annotationRefsOrTypes: {
          notList: BuiltinTypes.STRING,
        },
        annotations: {
          notList: ['str1', 'str2'],
        },
      })
      const errors = await validateElements(
        [objWithListAnnotation],
        createInMemoryElementSource([objWithListAnnotation, ...(await getFieldsAndAnnoTypes(objWithListAnnotation))]),
      )
      expect(errors).toHaveLength(0)
    })

    it('should return error for list of primitive annotation value when annotationType is an object', async () => {
      const elemID = new ElemID('salto', 'simple')
      const objWithListAnnotation = new ObjectType({
        elemID,
        annotationRefsOrTypes: {
          notList: new ObjectType({
            elemID,
            fields: { simple: { refType: BuiltinTypes.STRING } },
          }),
        },
        annotations: {
          notList: ['str1', 'str2'],
        },
      })
      const errors = await validateElements(
        [objWithListAnnotation],
        createInMemoryElementSource([objWithListAnnotation, ...(await getFieldsAndAnnoTypes(objWithListAnnotation))]),
      )
      expect(errors).toHaveLength(2)
    })

    it('should return error for list of object annotation value when annotationType is a primitive', async () => {
      const elemID = new ElemID('salto', 'simple')
      const objWithListAnnotation = new ObjectType({
        elemID,
        fields: {},
        annotationRefsOrTypes: {
          notList: BuiltinTypes.STRING,
        },
        annotations: {
          notList: [{ simple: 'str1' }, { simple: 'str2' }],
        },
      })
      const errors = await validateElements(
        [objWithListAnnotation],
        createInMemoryElementSource([objWithListAnnotation, ...(await getFieldsAndAnnoTypes(objWithListAnnotation))]),
      )
      expect(errors).toHaveLength(2)
    })

    it('should return unresolved reference error in core annotations', async () => {
      const objWithUnresolvedRef = new ObjectType({
        elemID: new ElemID('salto', 'test'),
        fields: {
          bad: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [
                new ReferenceExpression(new ElemID('salto', 'test', 'field', 'noSuchField')),
              ],
            },
          },
        },
      })
      const errors = await validateElements(
        [objWithUnresolvedRef],
        createInMemoryElementSource([objWithUnresolvedRef, ...(await getFieldsAndAnnoTypes(objWithUnresolvedRef))]),
      )
      expect(errors).toHaveLength(1)
    })
  })

  describe('validate instances', () => {
    const nestedInstance = new InstanceElement('nestedinst', nestedType, {
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
      listOfObject: [
        {
          str: 'str',
          num: 2,
          bool: true,
        },
      ],
      map: { item: 'item', item2: 'item2' },
      mapOfObject: { obj: { str: 'str', num: 2, bool: true } },
      mapOfMaps: { nestedMap: { a: 'AAA' } },
      mapOfLists: { nestedList: ['aaa', 'BBB'] },
      listOfMaps: [{ key: 'value' }, { another: 'one' }],
      restrictStr: 'restriction1',
      restrictedStringMaxLengthType: '1',
      restrictedListLength: ['very long value, longer than the max size of the list', 'blah', 'oof'],
    })

    const circularRefInst = new InstanceElement('unresolved', simpleType, {
      str: 'str',
      num: 12,
    })

    const unresolvedRefInst = new InstanceElement('unresolved', simpleType, {
      str: 'str',
      num: 12,
      bool: new ReferenceExpression(nestedInstance.elemID.createNestedID('nope')),
    })

    const varElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'exists')
    const variable = new Variable(varElemId, false)
    const varInst = new InstanceElement('withVar', simpleType, {
      str: 'str',
      num: 12,
      bool: new VariableExpression(varElemId),
    })

    const illegalValueVarInst = new InstanceElement('withVar', simpleType, {
      str: 'str',
      num: new VariableExpression(varElemId),
      bool: true,
    })

    const illegalRefInst = new InstanceElement('illegalRef', simpleType, {
      bool: new parser.IllegalReference('foo.bla.bar', 'illegal elem id type "bar"'),
    })

    const circularRefInst2 = new InstanceElement('unresolved', simpleType, {
      str: 'str',
      num: 12,
      bool: new ReferenceExpression(circularRefInst.elemID.createNestedID('bool')),
    })

    circularRefInst.value.bool = new ReferenceExpression(circularRefInst2.elemID.createNestedID('bool'))

    const wrongRefInst = new InstanceElement('unresolved', simpleType, {
      str: 'str',
      num: 12,
      bool: new ReferenceExpression(nestedInstance.elemID.createNestedID('flatnum')),
    })

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
        it('should succeed when all required fields exist with values', async () => {
          extType.fields.reqNested.annotations[CORE_ANNOTATIONS.REQUIRED] = true
          extType.fields.reqStr.annotations[CORE_ANNOTATIONS.REQUIRED] = true
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.reqStr = 'string'
          extInst.value.reqNested = {
            str: 'str',
            num: 1,
            bool: true,
          }
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
          )
          expect(errors).toHaveLength(0)
        })

        it('should return error when required primitive field is missing', async () => {
          extType.fields.reqStr.annotations[CORE_ANNOTATIONS.REQUIRED] = true
          extInst.refType = createRefToElmWithValue(extType)
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0].message).toMatch('Field reqStr is required but has no value')
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('reqStr'))
        })

        it('should return error when required object field is missing', async () => {
          extType.fields.reqNested.annotations = {
            ...extType.fields.reqNested.annotations,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          }
          extInst.refType = createRefToElmWithValue(extType)
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0].message).toMatch(`Field ${extType.fields.reqNested.name} is required but has no value`)
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('reqNested'))
        })

        it('should return error when lists elements missing required fields', async () => {
          extType.fields.reqNested.refType = createRefToElmWithValue(
            new ListType(await extType.fields.reqNested.getType()),
          )
          extInst.refType = createRefToElmWithValue(extType)
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

          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([
              extInst,
              nestedType,
              simpleType,
              ...(await getFieldsAndAnnoTypes(extType)),
              ...(await getFieldsAndAnnoTypes(simpleType)),
            ]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0].message).toMatch(`Field ${simpleType.fields.bool.name} is required but has no value`)
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('reqNested', '1', 'bool'))
        })

        it('should return error when element inside a map is missing a required field', async () => {
          extType.fields.reqNested.refType = createRefToElmWithValue(
            new MapType(await extType.fields.reqNested.getType()),
          )
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.reqNested = {
            a: {
              str: 'str',
              num: 1,
              bool: true,
            },
            b: {
              str: 'str',
            },
          }

          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0].message).toMatch(`Field ${simpleType.fields.bool.name} is required but has no value`)
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('reqNested', 'b', 'bool'))
        })

        it('should not return validation errors when the value is a legal reference', async () => {
          const refInst = new InstanceElement('instWithRef', withSimpleTypeField, {
            simple: new ReferenceExpression(varInst.elemID, varInst),
          })
          expect(
            await validateElements(
              [refInst],
              createInMemoryElementSource([
                refInst,
                simpleType,
                withSimpleTypeField,
                varInst,
                ...(await getFieldsAndAnnoTypes(withSimpleTypeField)),
              ]),
            ),
          ).toHaveLength(0)
        })

        it('should not return validation errors even when the value is an illegal reference', async () => {
          const refInst = new InstanceElement('instWithRef', withSimpleTypeField, {
            simple: new ReferenceExpression(illegalValueVarInst.elemID, illegalValueVarInst),
          })
          expect(
            await validateElements(
              [refInst],
              createInMemoryElementSource([
                refInst,
                simpleType,
                withSimpleTypeField,
                varInst,
                ...(await getFieldsAndAnnoTypes(withSimpleTypeField)),
              ]),
            ),
          ).toHaveLength(0)
        })
      })
      describe('additional properties annotation', () => {
        let topType: ObjectType
        let validatingType: ObjectType
        let nonValidatingType: ObjectType
        beforeEach(() => {
          const elemIdTop = new ElemID('salto', 'top')
          const elemIdNotValidating = new ElemID('salto', 'notvalidating')
          const elemIdValidating = new ElemID('salto', 'validating')
          validatingType = new ObjectType({
            elemID: elemIdValidating,
            fields: {
              str: { refType: BuiltinTypes.STRING },
            },
            annotations: {
              [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
            },
          })
          nonValidatingType = new ObjectType({
            elemID: elemIdNotValidating,
            fields: {
              str: { refType: BuiltinTypes.STRING },
            },
          })
          topType = new ObjectType({
            elemID: elemIdTop,
            fields: {
              mapFieldNonValidating: { refType: new MapType(nonValidatingType) },
              mapFieldValidating: { refType: new MapType(validatingType) },
              listFieldNonValidating: { refType: new ListType(nonValidatingType) },
              listFieldValidating: { refType: new ListType(validatingType) },
            },
            annotations: {
              [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
            },
          })
        })
        it('should succeed when additional properties is false and there are no additional properties', async () => {
          extType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.reqNested = {
            str: 'str',
            num: 1,
            bool: true,
          }
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(0)
        })
        it('should warn when additional properties is false and there are additional properties', async () => {
          extType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.additional = 'fail'
          extInst.value.additional2 = 'fail2'
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(2)
          expect(errors[0].message).toMatch(
            'Error validating "salto.nested.instance.nestedinst":' +
              " Field 'additional' is not defined in the 'nested' type which does not allow additional properties.",
          )
          expect(errors[0].elemID).toEqual(extInst.elemID)
          expect(errors[1].message).toMatch(
            'Error validating "salto.nested.instance.nestedinst":' +
              " Field 'additional2' is not defined in the 'nested' type which does not allow additional properties.",
          )
          expect(errors[1].elemID).toEqual(extInst.elemID)
        })
        it('should succeed when additional properties is true and there are additional properties', async () => {
          extType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = true
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.unexpected = 'fail'
          extInst.value.unexpected2 = 'fail2'
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(0)
        })
        it('should succeed when additional properties is set to false and there are additional properties in nested fields', async () => {
          extType.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES] = false
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.reqNested = {
            str: 'str',
            num: 1,
            bool: true,
            additional: 'should not cause warn',
          }
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(0)
        })
        it('should warn on nested fields when they have the additional properties annotation set to false', async () => {
          const simpleTypeClone = simpleType.clone()
          const temp = extType.fields.nested.refType.type as ObjectType
          temp.annotations = {
            [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
          }
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.reqNested = {
            str: 'str',
            num: 1,
            bool: true,
            additional: 'should cause warn',
          }
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0].message).toMatch(
            'Error validating "salto.nested.instance.nestedinst.reqNested":' +
              " Field 'additional' is not defined in the 'simple' type which does not allow additional properties.",
          )
          temp.annotations = simpleTypeClone.annotations
        })
        it('should work properly on maps and lists', async () => {
          const testInstance = new InstanceElement('testinst', topType, {
            mapFieldNonValidating: {
              a: { str: 'str' },
              b: { str: 'str2', additional1: 'do not fail' },
            },
            mapFieldValidating: {
              c: { str: 'str3' },
              d: { str: 'str4', additional4: 'should fail' },
            },
            listFieldValidating: [
              { str: 'str', additional2: 'should fail' },
              { str: 'str2' },
              { str: 'str3', additional3: 'should also fail' },
            ],
            listFieldNonValidating: [
              { str: 'str', additional5: 'should mot fail' },
              { str: 'str2' },
              { str: 'str3', additional6: 'should also not fail' },
            ],
          })
          const errors = await validateElements(
            [testInstance],
            createInMemoryElementSource([testInstance, topType, validatingType, nonValidatingType]),
          )
          expect(errors).toHaveLength(3)
          expect(errors[0].message).toMatch(
            'Error validating "salto.top.instance.testinst.mapFieldValidating.d":' +
              " Field 'additional4' is not defined in the 'validating' type which does not allow additional properties.",
          )
          expect(errors[1].message).toMatch(
            'Error validating "salto.top.instance.testinst.listFieldValidating.0":' +
              " Field 'additional2' is not defined in the 'validating' type which does not allow additional properties.",
          )
          expect(errors[2].message).toMatch(
            'Error validating "salto.top.instance.testinst.listFieldValidating.2":' +
              " Field 'additional3' is not defined in the 'validating' type which does not allow additional properties.",
          )
        })
      })

      describe('values annotation', () => {
        it('should succeed when all values corresponds to values annotation', async () => {
          expect(
            await validateElements(
              [extInst],
              createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
            ),
          ).toHaveLength(0)
        })

        it('should succeed when restriction values are not enforced even if the value not in _values', async () => {
          extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.RESTRICTION] = createRestriction({
            enforce_value: false,
            values: ['val1', 'val2'],
          })
          extInst.value.restrictStr = 'wrongValue'
          extInst.refType = createRefToElmWithValue(extType)
          expect(
            await validateElements(
              [extInst],
              createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
            ),
          ).toHaveLength(0)
        })

        it('should succeed when restriction values is not a list', async () => {
          extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.RESTRICTION] = { values: 'str' }
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.restrictStr = 'str'
          expect(
            await validateElements(
              [extInst],
              createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
            ),
          ).toHaveLength(0)
        })

        it('should succeed when restriction values are not defined and enforce_values is undefined', async () => {
          extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.RESTRICTION] = {}
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.restrictStr = 'str'
          expect(
            await validateElements(
              [extInst],
              createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
            ),
          ).toHaveLength(0)
        })

        it('should succeed when restriction values are not defined and _restriction is undefined', async () => {
          delete extType.fields.restrictStr.annotations[CORE_ANNOTATIONS.RESTRICTION]
          extInst.refType = createRefToElmWithValue(extType)
          extInst.value.restrictStr = 'str'
          expect(
            await validateElements(
              [extInst],
              createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
            ),
          ).toHaveLength(0)
        })

        it('should return an error when value is not inside the range', async () => {
          extInst.value.restrictNumber = -1
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[0].message).toMatch('Value "-1" is not valid')
          expect(errors[0].message).toMatch('bigger than 0 and smaller than 10')
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('restrictNumber'))
        })

        it('should return an error when value is not a number and field has min-max restriction', async () => {
          extInst.value.restrictNumber = 'Not A Number'
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
          )
          expect(errors).toHaveLength(2)
          const [[typeForRangeValidation], [valueTypeValidation]] = _.partition(
            errors,
            error => error instanceof InvalidValueRangeValidationError,
          )
          expect(valueTypeValidation).toBeInstanceOf(InvalidValueTypeValidationError)
          const restrictedNumberElemID = extInst.elemID.createNestedID('restrictNumber')
          expect(valueTypeValidation.elemID).toEqual(restrictedNumberElemID)
          expect(typeForRangeValidation).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(typeForRangeValidation.message).toMatch('Value "Not A Number" is not valid')
          expect(typeForRangeValidation.message).toMatch('bigger than 0 and smaller than 10')
          expect(typeForRangeValidation.elemID).toEqual(restrictedNumberElemID)
        })

        const testValuesAreNotListedButEnforced = async (): Promise<void> => {
          extInst.value.restrictStr = 'wrongValue'
          extInst.value.nested.str = 'wrongValue2'

          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
          )
          expect(errors).toHaveLength(2)

          expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
          expect(errors[0].message).toMatch(`Value "${extInst.value.nested.str}" is not valid`)
          expect(errors[0].message).toMatch('expected one of: "str"')
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', 'str'))

          expect(errors[1]).toBeInstanceOf(InvalidValueValidationError)
          expect(errors[1].message).toMatch(`Value "${extInst.value.restrictStr}" is not valid`)
          expect(errors[1].message).toMatch('expected one of: "restriction1", "restriction2"')
          expect(errors[1].elemID).toEqual(extInst.elemID.createNestedID('restrictStr'))
        }

        it('should return an error when fields values do not match restriction values with explicit _restriction.enforce_value', async () => {
          getRestriction(extType.fields.restrictStr).enforce_value = true
          extInst.refType = createRefToElmWithValue(extType)
          await testValuesAreNotListedButEnforced()
        })

        it('should return an error when annotations values do not match restriction values', async () => {
          extType.fields.restrictedAnnotation.annotations.temp = 'wrong'
          const errors = await validateElements(
            [extType],
            createInMemoryElementSource([extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)

          expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
          expect(errors[0].message).toMatch(
            `Value "${extType.fields.restrictedAnnotation.annotations.temp}" is not valid`,
          )
          expect(errors[0].message).toMatch('expected one of: "val1", "val2"')
          expect(errors[0].elemID).toEqual(extType.elemID.createNestedID('field', 'restrictedAnnotation', 'temp'))
        })

        it('should succeed when annotation value is inside the range', async () => {
          extType.fields.restrictedAnnotation.annotations.range = 7
          const errors = await validateElements(
            [extType],
            createInMemoryElementSource([extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(0)
        })

        it('should return an error when annotations value is bigger than max restriction', async () => {
          extType.fields.restrictedAnnotation.annotations.range = 11
          extType.fields.restrictedAnnotation.annotations.rangeNoMin = 11
          const errors = await validateElements(
            [extType],
            createInMemoryElementSource([extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(2)

          expect(errors[0]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[0].message).toMatch('Value "11" is not valid')
          expect(errors[0].message).toMatch('bigger than 1 and smaller than 10')
          expect(errors[0].elemID).toEqual(extType.elemID.createNestedID('field', 'restrictedAnnotation', 'range'))

          expect(errors[1]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[1].message).toMatch('Value "11" is not valid')
          expect(errors[1].message).toMatch('smaller than 10')
          expect(errors[1].elemID).toEqual(extType.elemID.createNestedID('field', 'restrictedAnnotation', 'rangeNoMin'))
        })

        it('should return an error when annotations value is smaller than min restriction', async () => {
          extType.fields.restrictedAnnotation.annotations.range = 0
          extType.fields.restrictedAnnotation.annotations.rangeNoMax = 0
          const errors = await validateElements(
            [extType],
            createInMemoryElementSource([extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(2)

          expect(errors[0]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[0].message).toMatch('Value "0" is not valid')
          expect(errors[0].message).toMatch('bigger than 1 and smaller than 10')
          expect(errors[0].elemID).toEqual(extType.elemID.createNestedID('field', 'restrictedAnnotation', 'range'))

          expect(errors[1]).toBeInstanceOf(InvalidValueRangeValidationError)
          expect(errors[1].message).toMatch('Value "0" is not valid')
          expect(errors[1].message).toMatch('bigger than 1')
          expect(errors[1].elemID).toEqual(extType.elemID.createNestedID('field', 'restrictedAnnotation', 'rangeNoMax'))
        })

        it('should return validation error on max_length validation on an instance through field annotation', async () => {
          extInst.value.restrictStringLength = 'longer than length limit restriction'
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0]).toBeInstanceOf(InvalidValueMaxLengthValidationError)
        })

        it('should not return validation error on max_length validation if value is not a string', async () => {
          extInst.value.restrictStringLength = {}
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0]).not.toBeInstanceOf(InvalidValueMaxLengthValidationError)
        })

        it('should succeed max_length validation on an instance through field annotation', async () => {
          extInst.value.restrictStringLength = 'a'
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(0)
        })

        it('should return validation error on max_length validation on an instance through the field type', async () => {
          extInst.value.restrictedStringMaxLengthType = 'very long str'
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0]).toBeInstanceOf(InvalidValueMaxLengthValidationError)
        })

        it('should succeed on max_length validation on an instance through the field type', async () => {
          extInst.value.restrictedStringMaxLengthType = 'a'
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(0)
        })

        it('should return error on max_length validation on a restriction on annotation type of a type', async () => {
          objWithRestirctedAnnoType.annotations.withRestriction = 'toooo longgggg'
          const errors = await validateElements(
            [objWithRestirctedAnnoType],
            createInMemoryElementSource([objWithRestirctedAnnoType, restrictedStringMaxLengthType]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0]).toBeInstanceOf(InvalidValueMaxLengthValidationError)
        })

        it('should succeed on max_length validation on a restriction on annotation type of a type', async () => {
          objWithRestirctedAnnoType.annotations.withRestriction = 't'
          const errors = await validateElements(
            [objWithRestirctedAnnoType],
            createInMemoryElementSource([objWithRestirctedAnnoType, restrictedStringMaxLengthType]),
          )
          expect(errors).toHaveLength(0)
        })

        it('should return an error when annotations value does not match regex restriction', async () => {
          extType.fields.restrictedAnnotation.annotations.regexOnlyLower = 'ABC'
          const errors = await validateElements(
            [extType],
            createInMemoryElementSource([
              extType,
              restrictedAnnotation,
              restrictedRegexOnlyLowerType,
              ...(await getFieldsAndAnnoTypes(extType)),
            ]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0]).toBeInstanceOf(RegexMismatchValidationError)
          expect(errors[0].message).toMatch(
            'Value "ABC" is not valid for field regexOnlyLower. expected value to match "^[a-z]*$" regular expression',
          )
          expect(errors[0].elemID).toEqual(
            extType.elemID.createNestedID('field', 'restrictedAnnotation', 'regexOnlyLower'),
          )
        })

        it('should return an error when list fields values do not match restriction values', async () => {
          extType.fields.list.annotations[CORE_ANNOTATIONS.RESTRICTION] = createRestriction({
            values: ['restriction'],
          })
          extInst.refType = createRefToElmWithValue(extType)

          expect(
            await validateElements(
              [extInst],
              createInMemoryElementSource([extInst, extType, ...(await getFieldsAndAnnoTypes(extType))]),
            ),
          ).toHaveLength(2)
        })

        it('should succeed when string value matches regex', async () => {
          extInst.value.restrictStringRegex = 'aaa123'
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
          )
          expect(errors).toHaveLength(0)
        })

        it('should return an error when string value does not match regex restriction', async () => {
          extInst.value.restrictStringRegex = 'AAA_123'
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0]).toBeInstanceOf(RegexMismatchValidationError)
          expect(errors[0].message).toMatch(
            'Value "AAA_123" is not valid for field restrictStringRegex. expected value to match "^[a-z0-9]*$" regular expression',
          )
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('restrictStringRegex'))
        })

        it('should succeed when number value matches regex', async () => {
          extInst.value.restrictNumberRegex = 111
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
          )
          expect(errors).toHaveLength(0)
        })

        it('should return an error when number value does not match regex restriction', async () => {
          extInst.value.restrictNumberRegex = 211
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0]).toBeInstanceOf(RegexMismatchValidationError)
          expect(errors[0].message).toMatch(
            'Value "211" is not valid for field restrictNumberRegex. expected value to match "^1[0-9]*$" regular expression',
          )
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('restrictNumberRegex'))
        })

        it('should return an error when list is longer than restriction', async () => {
          extInst.value.restrictedListLength = [
            'one',
            'two',
            'three',
            'four',
            'five',
            'six',
            'seven',
            'eight',
            'nine',
            'ten',
          ]
          const errors = await validateElements(
            [extInst],
            createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(extType))]),
          )
          expect(errors).toHaveLength(1)
          expect(errors[0]).toBeInstanceOf(InvalidValueMaxListLengthValidationError)
          expect(errors[0].message).toMatch('List of size 10 is too large for field')
          expect(errors[0].message).toMatch('restrictedListLength maximum length is 6')
          expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('restrictedListLength'))
        })
      })
    })

    describe('validate values correctness', () => {
      it('should validate a correct type', async () => {
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should ignore static files that are valid', async () => {
        const objWithFile = new ObjectType({
          elemID: new ElemID('salesforce', 'test'),
          annotationRefsOrTypes: {
            ServiceId: BuiltinTypes.SERVICE_ID,
          },
          fields: {
            someFile: {
              refType: new PrimitiveType({
                elemID: new ElemID('salesforce', 'string'),
                primitive: PrimitiveTypes.STRING,
              }),
            },
          },
        })
        const instWithFile = new InstanceElement('withFile', objWithFile, {
          someFile: new StaticFile({ filepath: 'path', hash: 'hash' }),
        })

        const errors = await validateElements(
          [instWithFile],
          createInMemoryElementSource([instWithFile, objWithFile, ...(await getFieldsAndAnnoTypes(objWithFile))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should fail for invalid static files', async () => {
        const withFileObj = new ObjectType({
          elemID: new ElemID('salesforce', 'test'),
          annotationRefsOrTypes: {
            ServiceId: BuiltinTypes.SERVICE_ID,
          },
          fields: {
            someFile: {
              refType: new PrimitiveType({
                elemID: new ElemID('salesforce', 'string'),
                primitive: PrimitiveTypes.STRING,
              }),
            },
          },
        })
        const instWithFile = new InstanceElement('withFile', withFileObj, {
          someFile: new MissingStaticFile('aa'),
        })

        const errors = await validateElements(
          [instWithFile],
          createInMemoryElementSource([instWithFile, withFileObj, ...(await getFieldsAndAnnoTypes(withFileObj))]),
        )
        expect(errors).toHaveLength(1)
      })

      it('should allow unspecified values', async () => {
        extInst.value.unspecstr = 'unspec'
        extInst.value.unspecnum = 1
        extInst.value.unspecbool = false
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should return error on bad str primitive type', async () => {
        extInst.value.flatstr = 1
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('flatstr'))
        expect(errors[0].message).toMatch(new RegExp('Invalid value type for string$'))
      })

      it('should not return error on str primitive type with list', async () => {
        extInst.value.flatstr = ['str1', 'str2']
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should return error on str primitive type with invalid list', async () => {
        extInst.value.flatstr = ['str1', 57]
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('flatstr', '1'))
        expect(errors[0].message).toMatch(new RegExp('Invalid value type for string$'))
      })

      it('should return error on bad str primitive type with object', async () => {
        extInst.value.flatstr = { obj: 'str' }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('flatstr'))
        expect(errors[0].message).toMatch(new RegExp('Invalid value type for string$'))
      })

      it('should return error on bad num primitive type', async () => {
        extInst.value.flatnum = 'str'
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('flatnum'))
        expect(errors[0].message).toMatch(new RegExp('Invalid value type for number$'))
      })

      it('should return error on bad bool primitive type', async () => {
        extInst.value.flatbool = 'str'
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('flatbool'))
      })

      it('should return error on nested string value mismatch', async () => {
        extInst.value.nested.str = 1
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(2)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', 'str'))
        expect(errors[1].elemID).toEqual(extInst.elemID.createNestedID('nested', 'str'))
      })

      it('should return error on nested num value mismatch', async () => {
        extInst.value.nested.num = 'str'
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', 'num'))
      })

      it('should return error on nested bool value mismatch', async () => {
        extInst.value.nested.bool = 'str'
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', 'bool'))
      })

      it('should return error object/primitive mismatch', async () => {
        extInst.value.nested = 'str'
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(2)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested'))
        expect(errors[1].elemID).toEqual(extInst.elemID.createNestedID('nested', 'bool'))
      })

      it('should not return error on list/primitive mismatch if inner type is valid', async () => {
        extInst.value.list = 'not a list'
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should return error on list/primitive mismatch if inner type is invalid', async () => {
        extInst.value.list = 75
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('list'))
      })

      it('should return error on inconsistent primitive map values', async () => {
        extInst.value.map = { valid: 'string', invalid: 55 }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('map', 'invalid'))
        expect(errors[0].message).toMatch(new RegExp('Invalid value type for string$'))
      })

      it('should return error on inconsistent object map values', async () => {
        extInst.value.mapOfObject.invalid1 = 'aaa'
        extInst.value.mapOfObject.invalid2 = { str: 2, bool: true }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(4)
        expect(errors).toContainEqual(
          expect.objectContaining({
            elemID: extInst.elemID.createNestedID('mapOfObject', 'invalid1'),
            error: 'Invalid value type for salto.simple',
          }),
        )
        expect(errors).toContainEqual(
          expect.objectContaining({
            elemID: extInst.elemID.createNestedID('mapOfObject', 'invalid1', 'bool'),
            error: 'Field bool is required but has no value',
          }),
        )
        expect(errors).toContainEqual(
          expect.objectContaining({
            elemID: extInst.elemID.createNestedID('mapOfObject', 'invalid2', 'str'),
            error: 'Invalid value type for string',
          }),
        )
        expect(errors).toContainEqual(
          expect.objectContaining({
            elemID: extInst.elemID.createNestedID('mapOfObject', 'invalid2', 'str'),
            error: `Value "${extInst.value.mapOfObject.invalid2.str}" is not valid for field str expected one of: "str"`,
          }),
        )
      })

      it('should not return error for list/object mismatch with empty array', async () => {
        extInst.value = { nested: [] }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should return error for list/object mismatch with empty array on required field', async () => {
        const nestedRequiredType = nestedType.clone()
        nestedRequiredType.fields.nested.annotations[CORE_ANNOTATIONS.REQUIRED] = true
        extInst.refType = createRefToElmWithValue(nestedRequiredType)
        extInst.value = { nested: [] }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([
            extInst,
            nestedRequiredType,
            ...(await getFieldsAndAnnoTypes(nestedRequiredType)),
          ]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested'))
        expect(errors[0].error).toMatch('is required but has no value')
      })
      // I'm skiping this since it makes no sense. A value CANT be an array...
      // eslint-disable-next-line
      it.skip('should return error for list/object mismatch with empty array on required field-object', async () => {
        const requiredType = nestedType.clone()
        requiredType.annotations[CORE_ANNOTATIONS.REQUIRED] = true
        extInst.refType = createRefToElmWithValue(requiredType)
        extInst.value = []
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, requiredType, ...(await getFieldsAndAnnoTypes(requiredType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID)
        expect(errors[0].toString()).toMatch('is required but has no value')
      })

      it('should return inner error for list/object mismatch with non-empty invalid array', async () => {
        extInst.value = { nested: [{ bool: true }, { str: 'str' }] }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('nested', '1', 'bool'))
      })

      it('should not return error list/object mismatch with non-empty valid array', async () => {
        extInst.value = { nested: [{ bool: true }] }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should not return error list/object mismatch with non-empty array with reference expressions', async () => {
        extInst.value = {
          flatnum: 32,
          nested: [
            {
              bool: true,
              num: new ReferenceExpression(extInst.elemID.createNestedID('flatnum')),
            },
          ],
        }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should not return an error when matching list item', async () => {
        extInst.value.list.push('abc')
        const nestedTypes = await getFieldsAndAnnoTypes(nestedType)
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...nestedTypes]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should return error in list of list item mismatch', async () => {
        extInst.value.listOfList[0].push(1)
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('listOfList', '0', '2'))
      })

      it('should not return an error when matching list object item', async () => {
        extInst.value.listOfObject.push({
          str: 'str',
          num: 3,
          bool: false,
        })
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should not return error when inner is not a list in list of lists', async () => {
        extInst.value.listOfList = ['a']
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should not return error when not a list in list of lists', async () => {
        extInst.value.listOfList = 'a'
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should not return error when not a list in list-of-lists-of-lists', async () => {
        extInst.value.listOfListOfList = 'a'
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should not return error when item instead of list if item is of inner type', async () => {
        extInst.value.listOfObject = {
          str: 'str',
          num: 3,
          bool: false,
        }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should return error when item instead of list if item is of incorrect type', async () => {
        extInst.value.listOfObject = {
          str: 'str',
          num: 'str',
          bool: false,
        }
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('listOfObject', 'num'))
      })

      it('should return an error when not matching list object item (missing req)', async () => {
        extInst.value.listOfObject.push({
          abc: 'dsadas',
        })
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('listOfObject', '1', 'bool'))
      })

      it('should return an error when primitive instead of list object item', async () => {
        extInst.value.listOfObject.push(1)
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(2)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('listOfObject', '1'))
        // TODO: The second error is a strange UX and we should not have it
        expect(errors[1].elemID).toEqual(extInst.elemID.createNestedID('listOfObject', '1', 'bool'))
      })

      it('should return error list item mismatch', async () => {
        extInst.value.list.push(1)
        const errors = await validateElements(
          [extInst],
          createInMemoryElementSource([extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(extInst.elemID.createNestedID('list', '2'))
      })

      it('should allow all value types for unknown field type', async () => {
        const unknownObj = new ObjectType({
          elemID: new ElemID('salto', 'unknown'),
          fields: {
            unknown: { refType: BuiltinTypes.UNKNOWN },
          },
        })

        const numValue = new InstanceElement('numInst', unknownObj, { unknown: 1 })
        const strValue = new InstanceElement('numInst', unknownObj, { unknown: 'O' })
        const booValue = new InstanceElement('numInst', unknownObj, { unknown: true })
        const arrValue = new InstanceElement('numInst', unknownObj, { unknown: [0] })
        const objValue = new InstanceElement('numInst', unknownObj, { unknown: { o: 'o' } })
        const elements = [numValue, strValue, booValue, arrValue, objValue, unknownObj]
        const errors = await validateElements(
          elements,
          createInMemoryElementSource([...elements, ...(await getFieldsAndAnnoTypes(unknownObj))]),
        )
        expect(errors).toHaveLength(0)
      })
    })

    describe('reference validation', () => {
      it('should return error when encountering an unresolved reference', async () => {
        const errors = await validateElements(
          [unresolvedRefInst],
          createInMemoryElementSource([unresolvedRefInst, simpleType]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(unresolvedRefInst.elemID.createNestedID('bool'))
      })

      it('should return error when encountering a circular reference', async () => {
        const errors = await validateElements(
          [circularRefInst, circularRefInst2],
          createInMemoryElementSource([circularRefInst, circularRefInst2, simpleType]),
        )
        expect(errors).toHaveLength(2)
        const circErr = errors.find(err => err instanceof CircularReferenceValidationError)
        expect(circErr?.elemID).toEqual(circularRefInst.elemID.createNestedID('bool'))
      })

      it('should return error when encountering a reference to self', async () => {
        const refToSelfInst = new InstanceElement('unresolved', simpleType, {
          str: 'str',
          num: 12,
        })
        refToSelfInst.value.bool = new ReferenceExpression(refToSelfInst.elemID.createNestedID('bool'))
        const errors = await validateElements([refToSelfInst], createInMemoryElementSource([refToSelfInst, simpleType]))
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(refToSelfInst.elemID.createNestedID('bool'))
        expect(errors[0]).toBeInstanceOf(CircularReferenceValidationError)
      })

      it('should validate throw error on reference that points to a bad type', async () => {
        const errors = await validateElements(
          [wrongRefInst, extInst],
          createInMemoryElementSource([
            wrongRefInst,
            extInst,
            simpleType,
            nestedType,
            ...(await getFieldsAndAnnoTypes(nestedType)),
          ]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(wrongRefInst.elemID.createNestedID('bool'))
      })

      it('should return error when encountering an illegal reference target', async () => {
        const errors = await validateElements(
          [illegalRefInst],
          createInMemoryElementSource([illegalRefInst, simpleType]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(illegalRefInst.elemID.createNestedID('bool'))
        expect(errors[0]).toBeInstanceOf(IllegalReferenceValidationError)
      })
    })

    describe('variable validation', () => {
      it('should return error when encountering an unresolved variable expression', async () => {
        const errors = await validateElements([varInst], createInMemoryElementSource([varInst, simpleType]))
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(UnresolvedReferenceValidationError)
        expect(errors[0].elemID).toEqual(varInst.elemID.createNestedID('bool'))
      })

      it('should not return error when encountering a valid variable expression', async () => {
        const errors = await validateElements(
          [varInst, variable],
          createInMemoryElementSource([varInst, variable, simpleType]),
        )
        expect(errors).toHaveLength(0)
      })
      it("should return error when the type of a variable's value is incorrect", async () => {
        const errors = await validateElements(
          [illegalValueVarInst, variable],
          createInMemoryElementSource([illegalValueVarInst, variable, simpleType]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueTypeValidationError)
        expect(errors[0].elemID).toEqual(varInst.elemID.createNestedID('num'))
      })
      it('should return error when a Variable element serves as a value', async () => {
        const varElementInst = new InstanceElement('withVarElement', noRestrictionsType, {
          someVal: new Variable(varElemId, 5),
        })
        const errors = await validateElements(
          [varElementInst],
          createInMemoryElementSource([
            varElementInst,
            noRestrictionsType,
            ...(await getFieldsAndAnnoTypes(noRestrictionsType)),
          ]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
        expect(errors[0].elemID).toEqual(varElementInst.elemID.createNestedID('someVal'))
        expect(errors[0].message).toMatch('not a variable')
      })
      it('should return error when the value is an object (not supported for now)', async () => {
        const objVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'objVar')
        const objVar = new Variable(objVarElemId, { key: 'val' })
        const errors = await validateElements([objVar], createInMemoryElementSource([objVar]))
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
        expect(errors[0].elemID).toEqual(objVarElemId)
        expect(errors[0].message).toMatch('Value "{"key":"val"}" is not valid for field objVar')
      })
      it('should return error when the value is a reference to an element', async () => {
        const instVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'instVar')
        const objVar = new Variable(instVarElemId, new ReferenceExpression(extInst.elemID))
        const errors = await validateElements(
          [objVar, extInst],
          createInMemoryElementSource([objVar, extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
        expect(errors[0].elemID).toEqual(instVarElemId)
        expect(errors[0].message).toMatch('Value "{"elemID":{"adapter":"..." is not valid for field instVar')
        expect(errors[0].message).toMatch('a primitive')
      })
      it('should return error when the value is a reference to an object', async () => {
        const instVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'instVar')
        const objVar = new Variable(instVarElemId, new ReferenceExpression(extInst.elemID.createNestedID('nested')))
        const errors = await validateElements(
          [objVar, extInst],
          createInMemoryElementSource([objVar, extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(InvalidValueValidationError)
        expect(errors[0].elemID).toEqual(instVarElemId)
        expect(errors[0].message).toMatch('Value "{"str":"str","num":1,"..." is not valid for field instVar')
        expect(errors[0].message).toMatch('a primitive')
      })
      it('should return error when the value is an unresolved reference', async () => {
        const refVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'refVar')
        const refVar = new Variable(refVarElemId, new ReferenceExpression(new ElemID('salesforce', 'nonexistent')))
        const errors = await validateElements([refVar], createInMemoryElementSource([refVar]))
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(UnresolvedReferenceValidationError)
        expect(errors[0].elemID).toEqual(refVarElemId)
      })
      it('should return error when there is a circular reference of variables', async () => {
        const refVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'refVar')
        const refVarElemId2 = new ElemID(ElemID.VARIABLES_NAMESPACE, 'refVar2')
        const refVar = new Variable(refVarElemId, new VariableExpression(refVarElemId2))
        const refVar2 = new Variable(refVarElemId2, new VariableExpression(refVarElemId))
        const errors = await validateElements([refVar, refVar2], createInMemoryElementSource([refVar, refVar2]))
        expect(errors).toHaveLength(2)
        expect(errors[0]).toBeInstanceOf(CircularReferenceValidationError)
        expect(errors[0].elemID).toEqual(refVarElemId)
      })
      it('should return error when the value is referencing itself', async () => {
        const refVarElemId = new ElemID(ElemID.VARIABLES_NAMESPACE, 'refVar')
        const refVar = new Variable(refVarElemId, new VariableExpression(refVarElemId))
        const errors = await validateElements([refVar], createInMemoryElementSource([refVar]))
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(CircularReferenceValidationError)
        expect(errors[0].elemID).toEqual(refVarElemId)
      })
      it('should not return error when the value is a number/string/boolean', async () => {
        const numVar = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'numVar'), 6)
        const boolVar = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'boolVar'), true)
        const strVar = new Variable(new ElemID(ElemID.VARIABLES_NAMESPACE, 'strVar'), 'hi')
        const errors = await validateElements(
          [numVar, boolVar, strVar],
          createInMemoryElementSource([numVar, boolVar, strVar]),
        )
        expect(errors).toHaveLength(0)
      })
      it('should not return error when the value is a reference to a primitive', async () => {
        const numVar = new Variable(
          new ElemID(ElemID.VARIABLES_NAMESPACE, 'numVar'),
          new ReferenceExpression(extInst.elemID.createNestedID('flatnum')),
        )
        const errors = await validateElements(
          [numVar, extInst],
          createInMemoryElementSource([numVar, extInst, nestedType, ...(await getFieldsAndAnnoTypes(nestedType))]),
        )
        expect(errors).toHaveLength(0)
      })
    })

    describe('validate instance annotations', () => {
      const unresolvedRefInAnnoInst = new InstanceElement('unresolved', emptyType, {}, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [
          'valid value',
          new ReferenceExpression(nestedInstance.elemID.createNestedID('unresolvedParent')),
        ],
      })

      it('should return error when encountering an unresolved reference', async () => {
        const errors = await validateElements(
          [unresolvedRefInAnnoInst],
          createInMemoryElementSource([unresolvedRefInAnnoInst, emptyType]),
        )
        expect(errors).toHaveLength(1)
        expect(errors[0].elemID).toEqual(unresolvedRefInAnnoInst.elemID.createNestedID(CORE_ANNOTATIONS.PARENT, '1'))
      })
    })

    describe('validate fields that are unmatched to ObjectType', () => {
      const someType = new ObjectType({
        elemID: new ElemID('salto', 'test'),
        fields: {
          someField: {
            refType: BuiltinTypes.STRING,
          },
        },
      })

      it('should validate unmatched field with legal value with no errors', async () => {
        const instanceWithUnMatchedField = new InstanceElement('instanceWithUnMatchedAndUnresolvedField', someType, {
          someField: 'str',
          unExpectedField: 3,
        })
        const errors = await validateElements(
          [instanceWithUnMatchedField],
          createInMemoryElementSource([someType, ...(await getFieldsAndAnnoTypes(someType))]),
        )
        expect(errors).toHaveLength(0)
      })

      it('should validated unmatched fields and return unresolved reference error', async () => {
        const instanceWithUnMatchedAndUnresolvedField = new InstanceElement(
          'instanceWithUnMatchedAndUnresolvedField',
          someType,
          {
            someField: 'str',
            unExpectedField: new ReferenceExpression(new ElemID('salto', 'test', 'field', 'noSuchField')),
          },
        )
        const errors = await validateElements(
          [instanceWithUnMatchedAndUnresolvedField],
          createInMemoryElementSource([someType, ...(await getFieldsAndAnnoTypes(someType))]),
        )
        expect(errors).toHaveLength(1)
      })

      it('should validated unmatched nested fields and return unresolved reference error', async () => {
        const instanceWithUnMatchedAndUnresolvedField = new InstanceElement(
          'instanceWithUnMatchedAndUnresolvedField',
          someType,
          {
            someField: 'str',
            nested: {
              unExpectedField: new ReferenceExpression(new ElemID('salto', 'test', 'field', 'noSuchField')),
            },
          },
        )
        const errors = await validateElements(
          [instanceWithUnMatchedAndUnresolvedField],
          createInMemoryElementSource([someType, ...(await getFieldsAndAnnoTypes(someType))]),
        )
        expect(errors).toHaveLength(1)
      })

      it('should validated unmatched nested fields when some are resolved and some are not and return error for all unresolved unmatched nested fields', async () => {
        const instanceWithUnMatchedAndUnresolvedField = new InstanceElement(
          'instanceWithUnMatchedAndUnresolvedField',
          someType,
          {
            someField: 'str',
            unExpectedResolvedField: 2,
            nested: {
              unExpectedField: new ReferenceExpression(new ElemID('salto', 'test', 'field', 'noSuchField')),
              nested2: {
                resolvedField: 'str',
                unResolvedField: new ReferenceExpression(new ElemID('salto', 'test', 'field', 'noSuchField')),
                unResolvedField2: new ReferenceExpression(new ElemID('salto', 'test', 'field', 'noSuchField')),
              },
            },
          },
        )
        const errors = await validateElements(
          [instanceWithUnMatchedAndUnresolvedField],
          createInMemoryElementSource([someType, ...(await getFieldsAndAnnoTypes(someType))]),
        )
        expect(errors).toHaveLength(3)
      })
    })

    it('should throw an error when an instance type is not found', async () => {
      const instance = new InstanceElement('name', new TypeReference(new ElemID('instance', 'notExists')))
      const errors = await validateElements([instance], createInMemoryElementSource([instance]))
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe(
        'Error validating "instance.notExists.instance.name": type notExists of instance name does not exist',
      )
    })

    it('should handle circular references in the same instance', async () => {
      const type = new ObjectType({ elemID: new ElemID('instance', 'type') })
      const instance = new InstanceElement('name', type)

      instance.value.a = {
        ref: new ReferenceExpression(instance.elemID.createNestedID('a')),
      }

      instance.value.a.ref.value = instance.value.a

      const errors = await validateElements([instance], createInMemoryElementSource([instance, type]))
      expect(errors).toHaveLength(0)
    })

    it('should handle circular references in two instances', async () => {
      const type = new ObjectType({ elemID: new ElemID('instance', 'type') })
      const instance1 = new InstanceElement('name', type, {
        value: 1,
      })

      const instance2 = new InstanceElement('name', type, {
        value: 1,
      })

      instance1.value.a = {
        ref: new ReferenceExpression(instance2.elemID.createNestedID('a'), instance2.value.a),
      }

      instance2.value.a = {
        ref: new ReferenceExpression(instance1.elemID.createNestedID('a'), instance1.value.a),
      }

      const errors = await validateElements(
        [instance1, instance2],
        createInMemoryElementSource([instance1, instance2, type]),
      )
      expect(errors).toHaveLength(0)
    })
  })

  describe('InvalidStaticFileError', () => {
    const elemID = new ElemID('adapter', 'bla')
    it('should have correct message for missing', () =>
      expect(new InvalidStaticFileError({ elemID, error: new MissingStaticFile('path').message }).message).toEqual(
        'Error validating "adapter.bla": Missing static file: path',
      ))
    it('should have correct message for invalid', () =>
      expect(new InvalidStaticFileError({ elemID, error: new AccessDeniedStaticFile('path').message }).message).toEqual(
        'Error validating "adapter.bla": Unable to access static file: path',
      ))
  })
})
