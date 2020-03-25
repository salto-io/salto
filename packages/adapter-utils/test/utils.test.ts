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
  Field, InstanceElement, ObjectType, PrimitiveTypes, PrimitiveType, TypeMap,
  ReferenceExpression, Values, TemplateExpression, Value,
  ElemID, InstanceAnnotationTypes,
  BuiltinTypes, INSTANCE_ANNOTATIONS,
  isPrimitiveType, FunctionExpression, ListType, isListType,
} from '@salto-io/adapter-api'

import {
  transformValues, resolvePath, TransformPrimitiveFunc,
  TransformReferenceFunc, restoreReferences, resolveReferences,
  bpCase, findElement, findElements, findObjectType, findInstances,
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
      ref: new Field(mockElem, 'ref', BuiltinTypes.STRING),
      str: new Field(mockElem, 'str', BuiltinTypes.STRING, {
        testAnno: 'TEST FIELD ANNO',
      }),
      bool: new Field(mockElem, 'bool', BuiltinTypes.BOOLEAN),
      num: new Field(mockElem, 'num', BuiltinTypes.NUMBER),
      numArray: new Field(mockElem, 'numArray', new ListType(BuiltinTypes.NUMBER), {}),
      strArray: new Field(mockElem, 'strArray', new ListType(BuiltinTypes.STRING), {}),
      obj: new Field(mockElem, 'obj', new ListType(new ObjectType({
        elemID: mockElem,
        fields: {
          field: new Field(mockElem, 'field', BuiltinTypes.STRING),
          value: new Field(mockElem, 'value', BuiltinTypes.STRING),
          innerObj: new Field(mockElem, 'innerObj', new ObjectType({
            elemID: mockElem,
            fields: {
              name: new Field(mockElem, 'name', BuiltinTypes.STRING),
              listOfNames: new Field(mockElem, 'listOfNames', new ListType(BuiltinTypes.STRING), {}),
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
      })), {}),
    },
  })

  const regValue = 'regValue'
  const valueRef = new ReferenceExpression(mockElem, regValue)

  const mockInstance = new InstanceElement(
    'mockInstance',
    mockType,
    {
      ref: valueRef,
      str: 'val',
      bool: 'true',
      num: '99',
      numArray: ['12', '13', '14'],
      strArray: 'should be list',
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
      simplefunc: new FunctionExpression('funcush', ['aaa'], 'none'),
      severalfunc: new FunctionExpression('several', [false, 123, 'aaa'], 'none'),
      listfunc: new FunctionExpression('list', [[1, 2, 3]], 'none'),
      objfunc: new FunctionExpression('obj', [{ aaa: 321, bbb: 'fff' }], 'none'),
      mixedfunc: new FunctionExpression('mixed', [true, [1, 2, 3], 'ZOMG'], 'none'),
      filefunc: new FunctionExpression('file', ['some/path.ext'], 'none'),
    },
    [],
    {
      [INSTANCE_ANNOTATIONS.DEPENDS_ON]: valueRef,
    },
  )

  describe('transformValues func', () => {
    let resp: Values

    describe('with empty values', () => {
      it('should return undefined', () => {
        expect(transformValues({ values: {}, type: mockType })).toBeUndefined()
      })
    })

    describe('with empty transformPrimitives func', () => {
      let transformPrimitiveFunc: jest.Mock
      let transformReferenceFunc: jest.Mock

      beforeEach(() => {
        transformPrimitiveFunc = jest.fn().mockImplementation(val => val)
        transformReferenceFunc = jest.fn().mockImplementation(val => val)
      })

      describe('when called with objectType as type parameter', () => {
        beforeEach(async () => {
          const result = transformValues({
            values: mockInstance.value,
            type: mockType,
            transformPrimitives: transformPrimitiveFunc,
            transformReferences: transformReferenceFunc,
          })

          expect(result).toBeDefined()
          resp = result as Values
        })

        it('should call transform on top level primitive values', () => {
          const primitiveFieldNames = ['str', 'bool', 'num']
          primitiveFieldNames.forEach(field => {
            expect(transformPrimitiveFunc).toHaveBeenCalledWith(
              mockInstance.value[field], undefined, mockType.fields[field],
            )
          })
        })

        it('should call transform on top level references values', () => {
          const referenceFieldNames = ['ref']
          referenceFieldNames.forEach(field => {
            expect(transformReferenceFunc).toHaveBeenCalledWith(
              mockInstance.value[field], undefined,
            )
          })
        })

        it('should call transform on non-list types even for list types', () => {
          expect(isListType(mockType.fields.strArray.type)).toBeTruthy()
          expect(transformPrimitiveFunc).toHaveBeenCalledWith(
            mockInstance.value.strArray,
            undefined,
            new Field(
              mockType.fields.strArray.elemID.createParentID(),
              mockType.fields.strArray.name,
              (mockType.fields.strArray.type as ListType).innerType,
              mockType.fields.strArray.annotations,
            )
          )
        })

        it('should call transform on array elements', () => {
          const numArrayFieldType = mockType.fields.numArray.type
          expect(isListType(numArrayFieldType)).toBeTruthy()
          const numArrayValues = (mockInstance.value.numArray as string[])
          numArrayValues.forEach(
            val => expect(transformPrimitiveFunc).toHaveBeenCalledWith(
              val,
              undefined,
              new Field(
                mockType.fields.numArray.elemID.createParentID(),
                mockType.fields.numArray.name,
                (numArrayFieldType as ListType).innerType,
                mockType.fields.numArray.annotations,
              )
            )
          )
        })

        it('should call transform on primitive types in nested objects', () => {
          const getField = (type: ObjectType | ListType, path: (string | number)[]): Field => {
            if (typeof path[0] === 'number' && isListType(type)) {
              return getField((type.innerType as ObjectType | ListType), path.slice(1))
            }
            const field = (type as ObjectType).fields[path[0]]
            return path.length === 1 ? field
              : getField(field.type as ObjectType | ListType, path.slice(1))
          }
          const nestedPrimitivePaths = [
            ['obj', 0, 'field'],
            ['obj', 1, 'field'],
            ['obj', 2, 'field'],
            ['obj', 0, 'innerObj', 'name'],
            ['obj', 0, 'innerObj', 'magical', 'deepName'],
          ]
          nestedPrimitivePaths.forEach(
            path => expect(transformPrimitiveFunc).toHaveBeenCalledWith(
              _.get(mockInstance.value, path), undefined, getField(mockType, path),
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

      describe('when called with instance annotations', () => {
        beforeEach(async () => {
          const result = transformValues({
            values: mockInstance.annotations,
            type: InstanceAnnotationTypes,
            transformPrimitives: transformPrimitiveFunc,
            transformReferences: transformReferenceFunc,
          })
          expect(result).toEqual(mockInstance.annotations)
        })


        it('should call transform on instance annotation references values', () => {
          const referenceAnnotationNames = [INSTANCE_ANNOTATIONS.DEPENDS_ON]
          referenceAnnotationNames.forEach(annotation => {
            expect(transformReferenceFunc).toHaveBeenCalledWith(
              mockInstance.annotations[annotation], undefined,
            )
          })
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
            nums: new ListType(BuiltinTypes.NUMBER),
          }
          const result = transformValues(
            {
              values: origValue,
              type: typeMap,
              transformPrimitives: transformPrimitiveFunc,
              transformReferences: transformReferenceFunc,
            }
          )

          expect(result).toBeDefined()
          resp = result as Values
        })
        it('should call transform func on all defined types', () => {
          const primitiveTypes = ['str', 'num', 'bool']
          primitiveTypes.forEach(
            name => expect(transformPrimitiveFunc).toHaveBeenCalledWith(
              origValue[name],
              undefined,
              new Field(new ElemID(''), name, typeMap[name])
            )
          )
          origValue.nums.forEach(
            (val: string) => expect(transformPrimitiveFunc).toHaveBeenCalledWith(
              val,
              undefined,
              new Field(new ElemID(''), 'nums', BuiltinTypes.NUMBER)
            )
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

    const transformPrimitiveTest: TransformPrimitiveFunc = (val, _pathID, field) => {
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


    const transformReferenceTest: TransformReferenceFunc = val =>
      val.value


    describe('when transformPrimitives and transformReference was received', () => {
      describe('when called with instance values', () => {
        beforeEach(async () => {
          const result = transformValues({
            values: mockInstance.value,
            type: mockType,
            transformPrimitives: transformPrimitiveTest,
            transformReferences: transformReferenceTest,
          })
          expect(result).toBeDefined()
          resp = result as Values
        })

        it('should transform primitive types', () => {
          expect(resp.str).toEqual('val')
          expect(resp.bool).toEqual(true)
          expect(resp.num).toEqual(99)
        })

        it('should transform reference types', () => {
          expect(resp.ref).toEqual('regValue')
        })

        it('should transform inner object', () => {
          expect(resp.obj[0].innerObj.magical.deepNumber).toEqual(888)
        })
      })
    })

    describe('when strict is false', () => {
      beforeEach(async () => {
        const result = transformValues(
          {
            values: mockInstance.value,
            type: mockType,
            transformPrimitives: transformPrimitiveTest,
            transformReferences: transformReferenceTest,
            strict: false,
          }
        )
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

  describe('resolveReferences func', () => {
    const instanceName = 'Instance'
    const objectName = 'Object'
    const newValue = 'NEW'
    const elementID = new ElemID('salesforce', 'elememt')
    const element = new ObjectType({
      elemID: elementID,
      annotationTypes: {
        refValue: BuiltinTypes.STRING,
        reg: BuiltinTypes.STRING,

      },
      annotations: {
        name: objectName,
        typeRef: new ReferenceExpression(
          elementID.createNestedID('annotation', 'name'), objectName
        ),
      },
      fields: {
        refValue: new Field(mockElem, 'refValue', BuiltinTypes.STRING),
        arrayValues: new Field(mockElem, 'refValue', new ListType(BuiltinTypes.STRING), {}),
      },
    })

    const refTo = ({ elemID }: { elemID: ElemID }, ...path: string[]): ReferenceExpression => (
      new ReferenceExpression(
        elemID.createNestedID(...path)
      )
    )

    const elemID = new ElemID('salesforce', 'base')

    const refType = new ObjectType({
      elemID: new ElemID('salto', 'simple'),
    })

    const firstRef = new InstanceElement(
      'first',
      refType,
      { from: 'Milano', to: 'Minsk' }
    )
    const instance = new InstanceElement('instance', element, {
      name: instanceName,
      refValue: valueRef,
      into: new TemplateExpression({
        parts: [
          'Well, you made a long journey from ',
          refTo(firstRef, 'from'),
          ' to ',
          refTo(firstRef, 'to'),
          ', Rochelle Rochelle',
        ],
      }),
      arrayValues: [
        regValue,
        valueRef,
      ],
    },
    [],
    {
      [INSTANCE_ANNOTATIONS.DEPENDS_ON]: valueRef,
    },)
    const elementRef = new ReferenceExpression(element.elemID, element)

    const sourceElement = new ObjectType({
      elemID,
      annotationTypes: {
        refValue: BuiltinTypes.STRING,
        objectRef: BuiltinTypes.STRING,
        reg: BuiltinTypes.STRING,
      },
      annotations: {
        objectRef: elementRef,
        refValue: valueRef,
        reg: regValue,
      },
      fields: {
        field: new Field(elemID, 'field', element, {
          reg: regValue,
          refValue: valueRef,
        }),
      },
    })

    const getName = (refValue: Value): Value =>
      refValue

    describe('resolveReferences on objectType', () => {
      let sourceElementCopy: ObjectType
      let resolvedElement: ObjectType

      beforeAll(async () => {
        sourceElementCopy = sourceElement.clone()
        resolvedElement = resolveReferences(sourceElement, getName)
      })

      it('should not modify the source element', () => {
        expect(sourceElement).toEqual(sourceElementCopy)
      })

      it('should transform element ref values', () => {
        expect(resolvedElement.annotations.refValue).toEqual(regValue)
        expect(resolvedElement.annotations.objectRef).toEqual(element)

        expect(resolvedElement.fields.field.annotations.refValue).toEqual(regValue)
      })

      it('should transform regular values', () => {
        expect(resolvedElement.annotations.reg).toEqual(regValue)
        expect(resolvedElement.fields.field.annotations.reg).toEqual(regValue)
      })

      it('should transform back to sourceElement value', () => {
        expect(restoreReferences(sourceElement, resolvedElement, getName)).toEqual(sourceElement)
      })

      it('should maintain new values when transforming back to orig value', () => {
        const after = resolvedElement.clone()
        after.annotations.new = newValue
        after.annotationTypes.new = BuiltinTypes.STRING
        after.fields.field.annotations.new = newValue
        after.annotations.regValue = newValue
        after.annotationTypes.regValue = BuiltinTypes.STRING
        after.fields.field.annotations.regValue = newValue

        const restored = restoreReferences(sourceElement, after, getName)
        expect(restored.annotations.new).toEqual(newValue)
        expect(restored.annotations.regValue).toEqual(newValue)

        expect(restored.fields.field.annotations.new).toEqual(newValue)
        expect(restored.fields.field.annotations.regValue).toEqual(newValue)
      })
    })

    describe('resolveReferences on instance', () => {
      let resolvedInstance: InstanceElement

      beforeAll(async () => {
        resolvedInstance = resolveReferences(instance, getName)
      })

      it('should transform instanceElement', () => {
        expect(resolvedInstance.value.name).toEqual(instance.value.name)
        expect(resolvedInstance.value.refValue).toEqual(regValue)
        expect(resolvedInstance.value.arrayValues).toHaveLength(2)
        expect(resolvedInstance.value.arrayValues[0]).toEqual(regValue)
        expect(resolvedInstance.value.arrayValues[1]).toEqual(regValue)

        expect(resolvedInstance.annotations[INSTANCE_ANNOTATIONS.DEPENDS_ON]).toEqual(regValue)
      })

      it('should transform back to instance', () => {
        expect(restoreReferences(instance, resolvedInstance, getName)).toEqual(instance)
      })
    })

    describe('resolveReferences on primitive', () => {
      const prim = new PrimitiveType({
        elemID: new ElemID('mockAdapter', 'str'),
        primitive: PrimitiveTypes.STRING,
        annotationTypes: {
          testAnno: BuiltinTypes.STRING,
          testNumAnno: BuiltinTypes.NUMBER,
          refAnno: BuiltinTypes.STRING,
        },
        annotations: {
          testAnno: 'TEST ANNO TYPE',
          testNumAnno: 34,
          refAnno: valueRef,
        },
      })

      let resolvedPrim: PrimitiveType

      beforeAll(async () => {
        resolvedPrim = resolveReferences(prim, getName)
      })


      it('should transform primitive', () => {
        expect(resolvedPrim).not.toEqual(prim)

        expect(resolvedPrim.primitive).toEqual(prim.primitive)
        expect(resolvedPrim.elemID).toEqual(prim.elemID)
        expect(resolvedPrim.path).toEqual(prim.path)
        expect(resolvedPrim.annotationTypes).toEqual(prim.annotationTypes)

        expect(resolvedPrim.annotations).not.toEqual(prim.annotations)
        expect(resolvedPrim.annotations.refAnno).toEqual(regValue)
      })

      it('should transform back to primitive', () => {
        expect(restoreReferences(prim, resolvedPrim, getName)).toEqual(prim)
      })
    })

    describe('resolveReferences on field', () => {
      const FieldType = new ObjectType({
        elemID,
        annotationTypes: {
          testAnno: BuiltinTypes.STRING,
          testNumAnno: BuiltinTypes.NUMBER,
          refAnno: BuiltinTypes.STRING,
        },
      })

      const field = new Field(elemID, 'field', FieldType, {
        testAnno: 'TEST ANNO TYPE',
        testNumAnno: 34,
        refAnno: valueRef,
      })

      let resolvedField: Field

      beforeAll(async () => {
        resolvedField = resolveReferences(field, getName)
      })


      it('should transform field', () => {
        expect(resolvedField).not.toEqual(field)

        expect(resolvedField.type).toEqual(field.type)
        expect(resolvedField.name).toEqual(field.name)
        expect(resolvedField.elemID).toEqual(field.elemID)
        expect(resolvedField.path).toEqual(field.path)
        expect(resolvedField.parentID).toEqual(field.parentID)

        expect(resolvedField.annotations).not.toEqual(field.annotations)
        expect(resolvedField.annotations.refAnno).toEqual(regValue)
        expect(resolvedField.annotations.testAnno).toEqual(field.annotations.testAnno)
      })

      it('should transform back to field', () => {
        expect(restoreReferences(field, resolvedField, getName)).toEqual(field)
      })
    })
  })
  describe('bpCase func', () => {
    describe('names without special characters', () => {
      const normalNames = [
        'Offer__c', 'Lead', 'DSCORGPKG__DiscoverOrg_Update_History__c', 'NameWithNumber2',
        'CRMFusionDBR101__Scenario__C',
      ]
      it('should remain the same', () => {
        normalNames.forEach(name => expect(bpCase(name)).toEqual(name))
      })
    })

    describe('names with spaces', () => {
      it('should be replaced with _', () => {
        expect(bpCase('Analytics Cloud Integration User')).toEqual('Analytics_Cloud_Integration_User')
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

  describe('findElement functions', () => {
    /**   ElemIDs   * */
    const primID = new ElemID('test', 'prim')

    /**   primitives   * */
    const primStr = new PrimitiveType({
      elemID: primID,
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {},
      annotations: {},
    })

    const primNum = new PrimitiveType({
      elemID: primID,
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {},
      annotations: {},
    })

    /**   object types   * */
    const otID = new ElemID('test', 'obj')
    const ot = new ObjectType({
      elemID: otID,
      fields: {
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        num_field: new Field(otID, 'num_field', primNum),
        /* eslint-disable-next-line @typescript-eslint/camelcase */
        str_field: new Field(otID, 'str_field', primStr),
      },
      annotationTypes: {},
      annotations: {},
    })

    const instances = [
      new InstanceElement('1', ot, {}),
      new InstanceElement('2', ot, {}),
    ]
    const elements = [primStr, primStr, ot, ...instances]
    describe('findElements', () => {
      it('should find all elements with the requested id', () => {
        expect([...findElements(elements, primID)]).toEqual([primStr, primStr])
      })
    })
    describe('findElement', () => {
      it('should find any matching element', () => {
        expect(findElement(elements, ot.elemID)).toBe(ot)
        expect(findElement(elements, primID)).toBe(primStr)
      })
      it('should return undefined if there is no matching element', () => {
        expect(findElement([], primID)).toBeUndefined()
      })
    })
    describe('findObjectType', () => {
      it('should find object type by ID', () => {
        expect(findObjectType(elements, ot.elemID)).toBe(ot)
      })
      it('should not find non-object types', () => {
        expect(findObjectType(elements, primID)).toBeUndefined()
      })
    })
    describe('findInstances', () => {
      it('should find all instances of a given type', () => {
        expect([...findInstances(elements, ot.elemID)]).toEqual(instances)
      })
    })
  })
})
