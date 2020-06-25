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
  ElemID, InstanceAnnotationTypes, isListType, ListType,
  BuiltinTypes, INSTANCE_ANNOTATIONS, StaticFile,
  isPrimitiveType,
  isReferenceExpression,
  isPrimitiveValue, CORE_ANNOTATIONS, FieldMap,
} from '@salto-io/adapter-api'

import {
  transformValues, resolvePath, TransformFunc, restoreValues, resolveValues,
  naclCase, findElement, findElements, findObjectType, GetLookupNameFunc,
  findInstances, flattenElementStr, valuesDeepSome, filterByID,
  flatValues, mapKeysRecursive, createDefaultInstanceFromType, applyInstancesDefaults,
} from '../src/utils'
import { mockFunction } from './common'

describe('Test utils.ts', () => {
  const mockStrType = new PrimitiveType({
    elemID: new ElemID('mockAdapter', 'str'),
    primitive: PrimitiveTypes.STRING,
    annotations: { testAnno: 'TEST ANNO TYPE' },
    path: ['here', 'we', 'go'],
  })
  const mockElem = new ElemID('mockAdapter', 'test')
  const mockType = new ObjectType({
    elemID: mockElem,
    annotationTypes: {
      testAnno: mockStrType,
    },
    annotations: {
      testAnno: 'TEST ANNO',
    },
    fields: {
      ref: { type: BuiltinTypes.STRING },
      str: { type: BuiltinTypes.STRING, annotations: { testAnno: 'TEST FIELD ANNO' } },
      file: { type: BuiltinTypes.STRING },
      bool: { type: BuiltinTypes.BOOLEAN },
      num: { type: BuiltinTypes.NUMBER },
      numArray: { type: new ListType(BuiltinTypes.NUMBER) },
      strArray: { type: new ListType(BuiltinTypes.STRING) },
      obj: {

        type: new ListType(new ObjectType({
          elemID: mockElem,
          fields: {
            field: { type: BuiltinTypes.STRING },
            value: { type: BuiltinTypes.STRING },
            innerObj: {

              type: new ObjectType({
                elemID: mockElem,
                fields: {
                  name: { type: BuiltinTypes.STRING },
                  listOfNames: { type: new ListType(BuiltinTypes.STRING) },
                  magical: {

                    type: new ObjectType({
                      elemID: mockElem,
                      fields: {
                        deepNumber: { type: BuiltinTypes.NUMBER },
                        deepName: { type: BuiltinTypes.STRING },
                      },
                    }),
                  },
                },
              }),
            },
          },
        })),
      },
    },
    path: ['this', 'is', 'happening'],
  })

  const regValue = 'regValue'
  const valueRef = new ReferenceExpression(mockElem, regValue, mockType)
  const fileContent = 'bb'
  const valueFile = new StaticFile({ filepath: 'aa', content: Buffer.from(fileContent) })

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
      file: valueFile,
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
      objWithInnerObj: {
        innerObj: {
          listKey: [1, 2],
          stringKey: 'val2',
        },
      },
    },
    ['yes', 'this', 'is', 'path'],
    {
      [INSTANCE_ANNOTATIONS.DEPENDS_ON]: valueRef,
    },
  )

  const mockPrim = new PrimitiveType({
    elemID: new ElemID('mockAdapter', 'prim'),
    primitive: PrimitiveTypes.STRING,
    annotationTypes: {
      str: mockStrType,
    },
    annotations: {
      str: 'STR',
    },
  })
  const mockList = new ListType(mockPrim)

  describe('transformValues func', () => {
    let resp: Values

    const defaultFieldParent = new ObjectType({ elemID: new ElemID('') })

    describe('with empty values', () => {
      it('should return undefined', () => {
        expect(transformValues({
          values: {},
          transformFunc: () => undefined,
          type: mockType,
        })).toBeUndefined()
      })
    })

    describe('with empty transform func', () => {
      let transformFunc: jest.Mock

      beforeEach(() => {
        transformFunc = mockFunction<TransformFunc>().mockImplementation(({ value }) => value)
      })

      describe('when called with objectType as type parameter', () => {
        beforeEach(async () => {
          const result = transformValues({
            values: mockInstance.value,
            type: mockType,
            transformFunc,
          })

          expect(result).toBeDefined()
          resp = result as Values
        })

        it('should preserve static files', () => {
          expect(resp.file).toBeInstanceOf(StaticFile)
        })

        it('should call transform on top level primitive values', () => {
          const primitiveFieldNames = ['str', 'bool', 'num']
          primitiveFieldNames.forEach(field => {
            expect(transformFunc).toHaveBeenCalledWith({
              value: mockInstance.value[field],
              path: undefined,
              field: mockType.fields[field],
            })
          })
        })

        it('should call transform on top level references values', () => {
          const referenceFieldNames = ['ref']
          referenceFieldNames.forEach(field => {
            expect(transformFunc).toHaveBeenCalledWith({
              value: mockInstance.value[field],
              path: undefined,
              field: mockType.fields[field],
            })
          })
        })

        it('should call transform on non-list types even for list types', () => {
          expect(isListType(mockType.fields.strArray.type)).toBeTruthy()
          expect(transformFunc).toHaveBeenCalledWith({
            value: mockInstance.value.strArray,
            path: undefined,
            field: new Field(
              mockType.fields.strArray.parent,
              mockType.fields.strArray.name,
              (mockType.fields.strArray.type as ListType).innerType,
              mockType.fields.strArray.annotations,
            ),
          })
        })

        it('should call transform on array elements', () => {
          const numArrayFieldType = mockType.fields.numArray.type
          expect(isListType(numArrayFieldType)).toBeTruthy()
          const numArrayValues = (mockInstance.value.numArray as string[])
          numArrayValues.forEach(
            value => expect(transformFunc).toHaveBeenCalledWith({
              value,
              path: undefined,
              field: new Field(
                mockType.fields.numArray.parent,
                mockType.fields.numArray.name,
                (numArrayFieldType as ListType).innerType,
                mockType.fields.numArray.annotations,
              ),
            })
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
            path => expect(transformFunc).toHaveBeenCalledWith({
              value: _.get(mockInstance.value, path),
              path: undefined,
              field: getField(mockType, path),
            })
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
            transformFunc,
          })
          expect(result).toEqual(mockInstance.annotations)
        })


        it('should call transform on instance annotation references values', () => {
          const referenceAnnotationNames = [INSTANCE_ANNOTATIONS.DEPENDS_ON]
          referenceAnnotationNames.forEach(annotation => {
            expect(transformFunc).toHaveBeenCalledWith({
              value: mockInstance.annotations[annotation],
              path: undefined,
              field: new Field(defaultFieldParent, annotation, InstanceAnnotationTypes[annotation]),
            })
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
          const result = transformValues({
            values: origValue,
            type: typeMap,
            transformFunc,
          })

          expect(result).toBeDefined()
          resp = result as Values
        })
        it('should call transform func on all defined types', () => {
          const primitiveTypes = ['str', 'num', 'bool']
          primitiveTypes.forEach(
            name => expect(transformFunc).toHaveBeenCalledWith({
              value: origValue[name],
              path: undefined,
              field: new Field(defaultFieldParent, name, typeMap[name]),
            })
          )
          origValue.nums.forEach(
            (value: string) => expect(transformFunc).toHaveBeenCalledWith({
              value,
              path: undefined,
              field: new Field(defaultFieldParent, 'nums', BuiltinTypes.NUMBER),
            })
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

    const transformTest: TransformFunc = ({ value, field }) => {
      if (isReferenceExpression(value)) {
        return value.value
      }
      const fieldType = field?.type
      if (!isPrimitiveType(fieldType) || !isPrimitiveValue(value)) {
        return value
      }
      switch (fieldType.primitive) {
        case PrimitiveTypes.NUMBER:
          return Number(value)
        case PrimitiveTypes.BOOLEAN:
          return value.toString().toLowerCase() === 'true'
        case PrimitiveTypes.STRING:
          return value.toString().length === 0 ? undefined : value.toString()
        default:
          return value
      }
    }

    describe('when transformPrimitives and transformReference was received', () => {
      describe('when called with instance values', () => {
        beforeEach(async () => {
          const result = transformValues({
            values: mockInstance.value,
            type: mockType,
            transformFunc: transformTest,
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
            transformFunc: transformTest,
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
        expect(resp.obj[1].innerObj.magical.deepNumber).toBeUndefined()
        expect(resp.obj[1].innerObj.magical.notExist2).toEqual('false')
        expect(resp.obj[2]).not.toEqual(mockInstance.value.obj[2])
      })

      it('should not change non primitive values in primitive fields', () => {
        expect(resp.obj[0].value).toEqual(mockInstance.value.obj[0].value)
      })
    })

    describe('when called with pathID', () => {
      const paths = new Set<string>()
      const createPathsSet: TransformFunc = ({ value, field, path }) => {
        if (value && field && path) {
          paths.add(path.getFullName())
        }
        return value
      }

      beforeAll(() => {
        transformValues(
          {
            values: mockInstance.value,
            type: mockType,
            transformFunc: createPathsSet,
            pathID: mockInstance.elemID,
          }
        )
      })

      it('should traverse list items with correct path ID', () => {
        expect(paths)
          .toContain(mockInstance.elemID.createNestedID('obj', '0', 'field').getFullName())
      })
    })
  })

  describe('resolveValues func', () => {
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
      },
      fields: {
        refValue: { type: BuiltinTypes.STRING },
        arrayValues: { type: new ListType(BuiltinTypes.STRING) },
        fileValue: { type: BuiltinTypes.STRING },
      },
    })
    element.annotations.typeRef = new ReferenceExpression(
      elementID.createNestedID('annotation', 'name'), objectName, element
    )

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
      fileValue: valueFile,
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
    const elementRef = new ReferenceExpression(element.elemID, element, element)

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
        field: {

          type: element,
          annotations: {
            reg: regValue,
            refValue: valueRef,
          },
        },
      },
    })

    const getName: GetLookupNameFunc = ({ ref }) => ref.value

    describe('resolveValues on objectType', () => {
      let sourceElementCopy: ObjectType
      let resolvedElement: ObjectType

      beforeAll(async () => {
        sourceElementCopy = sourceElement.clone()
        resolvedElement = resolveValues(sourceElement, getName)
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
        expect(restoreValues(sourceElement, resolvedElement, getName)).toEqual(sourceElement)
      })

      it('should maintain new values when transforming back to orig value', () => {
        const after = resolvedElement.clone()
        after.annotations.new = newValue
        after.annotationTypes.new = BuiltinTypes.STRING
        after.fields.field.annotations.new = newValue
        after.annotations.regValue = newValue
        after.annotationTypes.regValue = BuiltinTypes.STRING
        after.fields.field.annotations.regValue = newValue

        const restored = restoreValues(sourceElement, after, getName)
        expect(restored.annotations.new).toEqual(newValue)
        expect(restored.annotations.regValue).toEqual(newValue)

        expect(restored.fields.field.annotations.new).toEqual(newValue)
        expect(restored.fields.field.annotations.regValue).toEqual(newValue)
      })
    })

    describe('resolveValues on instance', () => {
      let resolvedInstance: InstanceElement

      beforeAll(async () => {
        resolvedInstance = resolveValues(instance, getName)
      })

      it('should transform instanceElement', () => {
        expect(resolvedInstance.value.name).toEqual(instance.value.name)
        expect(resolvedInstance.value.refValue).toEqual(regValue)
        expect(resolvedInstance.value.arrayValues).toHaveLength(2)
        expect(resolvedInstance.value.arrayValues[0]).toEqual(regValue)
        expect(resolvedInstance.value.arrayValues[1]).toEqual(regValue)
        expect(resolvedInstance.value.fileValue).toEqual(fileContent)

        expect(resolvedInstance.annotations[INSTANCE_ANNOTATIONS.DEPENDS_ON]).toEqual(regValue)
      })

      it('should transform back to instance', () => {
        expect(restoreValues(instance, resolvedInstance, getName)).toEqual(instance)
      })
    })

    describe('resolveValues on primitive', () => {
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
        resolvedPrim = resolveValues(prim, getName)
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
        expect(restoreValues(prim, resolvedPrim, getName)).toEqual(prim)
      })
    })

    describe('resolveValues on field', () => {
      const FieldType = new ObjectType({
        elemID,
        annotationTypes: {
          testAnno: BuiltinTypes.STRING,
          testNumAnno: BuiltinTypes.NUMBER,
          refAnno: BuiltinTypes.STRING,
        },
      })

      const fieldParent = new ObjectType({ elemID })

      const field = new Field(fieldParent, 'field', FieldType, {
        testAnno: 'TEST ANNO TYPE',
        testNumAnno: 34,
        refAnno: valueRef,
      })

      let resolvedField: Field

      beforeAll(async () => {
        resolvedField = resolveValues(field, getName)
      })


      it('should transform field', () => {
        expect(resolvedField).not.toEqual(field)

        expect(resolvedField.type).toEqual(field.type)
        expect(resolvedField.name).toEqual(field.name)
        expect(resolvedField.elemID).toEqual(field.elemID)
        expect(resolvedField.path).toEqual(field.path)
        expect(resolvedField.parent).toBe(field.parent)

        expect(resolvedField.annotations).not.toEqual(field.annotations)
        expect(resolvedField.annotations.refAnno).toEqual(regValue)
        expect(resolvedField.annotations.testAnno).toEqual(field.annotations.testAnno)
      })

      it('should transform back to field', () => {
        expect(restoreValues(field, resolvedField, getName)).toEqual(field)
      })
    })
  })
  describe('naclCase func', () => {
    describe('names without special characters', () => {
      const normalNames = [
        'Offer__c', 'Lead', 'DSCORGPKG__DiscoverOrg_Update_History__c', 'NameWithNumber2',
        'CRMFusionDBR101__Scenario__C',
      ]
      it('should remain the same', () => {
        normalNames.forEach(name => expect(naclCase(name)).toEqual(name))
      })
    })

    describe('names with spaces', () => {
      it('should be replaced with _', () => {
        expect(naclCase('Analytics Cloud Integration User')).toEqual('Analytics_Cloud_Integration_User')
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
        // eslint-disable-next-line @typescript-eslint/camelcase
        num_field: { type: primNum },
        // eslint-disable-next-line @typescript-eslint/camelcase
        str_field: { type: primStr },
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

  describe('flattenElementStr function', () => {
    it('should not modifiy an object type', () => {
      const flatObj = flattenElementStr(mockType)
      expect(flatObj).toEqual(mockType)
    })

    it('should not modify a primitive type', () => {
      const flatPrim = flattenElementStr(mockPrim)
      expect(flatPrim).toEqual(mockPrim)
    })

    it('should not modify an instance type', () => {
      const flatInst = flattenElementStr(mockInstance)
      expect(flatInst).toEqual(mockInstance)
    })

    it('should not modify a field', () => {
      const flatField = flattenElementStr(mockType.fields.str)
      expect(flatField).toEqual(mockType.fields.str)
    })

    it('should not modify a list type', () => {
      const flatList = flattenElementStr(mockList)
      expect(flatList).toEqual(mockList)
    })
  })
  describe('valuesDeepSome', () => {
    const predicate = (v: Value): boolean => v === 42
    it('should find if primitive', () => {
      expect(valuesDeepSome(42, predicate)).toEqual(true)
    })
    it('miss for invalid primitive', () => {
      expect(valuesDeepSome(41, predicate)).toEqual(false)
    })
    it('should find for arrays', () => {
      expect(valuesDeepSome([1, 2, 42, 5], predicate)).toEqual(true)
    })
    it('miss for invalid array', () => {
      expect(valuesDeepSome([1, 2, 41, 5], predicate)).toEqual(false)
    })
    it('should find for objects', () => {
      expect(valuesDeepSome({ a: 321, b: 321, c: 42, d: 44 }, predicate)).toEqual(true)
    })
    it('miss for invalid objects', () => {
      expect(valuesDeepSome({ a: 321, b: 321, c: 41, d: 44 }, predicate)).toEqual(false)
    })
    it('should find for entire object predicate', () => {
      expect(valuesDeepSome(
        { a: 321, b: 321, c: { aha: 41 }, d: 44 },
        v => v.aha === 41,
      )).toEqual(true)
    })
    it('should find for nested crazyness', () => {
      expect(valuesDeepSome(
        { a: 321, b: [3, 2, 1], c: [{ aha: 42 }], d: 44 },
        predicate,
      )).toEqual(true)
    })
    it('miss for nested crazyness', () => {
      expect(valuesDeepSome(
        { a: 321, b: [3, 2, 1], c: [{ aha: 41 }], d: 44 },
        predicate,
      )).toEqual(false)
    })
  })
  describe('filterByID', () => {
    const annoTypeID = new ElemID('salto', 'annoType')
    const annoType = new ObjectType({
      elemID: annoTypeID,
      fields: {
        str: { type: BuiltinTypes.STRING },
        num: { type: BuiltinTypes.NUMBER },
      },
    })
    const objElemID = new ElemID('salto', 'obj')
    const obj = new ObjectType({
      elemID: objElemID,
      annotationTypes: {
        obj: annoType,
        list: new ListType(BuiltinTypes.STRING),
      },
      annotations: {
        obj: {
          str: 'HOW MUCH IS 6 * 9',
          num: 42,
        },
        list: ['I', 'do', 'not', 'write', 'jokes', 'in', 'base 13'],
      },
      fields: {
        obj: { type: annoType, annotations: { label: 'LABEL' } },
        list: { type: new ListType(BuiltinTypes.STRING) },
      },
    })
    const inst = new InstanceElement('inst', obj, {
      obj: { str: 'Well I do', num: 42 },
      list: ['Do', 'you', 'get', 'it', '?'],
    })
    const prim = new PrimitiveType({
      elemID: new ElemID('salto', 'prim'),
      annotationTypes: {
        obj: annoType,
      },
      annotations: {
        obj: {
          str: 'I knew you would get',
          num: 17,
        },
      },
      primitive: PrimitiveTypes.STRING,
    })
    it('should filter object type', async () => {
      const expectEqualFields = (actual: FieldMap | undefined, expected: FieldMap): void => {
        expect(actual).toBeDefined()
        expect(Object.keys(actual ?? {})).toEqual(Object.keys(expected))
        Object.entries(expected).forEach(
          ([name, field]) => expect(actual?.[name]?.isEqual(field)).toBeTruthy()
        )
      }

      const onlyFields = await filterByID(
        objElemID,
        obj,
        id => Promise.resolve(id.idType === 'type' || id.idType === 'field')
      )
      expect(onlyFields).toBeDefined()
      expectEqualFields(onlyFields?.fields, obj.fields)
      expect(onlyFields?.annotations).toEqual({})
      expect(onlyFields?.annotationTypes).toEqual({})
      const onlyAnno = await filterByID(
        objElemID,
        obj,
        id => Promise.resolve(id.idType === 'type' || id.idType === 'attr')
      )
      expect(onlyAnno).toBeDefined()
      expect(onlyAnno?.fields).toEqual({})
      expect(onlyAnno?.annotations).toEqual(obj.annotations)
      expect(onlyAnno?.annotationTypes).toEqual({})

      const onlyAnnoType = await filterByID(
        objElemID,
        obj,
        id => Promise.resolve(id.idType === 'type' || id.idType === 'annotation')
      )
      expect(onlyAnnoType).toBeDefined()
      expect(onlyAnnoType?.fields).toEqual({})
      expect(onlyAnnoType?.annotations).toEqual({})
      expect(onlyAnnoType?.annotationTypes).toEqual(obj.annotationTypes)

      const withoutAnnoObjStr = await filterByID(
        objElemID,
        obj,
        id => Promise.resolve(!id.getFullNameParts().includes('str'))
      )
      expect(withoutAnnoObjStr).toBeDefined()
      expectEqualFields(withoutAnnoObjStr?.fields, obj.fields)
      expect(withoutAnnoObjStr?.annotations.obj).toEqual({ num: 42 })
      expect(withoutAnnoObjStr?.annotations.list).toEqual(obj.annotations.list)
      expect(withoutAnnoObjStr?.annotationTypes).toEqual(obj.annotationTypes)

      const withoutFieldAnnotations = await filterByID(
        objElemID,
        obj,
        id => Promise.resolve(id.getFullName() !== 'salto.obj.field.obj.label')
      )

      expect(withoutFieldAnnotations).toBeDefined()
      expect(withoutFieldAnnotations?.annotations).toEqual(obj.annotations)
      expect(withoutFieldAnnotations?.annotationTypes).toEqual(obj.annotationTypes)
      expect(withoutFieldAnnotations?.fields.obj).toBeDefined()
      expect(withoutFieldAnnotations?.fields.obj.annotations).toEqual({})
      const onlyI = await filterByID(
        objElemID,
        obj,
        id => Promise.resolve(
          Number.isNaN(Number(_.last(id.getFullNameParts())))
          || Number(_.last(id.getFullNameParts())) === 0
        )
      )
      expect(onlyI).toBeDefined()
      expectEqualFields(onlyI?.fields, obj.fields)
      expect(onlyI?.annotations.obj).toEqual(obj.annotations.obj)
      expect(onlyI?.annotations.list).toEqual(['I'])
      expect(onlyI?.annotationTypes).toEqual(obj.annotationTypes)
    })

    it('should filter primitive type', async () => {
      const filteredPrim = await filterByID(
        prim.elemID,
        prim,
        id => Promise.resolve(!id.getFullNameParts().includes('str'))
      )
      expect(filteredPrim?.annotations.obj).toEqual({ num: 17 })
      expect(filteredPrim?.annotationTypes).toEqual({ obj: annoType })
    })

    it('should filter instances', async () => {
      const filteredInstance = await filterByID(
        inst.elemID,
        inst,
        id => Promise.resolve(
          !id.getFullNameParts().includes('list')
        )
      )
      expect(filteredInstance?.value).toEqual({ obj: inst.value.obj })
    })

    it('should return undefined if the base item fails the filter func', async () => {
      const filteredInstance = await filterByID(
        inst.elemID,
        inst,
        id => Promise.resolve(id.idType !== 'instance')
      )
      expect(filteredInstance).toBeUndefined()
    })

    it('should not set array and obj values that are empty after filtering', async () => {
      const withoutList = await filterByID(
        inst.elemID,
        inst,
        id => Promise.resolve(Number.isNaN(Number(_.last(id.getFullNameParts()))))
      )
      expect(withoutList?.value).toEqual({ obj: inst.value.obj })

      const withoutObj = await filterByID(
        inst.elemID,
        inst,
        id => Promise.resolve(
          !id.getFullNameParts().includes('str') && !id.getFullNameParts().includes('num')
        )
      )
      expect(withoutObj?.value).toEqual({ list: inst.value.list })
    })
  })
  describe('Flat Values', () => {
    it('should not transform static files', () => {
      const staticFile = valueFile
      expect(flatValues(staticFile)).toEqual(staticFile)
    })
  })

  describe('mapKeysRecursive', () => {
    it('should map all keys recursively', () => {
      const result = mapKeysRecursive(mockInstance.value, ({ key }) => key.toUpperCase())
      expect(Object.keys(result))
        .toEqual(expect.arrayContaining(['BOOL', 'STR', 'OBJ', 'OBJWITHINNEROBJ']))
      expect(Object.keys(result.OBJWITHINNEROBJ)).toContain('INNEROBJ')
      expect(Object.keys(result.OBJWITHINNEROBJ.INNEROBJ))
        .toEqual(expect.arrayContaining(['LISTKEY', 'STRINGKEY']))
    })

    it('should map keys recursively when passing the pathID', () => {
      const result = mapKeysRecursive(mockInstance.value, ({ key, pathID }) => {
        if (pathID?.getFullName().includes('Key')) {
          return key.toUpperCase()
        }
        return key
      }, mockInstance.elemID)
      expect(Object.keys(result))
        .toEqual(expect.arrayContaining(['bool', 'str', 'obj', 'objWithInnerObj']))
      expect(Object.keys(result.objWithInnerObj)).toContain('innerObj')
      expect(Object.keys(result.objWithInnerObj.innerObj))
        .toEqual(expect.arrayContaining(['LISTKEY', 'STRINGKEY']))
    })
  })

  describe('applyInstancesDefaults', () => {
    const baseElemID = new ElemID('salto', 'base')
    const base = new ObjectType({
      elemID: baseElemID,
      fields: {
        field1: { type: BuiltinTypes.STRING, annotations: { label: 'base' } },
        field2: { type: BuiltinTypes.STRING, annotations: { label: 'base' } },
      },
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: {
          field1: 'base1',
          field2: 'base2',
        },
      },
    })

    const strType = new PrimitiveType({
      elemID: new ElemID('salto', 'string'),
      primitive: PrimitiveTypes.STRING,
      annotations: { [CORE_ANNOTATIONS.DEFAULT]: 'type' },
    })
    const nestedElemID = new ElemID('salto', 'nested')
    const nested = new ObjectType({
      elemID: nestedElemID,
      fields: {
        field1: { type: strType, annotations: { [CORE_ANNOTATIONS.DEFAULT]: 'field1' } },
        field2: { type: strType },
        base: { type: base },
      },
    })
    const ins1 = new InstanceElement(
      'ins',
      nested,
      { field1: 'ins1', field2: 'ins1' },
      undefined,
      { anno: 1 },
    )
    const shouldUseFieldDef = new InstanceElement('ins', nested, {
      field2: 'ins1',
      base: { field1: 'ins2', field2: 'ins2' },
    })

    it('should use field defaults', () => {
      const elements = [shouldUseFieldDef.clone()]
      applyInstancesDefaults(elements)
      const ins = elements[0] as InstanceElement
      expect(ins.value).toEqual({
        field1: 'field1',
        field2: 'ins1',
        base: {
          field1: 'ins2',
          field2: 'ins2',
        },
      })
    })

    it('should use type defaults', () => {
      const shouldUseTypeDef = new InstanceElement('ins', nested, {
        field1: 'ins1',
        base: { field1: 'ins2', field2: 'ins2' },
      })
      const elements = [shouldUseTypeDef]
      applyInstancesDefaults(elements)
      expect(shouldUseTypeDef.value).toEqual({
        field1: 'ins1',
        field2: 'type',
        base: {
          field1: 'ins2',
          field2: 'ins2',
        },
      })
    })

    it('should use object defaults', () => {
      const elements = [ins1.clone()]
      applyInstancesDefaults(elements)
      expect(elements[0].value).toEqual({
        field1: 'ins1',
        field2: 'ins1',
        base: {
          field1: 'base1',
          field2: 'base2',
        },
      })
    })

    it('should not use defaults for inner fields when its value is undefined', () => {
      const typeWithNestedDefaultsElemID = new ElemID('salto', 'typeWithNestedDefaults')
      const typeWithNestedDefaults = new ObjectType({
        elemID: typeWithNestedDefaultsElemID,
        fields: {
          withDefault: { type: strType, annotations: { [CORE_ANNOTATIONS.DEFAULT]: 'default val' } },
          nestedTypeHasDefaults: { type: nested },
        },
      })

      const instanceWithNoValues = new InstanceElement(
        'instance',
        typeWithNestedDefaults,
      )

      const elements = [instanceWithNoValues]
      applyInstancesDefaults(elements)
      expect(instanceWithNoValues.value).toEqual({
        withDefault: 'default val',
      })
    })
  })

  describe('createDefaultInstanceFromType', () => {
    it('should create default instance from type', () => {
      const mockElemID = new ElemID('test')
      const configType = new ObjectType({
        elemID: mockElemID,
        fields: {
          val1: {

            type: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.DEFAULT]: 'test' },
          },
        },
      })
      expect(createDefaultInstanceFromType('test', configType))
        .toEqual(new InstanceElement('test', configType, { val1: 'test' }))
    })
  })
})
