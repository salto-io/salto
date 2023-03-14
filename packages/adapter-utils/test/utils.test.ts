/*
*                      Copyright 2023 Salto Labs Ltd.
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
  ReferenceExpression, Values, TemplateExpression, Value, ElemID, InstanceAnnotationTypes,
  isListType, ListType, BuiltinTypes, StaticFile, isPrimitiveType,
  Element, isReferenceExpression, isPrimitiveValue, CORE_ANNOTATIONS, FieldMap, AdditionChange,
  RemovalChange, ModificationChange, isInstanceElement, isObjectType, MapType, isMapType,
  ContainerType, TypeReference, createRefToElmWithValue, VariableExpression, getChangeData,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { mockFunction } from '@salto-io/test-utils'
import Joi from 'joi'
import {
  transformValues, resolvePath, TransformFunc, restoreValues, resolveValues, resolveChangeElement,
  findElement, findElements, findObjectType, GetLookupNameFunc, safeJsonStringify,
  findInstances, flattenElementStr, valuesDeepSome, filterByID, setPath, ResolveValuesFunc,
  flatValues, mapKeysRecursive, createDefaultInstanceFromType, applyInstancesDefaults,
  restoreChangeElement, RestoreValuesFunc, getAllReferencedIds, applyFunctionToChangeData,
  transformElement, toObjectType, getParents, resolveTypeShallow,
  elementExpressionStringifyReplacer,
  createSchemeGuard,
  getParent,
  getPath,
} from '../src/utils'
import { buildElementsSourceFromElements } from '../src/element_source'

const { awu } = collections.asynciterable

describe('Test utils.ts', () => {
  const mockStrType = new PrimitiveType({
    elemID: new ElemID('mockAdapter', 'str'),
    primitive: PrimitiveTypes.STRING,
    annotations: { testAnno: 'TEST ANNO TYPE' },
    path: ['here', 'we', 'go'],
  })
  const getName: GetLookupNameFunc = ({ ref }) => ref.value
  const mockElem = new ElemID('mockAdapter', 'test')
  const mockType = new ObjectType({
    elemID: mockElem,
    annotationRefsOrTypes: {
      testAnno: mockStrType,
    },
    annotations: {
      testAnno: 'TEST ANNO',
    },
    fields: {
      ref: { refType: BuiltinTypes.STRING },
      str: { refType: BuiltinTypes.STRING, annotations: { testAnno: 'TEST FIELD ANNO' } },
      file: { refType: BuiltinTypes.STRING },
      bool: { refType: BuiltinTypes.BOOLEAN },
      num: { refType: BuiltinTypes.NUMBER },
      numArray: { refType: new ListType(BuiltinTypes.NUMBER) },
      strArray: { refType: new ListType(BuiltinTypes.STRING) },
      numMap: { refType: new MapType(BuiltinTypes.NUMBER) },
      strMap: { refType: new MapType(BuiltinTypes.STRING) },
      obj: {
        refType: new ListType(new ObjectType({
          elemID: mockElem,
          fields: {
            field: { refType: BuiltinTypes.STRING },
            otherField: {
              refType: BuiltinTypes.STRING,
            },
            value: { refType: BuiltinTypes.STRING },
            mapOfStringList: {
              refType: new MapType(new ListType(BuiltinTypes.STRING)),
            },
            innerObj: {
              refType: new ObjectType({
                elemID: mockElem,
                fields: {
                  name: { refType: BuiltinTypes.STRING },
                  listOfNames: {
                    refType: new ListType(BuiltinTypes.STRING),
                  },
                  magical: {
                    refType: new ObjectType({
                      elemID: mockElem,
                      fields: {
                        deepNumber: { refType: BuiltinTypes.NUMBER },
                        deepName: { refType: BuiltinTypes.STRING },
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
  const templateElemID = new ElemID('template', 'test')
  const templateElemID2 = new ElemID('template2', 'test2')
  const templateRef = new TemplateExpression({ parts: ['this is:',
    new ReferenceExpression(templateElemID), 'a template',
    new ReferenceExpression(templateElemID2)] })
  const fileContent = 'bb'
  const valueFile = new StaticFile({ filepath: 'aa', content: Buffer.from(fileContent) })

  const mockInstance = new InstanceElement(
    'mockInstance',
    mockType,
    {
      ref: valueRef,
      templateRef,
      str: 'val',
      bool: 'true',
      num: '99',
      numArray: ['12', '13', '14'],
      strArray: 'should be list',
      numMap: { key12: 12, num13: 13 },
      strMap: { a: 'a', bla: 'BLA' },
      notExist: 'notExist',
      notExistArray: ['', ''],
      file: valueFile,
      obj: [
        {
          field: 'firstField',
          otherField: 'doesn\'t matter',
          value: {
            val: 'someString',
            anotherVal: { objTest: '123' },
          },
          mapOfStringList: {
            l1: ['aaa', 'bbb'],
            l2: ['ccc', 'ddd'],
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
          undeployable: valueRef,
          value: ['123', '456'],
          mapOfStringList: { something: [] },
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
            undeployable: new ReferenceExpression(new ElemID('mockAdapter', 'test2', 'field', 'aaa')),
            listOfNames: ['str4', 'str1', 'str2'],
            magical: {
              deepNumber: '',
              deepName: '',
            },
          },
        },
        {
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
      [CORE_ANNOTATIONS.DEPENDS_ON]: { reference: valueRef },
    },
  )

  const mockPrim = new PrimitiveType({
    elemID: new ElemID('mockAdapter', 'prim'),
    primitive: PrimitiveTypes.STRING,
    annotationRefsOrTypes: {
      str: mockStrType,
    },
    annotations: {
      str: 'STR',
    },
  })
  const mockList = new ListType(mockPrim)
  const mockMap = new MapType(mockPrim)

  describe('toObjectType func', () => {
    it('should not modify object types', () => {
      expect(
        toObjectType(mockType, {})
      ).toEqual(mockType)
    })
    it('should translate map types based on the instance values', () => {
      const mapType = new MapType(BuiltinTypes.STRING)
      const instance = {
        aaa: 'aaa',
        bbb: 'BBB',
      }
      expect(toObjectType(mapType, {})).toEqual(new ObjectType({ elemID: mapType.elemID }))
      expect(toObjectType(mapType, instance)).toEqual(new ObjectType({
        elemID: mapType.elemID,
        fields: {
          aaa: { refType: BuiltinTypes.STRING },
          bbb: { refType: BuiltinTypes.STRING },
        },
      }))
      mapType.annotations = { randomAnnotation: {} }
      expect(toObjectType(mapType, instance)).toEqual(new ObjectType({
        elemID: mapType.elemID,
        fields: {
          aaa: { refType: BuiltinTypes.STRING },
          bbb: { refType: BuiltinTypes.STRING },
        },
        annotations: mapType.annotations,
      }))
    })

    it('should support complex types', async () => {
      // TODO: Replace this with refType when handling mapType
      const mapType = new MapType(await mockType.fields.obj.getType())
      const instance = {
        a: 'this is ignored',
        b: 'so is this',
      }
      expect(toObjectType(mapType, instance)).toEqual(new ObjectType({
        elemID: mapType.elemID,
        fields: {
          a: { refType: mockType.fields.obj.refType },
          b: { refType: mockType.fields.obj.refType },
        },
      }))
    })
  })

  describe('transformValues func', () => {
    let resp: Values

    const defaultFieldParent = new ObjectType({ elemID: new ElemID('') })

    describe('with empty values', () => {
      it('should return undefined', async () => {
        expect(await transformValues({
          values: {},
          transformFunc: () => undefined,
          type: mockType,
        })).toBeUndefined()
      })
    })

    describe('with empty transform func', () => {
      let transformFunc: jest.MockedFunction<TransformFunc>

      beforeEach(() => {
        transformFunc = mockFunction<TransformFunc>().mockImplementation(({ value }) => value)
      })

      describe('when called with objectType as type parameter', () => {
        beforeEach(async () => {
          const result = await transformValues({
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

        it('should call transform on non-list types even for list types', async () => {
          expect(isListType(await mockType.fields.strArray.getType())).toBeTruthy()
          expect(transformFunc).toHaveBeenCalledWith({
            value: mockInstance.value.strArray,
            path: undefined,
            field: new Field(
              mockType.fields.strArray.parent,
              mockType.fields.strArray.name,
              await (await mockType.fields.strArray.getType() as ListType).getInnerType(),
              mockType.fields.strArray.annotations,
            ),
          })
        })

        it('should call transform on map types', async () => {
          expect(isMapType(await mockType.fields.strMap.getType())).toBeTruthy()
          expect(transformFunc).toHaveBeenCalledWith({
            value: mockInstance.value.strMap,
            path: undefined,
            field: new Field(
              mockType.fields.strMap.parent,
              mockType.fields.strMap.name,
              await mockType.fields.strMap.getType(),
              mockType.fields.strMap.annotations,
            ),
          })
        })

        it('should call transform on array elements', async () => {
          const numArrayFieldType = await mockType.fields.numArray.getType()
          expect(isListType(numArrayFieldType)).toBeTruthy()
          const numArrayValues = (mockInstance.value.numArray as string[])
          await awu(numArrayValues).forEach(
            async value => expect(transformFunc).toHaveBeenCalledWith({
              value,
              path: undefined,
              field: new Field(
                mockType.fields.numArray.parent,
                mockType.fields.numArray.name,
                await (numArrayFieldType as ListType).getInnerType(),
                mockType.fields.numArray.annotations,
              ),
            })
          )
        })

        it('should call transform on map value elements', async () => {
          const numMapFieldType = await mockType.fields.numMap.getType()
          expect(isMapType(numMapFieldType)).toBeTruthy()
          const numMapValues = (mockInstance.value.numMap as Map<string, number>)
          await awu(Object.entries(numMapValues)).forEach(
            async ([key, value]) => {
              const calls = transformFunc.mock.calls.map(c => c[0]).filter(
                c => c.field && c.field.name === key
              )
              expect(calls).toHaveLength(1)
              expect(calls[0].value).toEqual(value)
              expect(calls[0].path).toBeUndefined()
              expect(await calls[0].field?.getType()).toEqual(BuiltinTypes.NUMBER)
              expect(calls[0].field?.parent.elemID).toEqual(mockType.fields.numMap.refType.elemID)
            }
          )
        })

        it('should call transform on primitive types in nested objects', async () => {
          const getField = async (
            type: ObjectType | ContainerType,
            path: (string | number)[],
            value: Values,
          ): Promise<Field> => {
            if (isListType(type)) {
              if (typeof path[0] !== 'number') {
                throw new Error(`type ${type.elemID.getFullName()} is a list type but path part ${path[0]} is not a number`)
              }
              return getField(
                (await type.getInnerType() as ObjectType | ContainerType),
                path.slice(1),
                value[path[0]],
              )
            }
            const field = isMapType(type)
              ? new Field(toObjectType(type, value), String(path[0]), await type.getInnerType())
              : type.fields[path[0]]
            return path.length === 1 ? field
              : getField(
                await field.getType() as ObjectType | ContainerType, path.slice(1), value[path[0]]
              )
          }
          const nestedPrimitivePaths = [
            ['obj', 0, 'field'],
            ['obj', 1, 'field'],
            ['obj', 2, 'field'],
            ['obj', 0, 'innerObj', 'name'],
            ['obj', 0, 'innerObj', 'magical', 'deepName'],
            ['obj', 0, 'mapOfStringList'],
            ['obj', 0, 'mapOfStringList', 'l1'],
            ['obj', 1, 'mapOfStringList', 'something'],
          ]
          await awu(nestedPrimitivePaths).forEach(
            async path => {
              const field = await getField(mockType, path, mockInstance.value)
              const calls = transformFunc.mock.calls.map(c => c[0]).filter(
                c => c.field && c.field.name === field.name
                  && c.value === _.get(mockInstance.value, path)
              )
              expect(calls).toHaveLength(1)
              expect(calls[0].path).toBeUndefined()
              expect(await calls[0].field?.getType()).toEqual(await field.getType())
              expect(calls[0].field?.parent.elemID).toEqual(field.parent.elemID)
            }
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
          const result = await transformValues({
            values: mockInstance.annotations,
            type: InstanceAnnotationTypes,
            transformFunc,
          })
          expect(result).toEqual(mockInstance.annotations)
        })


        it('should call transform on instance annotation references values', () => {
          const referenceAnnotationNames = [CORE_ANNOTATIONS.DEPENDS_ON]
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
        beforeEach(async () => {
          origValue = {
            str: 'asd',
            num: '10',
            bool: 'true',
            nums: ['1', '2'],
            numMap: { one: 1, two: 2 },
            notExist: 'a',
          }
          typeMap = {
            str: BuiltinTypes.STRING,
            num: BuiltinTypes.NUMBER,
            bool: BuiltinTypes.BOOLEAN,
            nums: new ListType(BuiltinTypes.NUMBER),
            numMap: new MapType(BuiltinTypes.NUMBER),
          }
          const result = await transformValues({
            values: origValue,
            type: typeMap,
            transformFunc,
          })

          expect(result).toBeDefined()
          resp = result as Values
        })
        it('should call transform func on all defined types', async () => {
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
          await awu(Object.entries(origValue.numMap)).forEach(
            async ([key, value]) => {
              const field = new Field(
                toObjectType(new MapType(BuiltinTypes.NUMBER), origValue.numMap),
                key,
                BuiltinTypes.NUMBER,
              )
              const calls = transformFunc.mock.calls.map(c => c[0]).filter(
                c => c.field && c.field.name === field.name
                  && c.value === value
              )
              expect(calls).toHaveLength(1)
              expect(calls[0].path).toBeUndefined()
              expect(await calls[0].field?.getType()).toEqual(await field.getType())
              expect(calls[0].field?.parent.elemID).toEqual(field.parent.elemID)
            }
          )
        })
        it('should omit undefined fields values', () => {
          expect(resp).not.toHaveProperty('notExist')
        })
        it('should keep all defined fields values', () => {
          expect(origValue).toMatchObject(resp)
        })
      })

      describe('when called with value as top level', () => {
        let refResult: Values | undefined
        let staticFileResult: Values | undefined
        let varResult: Values | undefined
        beforeEach(async () => {
          refResult = await transformValues({
            values: new ReferenceExpression(mockInstance.elemID),
            type: mockType,
            transformFunc,
          })
          staticFileResult = await transformValues({
            values: new StaticFile({ content: Buffer.from('asd'), filepath: 'a' }),
            type: mockType,
            transformFunc,
          })
          varResult = await transformValues({
            values: new VariableExpression(
              new ElemID(ElemID.VARIABLES_NAMESPACE, 'myVar', 'var')
            ),
            type: mockType,
            transformFunc,
          })
        })
        it('should keep the value type', () => {
          expect(refResult).toBeInstanceOf(ReferenceExpression)
          expect(staticFileResult).toBeInstanceOf(StaticFile)
          expect(varResult).toBeInstanceOf(VariableExpression)
        })
      })
    })
    const MAGIC_VAL = 'magix'
    const MOD_MAGIC_VAL = 'BIRD'
    const transformTest: TransformFunc = async ({ value, field }) => {
      if (value === MAGIC_VAL) {
        return MOD_MAGIC_VAL
      }
      if (isReferenceExpression(value)) {
        return value.value
      }
      const fieldType = await field?.getType()
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
          const result = await transformValues({
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
      const unTypedValues = {
        unTypedArr: [MAGIC_VAL],
        unTypedObj: {
          key: MAGIC_VAL,
        },
      }
      beforeEach(async () => {
        const result = await transformValues(
          {
            values: {
              ...mockInstance.value,
              ...unTypedValues,
            },
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

      it('should tranfsorm nested arrays which do not have a field', () => {
        expect(resp.unTypedArr[0]).toEqual(MOD_MAGIC_VAL)
      })

      it('should tranfsorm nested objects which do not have a field', () => {
        expect(resp.unTypedObj.key).toEqual(MOD_MAGIC_VAL)
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

      beforeAll(async () => {
        await transformValues(
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

      it('should traverse map items with correct path ID', () => {
        expect(paths)
          .toContain(mockInstance.elemID.createNestedID('obj', '0', 'mapOfStringList').getFullName())
        expect(paths)
          .toContain(mockInstance.elemID.createNestedID('obj', '0', 'mapOfStringList', 'l1').getFullName())
        expect(paths)
          .toContain(mockInstance.elemID.createNestedID('obj', '0', 'mapOfStringList', 'l1', '0').getFullName())
      })
    })

    describe('when called with array', () => {
      beforeEach(async () => {
        const result = await transformValues({
          values: [{ key: 1 }, { key: 2 }, { key: 3 }],
          type: new ListType(
            new ObjectType({
              elemID: mockElem,
              fields: { key: { refType: BuiltinTypes.NUMBER } },
            })
          ),
          transformFunc: ({ value, path }) => (
            _.isPlainObject(value) || _.isArray(value) ? value : `${path?.getFullName()}:${value}`
          ),
          pathID: mockElem.createNestedID('instance', 'list'),
          strict: true,
        })
        expect(result).toBeDefined()
        resp = result as Values
      })
      it('should return array with transformed values', () => {
        expect(resp).toEqual([
          { key: 'mockAdapter.test.instance.list.0.key:1' },
          { key: 'mockAdapter.test.instance.list.1.key:2' },
          { key: 'mockAdapter.test.instance.list.2.key:3' },
        ])
      })
    })

    describe('with allowEmpty', () => {
      it('should not remove empty list', async () => {
        const result = await transformValues({
          values: [],
          type: new ListType(BuiltinTypes.NUMBER),
          transformFunc: ({ value }) => value,
          allowEmpty: true,
        })

        expect(result).toEqual([])
      })

      it('should not remove empty object', async () => {
        const result = await transformValues({
          values: {},
          type: new ObjectType({ elemID: new ElemID('adapter', 'type') }),
          transformFunc: ({ value }) => value,
          allowEmpty: true,
        })

        expect(result).toEqual({})
      })
    })
  })

  describe('transformElement', () => {
    let primType: PrimitiveType
    let listType: ListType
    let mapType: MapType
    let objType: ObjectType
    let inst: InstanceElement
    let transformFunc: jest.MockedFunction<TransformFunc>
    beforeEach(() => {
      primType = new PrimitiveType({
        elemID: new ElemID('test', 'prim'),
        primitive: PrimitiveTypes.NUMBER,
        annotationRefsOrTypes: { a1: BuiltinTypes.STRING },
        annotations: { a1: 'asd' },
      })
      listType = new ListType(primType)
      mapType = new MapType(primType)
      objType = new ObjectType({
        elemID: new ElemID('test', 'test'),
        fields: {
          f1: { refType: BuiltinTypes.STRING },
          f2: {
            refType: listType,
            annotations: {
              a1: 'foo',
              [CORE_ANNOTATIONS.DEPENDS_ON]: [
                { reference: new ReferenceExpression(primType.elemID) },
              ],
            },
          },
          f3: {
            refType: mapType,
            annotations: {
              a2: 'foo',
              [CORE_ANNOTATIONS.DEPENDS_ON]: [
                { reference: new ReferenceExpression(primType.elemID) },
              ],
            },
          },
          f4: {
            refType: BuiltinTypes.STRING,
          },
        },
        annotationRefsOrTypes: { a2: BuiltinTypes.STRING },
        annotations: { a2: 1 },
      })
      inst = new InstanceElement(
        'test',
        objType,
        { f1: 'a', f2: [1, 2, 3], f3: false },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: ['me'],
          [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl',
        },
      )
      transformFunc = mockFunction<TransformFunc>().mockImplementation(({ value }) => value)
    })
    describe('with PrimitiveType', () => {
      let result: PrimitiveType
      beforeEach(async () => {
        result = await transformElement({ element: primType, transformFunc, strict: false })
      })
      it('should return new primitive type', () => {
        expect(isPrimitiveType(result)).toBeTruthy()
      })
      it('should transform annotations', () => {
        expect(transformFunc).toHaveBeenCalledWith({
          value: 'asd', field: expect.any(Field), path: primType.elemID.createNestedID('attr', 'a1'),
        })
      })
    })
    describe('with ListType', () => {
      let result: ListType
      beforeEach(async () => {
        result = await transformElement({ element: listType, transformFunc, strict: false })
      })
      it('should return new list type', () => {
        expect(isListType(result)).toBeTruthy()
      })
      it('should transform inner type annotations', () => {
        expect(transformFunc).toHaveBeenCalledWith({
          value: 'asd', field: expect.any(Field), path: primType.elemID.createNestedID('attr', 'a1'),
        })
      })
    })
    describe('with MapType', () => {
      let result: MapType
      beforeEach(async () => {
        result = await transformElement({ element: mapType, transformFunc, strict: false })
      })
      it('should return new map type', () => {
        expect(isMapType(result)).toBeTruthy()
      })
      it('should transform inner type annotations', () => {
        expect(transformFunc).toHaveBeenCalledWith({
          value: 'asd', field: expect.any(Field), path: primType.elemID.createNestedID('attr', 'a1'),
        })
      })
    })
    describe('with ObjectType', () => {
      let result: ObjectType
      beforeEach(async () => {
        result = await transformElement({ element: objType, transformFunc, strict: false })
      })
      it('should return new object type', () => {
        expect(isObjectType(result)).toBeTruthy()
      })
      it('should transform type annotations', () => {
        expect(transformFunc).toHaveBeenCalledWith({
          value: 1,
          field: expect.objectContaining({ refType: createRefToElmWithValue(BuiltinTypes.STRING) }),
          path: objType.elemID.createNestedID('attr', 'a2'),
        })
      })
      it('should transform field annotations', () => {
        expect(transformFunc).toHaveBeenCalledWith({
          value: 'foo', field: expect.any(Field), path: objType.fields.f2.elemID.createNestedID('a1'),
        })
        expect(transformFunc).toHaveBeenCalledWith({
          value: { reference: new ReferenceExpression(primType.elemID) },
          field: expect.objectContaining({ refType: expect.anything() }),
          path: objType.fields.f2.elemID.createNestedID(CORE_ANNOTATIONS.DEPENDS_ON, '0'),
        })
      })
      it('should not transform fields when runOnFields is not set', () => {
        expect(transformFunc).not.toHaveBeenCalledWith({
          value: expect.objectContaining({ refType: BuiltinTypes.STRING }),
          field: undefined,
          path: objType.fields.f4.elemID,
        })
      })
    })
    describe('with ObjectType and runOnFields', () => {
      let result: ObjectType
      beforeEach(async () => {
        result = await transformElement({
          element: objType, transformFunc, strict: false, runOnFields: true,
        })
      })
      it('should return new object type', () => {
        expect(isObjectType(result)).toBeTruthy()
      })
      it('should transform type annotations', () => {
        expect(transformFunc).toHaveBeenCalledWith({
          value: 1,
          field: expect.objectContaining({ refType: createRefToElmWithValue(BuiltinTypes.STRING) }),
          path: objType.elemID.createNestedID('attr', 'a2'),
        })
      })
      it('should transform field annotations', () => {
        expect(transformFunc).toHaveBeenCalledWith({
          value: 'foo', field: expect.any(Field), path: objType.fields.f2.elemID.createNestedID('a1'),
        })
        expect(transformFunc).toHaveBeenCalledWith({
          value: { reference: new ReferenceExpression(primType.elemID) },
          field: expect.objectContaining({ refType: expect.anything() }),
          path: objType.fields.f2.elemID.createNestedID(CORE_ANNOTATIONS.DEPENDS_ON, '0'),
        })
      })
      it('should transform fields', () => {
        expect(transformFunc).toHaveBeenCalledWith({
          value: expect.objectContaining({ refType: createRefToElmWithValue(BuiltinTypes.STRING) }),
          field: undefined,
          path: objType.fields.f4.elemID,
        })
      })
      it('should not run on annotations if transformFunc returned undefined on the field', async () => {
        const otherFunc = mockFunction<TransformFunc>().mockImplementation(() => undefined)
        await transformElement({
          element: objType, transformFunc: otherFunc, strict: false, runOnFields: true,
        })
        expect(otherFunc).toHaveBeenCalledWith({
          value: expect.objectContaining({ refType: createRefToElmWithValue(BuiltinTypes.STRING) }),
          field: undefined,
          path: objType.fields.f4.elemID,
        })
        expect(otherFunc).toHaveBeenCalledWith({
          value: expect.objectContaining({ refType: createRefToElmWithValue(listType) }),
          field: undefined,
          path: objType.fields.f2.elemID,
        })
        expect(otherFunc).not.toHaveBeenCalledWith({
          value: { reference: new ReferenceExpression(primType.elemID) },
          field: expect.objectContaining({ refType: BuiltinTypes.STRING }),
          path: objType.fields.f2.elemID.createNestedID(CORE_ANNOTATIONS.DEPENDS_ON, '0'),
        })
      })
    })
    describe('with valid InstanceElement', () => {
      let result: InstanceElement
      beforeEach(async () => {
        result = await transformElement({ element: inst, transformFunc, strict: false })
      })
      it('should return a new instance', () => {
        expect(isInstanceElement(result)).toBeTruthy()
      })
      it('should transform values', () => {
        expect(transformFunc).toHaveBeenCalledWith(
          { value: 'a', field: objType.fields.f1, path: inst.elemID.createNestedID('f1') }
        )
      })
      it('should transform annotations', () => {
        expect(transformFunc).toHaveBeenCalledWith({
          value: 'me',
          field: expect.any(Field),
          path: inst.elemID.createNestedID(CORE_ANNOTATIONS.PARENT, '0'),
        })
      })

      it('should copy the annotation type annotations to the field annotations', async () => {
        const callArgs = transformFunc.mock.calls.flat().find(args => args.value === 'someUrl')
        expect(callArgs?.field).toBeDefined()
        const fieldArg = callArgs?.field
        const fieldType = fieldArg !== undefined && await fieldArg.getType()
        const annotations = fieldType && fieldType.annotations
        expect(callArgs?.field?.annotations).toEqual(annotations)
        expect(_.isEmpty(callArgs?.field?.annotations)).toBeFalsy()
      })
    })
    describe('with invalid InstanceElement', () => {
      let otherObjType: ObjectType
      let invalidInst: InstanceElement
      let result: InstanceElement
      beforeEach(() => {
        const nestedType = new ObjectType({ elemID: new ElemID('salesforce', 'nested') })
        otherObjType = new ObjectType({
          elemID: new ElemID('salesforce', 'obj'),
          fields: {
            nested: { refType: nestedType },
            numberNested: { refType: nestedType },
            booleanNested: { refType: nestedType },
            nestedArray: { refType: new ListType(nestedType) },
          },
        })
        invalidInst = new InstanceElement(
          'invalid',
          otherObjType,
          {
            nested: 'aaa',
            numberNested: 1,
            booleanNested: true,
            nestedArray: ['aaa', 'bbb'],
          },
        )
      })
      it('should correctly handle type inconsistencies when strict=false', async () => {
        result = await transformElement({ element: invalidInst, transformFunc, strict: false })
        expect(isInstanceElement(result)).toBeTruthy()
        expect(result.value.nested).toEqual('aaa')
        expect(result.value.numberNested).toEqual(1)
        expect(result.value.booleanNested).toBeTruthy()
        expect(result.value.nestedArray).toEqual(['aaa', 'bbb'])
      })
      it('should correctly handle type inconsistencies when strict=true', async () => {
        result = await transformElement({ element: invalidInst, transformFunc, strict: true })
        expect(isInstanceElement(result)).toBeTruthy()
        expect(result.value.nested).toEqual('aaa')
        expect(result.value.numberNested).toEqual(1)
        expect(result.value.booleanNested).toBeTruthy()
        expect(result.value.nestedArray).toEqual(['aaa', 'bbb'])
      })
    })
    describe('allowEmpty', () => {
      const element = new InstanceElement(
        'instance',
        new ObjectType({ elemID: new ElemID('adapter', 'type') }),
        {
          val1: [],
          val2: undefined,
          val3: {},
        }
      )

      it('allowEmpty = true should not remove empty objects and arrays', async () => {
        const transformedElement = await transformElement({
          element,
          transformFunc: ({ value }) => value,
          strict: false,
          allowEmpty: true,
        })
        expect(transformedElement.value).toEqual({ val1: [], val3: {} })
      })

      it('allowEmpty = false should remove empty objects and arrays', async () => {
        const transformedElement = await transformElement({
          element,
          transformFunc: ({ value }) => value,
          strict: false,
          allowEmpty: false,
        })
        expect(transformedElement.value).toEqual({})
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
      annotationRefsOrTypes: {
        refValue: BuiltinTypes.STRING,
        reg: BuiltinTypes.STRING,

      },
      annotations: {
        name: objectName,
      },
      fields: {
        refValue: { refType: BuiltinTypes.STRING },
        arrayValues: { refType: new ListType(BuiltinTypes.STRING) },
        mapValues: { refType: new MapType(BuiltinTypes.STRING) },
        fileValue: { refType: BuiltinTypes.STRING },
        objValue: { refType: new ObjectType({ elemID: new ElemID('salesforce', 'nested') }) },
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
      { from: 'Milano', to: 'Minsk', obj: { a: 1 } }
    )
    const instance = new InstanceElement(
      'instance',
      element,
      {
        name: instanceName,
        fileValue: valueFile,
        refValue: valueRef,
        objValue: new ReferenceExpression(
          firstRef.elemID.createNestedID('obj'), firstRef.value.obj, firstRef,
        ),
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
          {},
        ],
        mapValues: {
          regValue,
          valueRef,
        },
      },
      [],
      {
        [CORE_ANNOTATIONS.DEPENDS_ON]: { reference: valueRef },
      },
    )
    const elementRef = new ReferenceExpression(element.elemID, element, element)

    const sourceElement = new ObjectType({
      elemID,
      annotationRefsOrTypes: {
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
          refType: element,
          annotations: {
            reg: regValue,
            refValue: valueRef,
          },
        },
      },
    })

    describe('resolveValues on objectType', () => {
      let sourceElementCopy: ObjectType
      let resolvedElement: ObjectType

      beforeAll(async () => {
        sourceElementCopy = sourceElement.clone()
        resolvedElement = await resolveValues(sourceElement, getName)
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

      it('should transform back to sourceElement value', async () => {
        expect(await restoreValues(sourceElement, resolvedElement, getName)).toEqual(sourceElement)
      })

      it('should maintain new values when transforming back to orig value', async () => {
        const after = resolvedElement.clone()
        after.annotations.new = newValue
        after.annotationRefTypes.new = createRefToElmWithValue(BuiltinTypes.STRING)
        after.fields.field.annotations.new = newValue
        after.annotations.regValue = newValue
        after.annotationRefTypes.regValue = createRefToElmWithValue(BuiltinTypes.STRING)
        after.fields.field.annotations.regValue = newValue

        const restored = await restoreValues(sourceElement, after, getName)
        expect(restored.annotations.new).toEqual(newValue)
        expect(restored.annotations.regValue).toEqual(newValue)

        expect(restored.fields.field.annotations.new).toEqual(newValue)
        expect(restored.fields.field.annotations.regValue).toEqual(newValue)
      })
    })

    describe('resolveValues on instance', () => {
      let resolvedInstance: InstanceElement

      beforeAll(async () => {
        resolvedInstance = await resolveValues(instance, getName)
      })

      it('should transform instanceElement', () => {
        expect(resolvedInstance.value.name).toEqual(instance.value.name)
        expect(resolvedInstance.value.refValue).toEqual(regValue)
        expect(resolvedInstance.value.arrayValues).toHaveLength(3)
        expect(resolvedInstance.value.arrayValues[0]).toEqual(regValue)
        expect(resolvedInstance.value.arrayValues[1]).toEqual(regValue)
        expect(Object.values(resolvedInstance.value.mapValues)).toHaveLength(2)
        expect(resolvedInstance.value.mapValues.regValue).toEqual(regValue)
        expect(resolvedInstance.value.mapValues.valueRef).toEqual(regValue)
        expect(resolvedInstance.value.fileValue).toEqual(Buffer.from(fileContent))
        expect(resolvedInstance.value.objValue).toEqual(firstRef.value.obj)
      })

      it('should transform back to instance', async () => {
        const restoredInstance = await restoreValues(instance, resolvedInstance, getName)
        expect(restoredInstance).toEqual(instance)
        // toEqual does not check types so we have to check them explicitly
        expect(restoredInstance.value.refValue).toBeInstanceOf(ReferenceExpression)
        expect(restoredInstance.value.objValue).toBeInstanceOf(ReferenceExpression)
        expect(restoredInstance.value.arrayValues[1]).toBeInstanceOf(ReferenceExpression)
        expect(restoredInstance.value.mapValues.valueRef).toBeInstanceOf(ReferenceExpression)
        expect(restoredInstance.value.fileValue).toBeInstanceOf(StaticFile)
        expect(restoredInstance.value.into).toBeInstanceOf(TemplateExpression)
      })
    })

    describe('resolveValues on primitive', () => {
      const prim = new PrimitiveType({
        elemID: new ElemID('mockAdapter', 'str'),
        primitive: PrimitiveTypes.STRING,
        annotationRefsOrTypes: {
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
        resolvedPrim = await resolveValues(prim, getName)
      })


      it('should transform primitive', () => {
        expect(resolvedPrim).not.toEqual(prim)

        expect(resolvedPrim.primitive).toEqual(prim.primitive)
        expect(resolvedPrim.elemID).toEqual(prim.elemID)
        expect(resolvedPrim.path).toEqual(prim.path)
        expect(resolvedPrim.annotationRefTypes).toEqual(prim.annotationRefTypes)

        expect(resolvedPrim.annotations).not.toEqual(prim.annotations)
        expect(resolvedPrim.annotations.refAnno).toEqual(regValue)
      })

      it('should transform back to primitive', async () => {
        expect(await restoreValues(prim, resolvedPrim, getName)).toEqual(prim)
      })
    })

    describe('resolveValues on field', () => {
      const FieldType = new ObjectType({
        elemID,
        annotationRefsOrTypes: {
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
        resolvedField = await resolveValues(field, getName)
      })


      it('should transform field', async () => {
        expect(resolvedField).not.toEqual(field)

        expect(await resolvedField.getType()).toEqual(await field.getType())
        expect(resolvedField.name).toEqual(field.name)
        expect(resolvedField.elemID).toEqual(field.elemID)
        expect(resolvedField.path).toEqual(field.path)
        expect(resolvedField.parent).toBe(field.parent)

        expect(resolvedField.annotations).not.toEqual(field.annotations)
        expect(resolvedField.annotations.refAnno).toEqual(regValue)
        expect(resolvedField.annotations.testAnno).toEqual(field.annotations.testAnno)
      })

      it('should transform back to field', async () => {
        expect(await restoreValues(field, resolvedField, getName)).toEqual(field)
      })
    })
  })

  describe('restore/ResolveChangeElement functions', () => {
    let afterData: InstanceElement
    let beforeData: InstanceElement
    let additionChange: AdditionChange<InstanceElement>
    let removalChange: RemovalChange<InstanceElement>
    let modificationChange: ModificationChange<InstanceElement>
    beforeEach(() => {
      afterData = mockInstance.clone()
      beforeData = mockInstance.clone()
      additionChange = { action: 'add', data: { after: afterData } }
      removalChange = { action: 'remove', data: { before: beforeData } }
      modificationChange = { action: 'modify', data: { before: beforeData, after: afterData } }
    })

    describe('restoreChangeElement func', () => {
      let mockRestore: RestoreValuesFunc
      beforeEach(() => {
        mockRestore = jest.fn().mockImplementation(
          <T extends Element>(_source: T, targetElement: T, _getLookUpName: GetLookupNameFunc) =>
            targetElement
        )
      })
      describe('with addition change', () => {
        let sourceChange: AdditionChange<InstanceElement>
        let restoredChange: AdditionChange<InstanceElement>
        beforeEach(async () => {
          sourceChange = { action: 'add', data: { after: afterData.clone() } }
          const sourceChanges = _.keyBy(
            [sourceChange],
            c => getChangeData(c).elemID.getFullName(),
          )
          restoredChange = await restoreChangeElement(additionChange,
            sourceChanges, getName, mockRestore) as AdditionChange<InstanceElement>
        })
        it('should call restore func on the after data', () => {
          expect(mockRestore).toHaveBeenCalledWith(sourceChange.data.after, afterData, getName)
        })
        it('should return the after data from the source change', () => {
          expect(restoredChange.data.after).toStrictEqual(sourceChange.data.after)
        })
      })
      describe('with removal change', () => {
        let sourceChange: RemovalChange<InstanceElement>
        let restoredChange: RemovalChange<InstanceElement>
        beforeEach(async () => {
          sourceChange = { action: 'remove', data: { before: beforeData.clone() } }
          const sourceChanges = _.keyBy(
            [sourceChange],
            c => getChangeData(c).elemID.getFullName(),
          )
          restoredChange = await restoreChangeElement(
            removalChange,
            sourceChanges,
            getName,
            mockRestore,
          ) as RemovalChange<InstanceElement>
        })
        it('should not call restore func on the before data', () => {
          expect(mockRestore).not.toHaveBeenCalled()
        })
        it('should return the before data from the source change', () => {
          expect(restoredChange.data.before).toBe(sourceChange.data.before)
        })
      })
      describe('with modification change', () => {
        let sourceChange: ModificationChange<InstanceElement>
        let restoredChange: ModificationChange<InstanceElement>
        beforeEach(async () => {
          sourceChange = {
            action: 'modify',
            data: { before: beforeData.clone(), after: afterData.clone() },
          }
          const sourceChanges = _.keyBy(
            [sourceChange],
            c => getChangeData(c).elemID.getFullName(),
          )
          restoredChange = await restoreChangeElement(
            modificationChange,
            sourceChanges,
            getName,
            mockRestore,
          ) as ModificationChange<InstanceElement>
        })
        it('should call the restore func only on the after data', () => {
          expect(mockRestore).toHaveBeenCalledTimes(1)
          expect(mockRestore).toHaveBeenCalledWith(sourceChange.data.after, afterData, getName)
        })
        it('should return the before data from the source change', () => {
          expect(restoredChange.data.before).toBe(sourceChange.data.before)
        })
      })
    })

    describe('resolveChangeElement func', () => {
      let mockResolve: ResolveValuesFunc
      beforeEach(() => {
        mockResolve = jest.fn().mockImplementation(
          <T extends Element>(element: T, _getLookUpName: GetLookupNameFunc) => element
        )
      })
      it('should call resolve func on after data when add change', async () => {
        await resolveChangeElement(additionChange, getName, mockResolve)
        expect(mockResolve).toHaveBeenCalledWith(afterData, getName, undefined)
      })

      it('should call resolve func on before and after data when modification change', async () => {
        await resolveChangeElement(modificationChange, getName, mockResolve)
        expect(mockResolve).toHaveBeenCalledWith(beforeData, getName, undefined)
        expect(mockResolve).toHaveBeenCalledWith(afterData, getName, undefined)
      })

      it('should call resolve func on before data when removal change', async () => {
        await resolveChangeElement(removalChange, getName, mockResolve)
        expect(mockResolve).toHaveBeenCalledWith(beforeData, getName, undefined)
      })
    })
  })

  describe('applyFunctionToChangeData', () => {
    const transformFunc = (): string => 'changed'
    describe('with addition change', () => {
      let transformedChange: AdditionChange<string>
      beforeEach(async () => {
        transformedChange = await applyFunctionToChangeData(
          { action: 'add', data: { after: 'orig' }, path: ['path'] },
          transformFunc,
        )
      })
      it('should change the after value', () => {
        expect(transformedChange.data.after).toEqual('changed')
      })
      it('should keep extra info on the change (support for detailed change)', () => {
        expect(transformedChange).toHaveProperty('path', ['path'])
      })
    })
    describe('with removal change', () => {
      let transformedChange: RemovalChange<string>
      beforeEach(async () => {
        transformedChange = await applyFunctionToChangeData(
          { action: 'remove', data: { before: 'orig' } },
          transformFunc,
        )
      })
      it('should change the before value', () => {
        expect(transformedChange.data.before).toEqual('changed')
      })
    })
    describe('with modification change', () => {
      let transformedChange: ModificationChange<string>
      beforeEach(async () => {
        transformedChange = await applyFunctionToChangeData(
          { action: 'modify', data: { before: 'orig', after: 'orig' } },
          transformFunc,
        )
      })
      it('should change the before and after values', () => {
        expect(transformedChange.data.before).toEqual('changed')
        expect(transformedChange.data.after).toEqual('changed')
      })
    })
  })

  describe('getPath', () => {
    it('should get annotations inside fields', () => {
      const clonedMockField = new Field(mockType, 'field', BuiltinTypes.STRING, { str: 'val' })
      const annoPath = getPath(clonedMockField, clonedMockField.elemID.createNestedID('str'))
      expect(annoPath).toEqual(['annotations', 'str'])
    })
  })

  describe('set path func', () => {
    let clonedMockType: ObjectType
    beforeEach(() => {
      clonedMockType = mockType.clone()
    })

    it('should do nothing when base elem is not parent of full elemID', () => {
      setPath(clonedMockType, new ElemID('salto', 'nope'), 'value')
      expect(clonedMockType.isEqual(mockType)).toBeTruthy()
    })

    it('should do nothing when trying to set whole element', () => {
      setPath(clonedMockType, clonedMockType.elemID, new ObjectType({ elemID: new ElemID('new') }))
      expect(clonedMockType.isEqual(mockType)).toBeTruthy()
    })

    it('should do add value even for currently non existing path', () => {
      setPath(clonedMockType, mockElem.createNestedID('field', 'nope'), 'value')
      expect(clonedMockType.fields.nope).toEqual('value')
    })

    it('should set a field annotation path', () => {
      setPath(clonedMockType, clonedMockType.fields.str.elemID.createNestedID('testAnno'), 'NEW TEST FIELD ANNO')
      expect(clonedMockType.fields.str.annotations.testAnno).toEqual('NEW TEST FIELD ANNO')
    })

    it('should set an annotation path', () => {
      setPath(clonedMockType, clonedMockType.elemID.createNestedID('attr', 'testAnno'), 'NEW TEST ANNO')
      expect(clonedMockType.annotations.testAnno).toEqual('NEW TEST ANNO')
    })

    it('should set annotation type path', () => {
      setPath(clonedMockType, clonedMockType.elemID.createNestedID('annotation', 'testAnno',), BuiltinTypes.NUMBER)
      expect(clonedMockType.annotationRefTypes.testAnno.elemID).toEqual(BuiltinTypes.NUMBER.elemID)
    })

    it('should set an instance value path', () => {
      const clonedMockInstance = mockInstance.clone()
      setPath(clonedMockInstance, clonedMockInstance.elemID.createNestedID('str'), 'new val')
      expect(clonedMockInstance.value.str).toEqual('new val')
    })

    it('should set field annotation', () => {
      const clonedMockField = new Field(mockType, 'field', BuiltinTypes.STRING)
      setPath(clonedMockField, clonedMockField.elemID.createNestedID('str'), 'new val')
      expect(clonedMockField.annotations.str).toEqual('new val')
    })

    it('should unset an instance value path', () => {
      const clonedMockInstance = mockInstance.clone()
      setPath(clonedMockInstance, clonedMockInstance.elemID.createNestedID('str'), undefined)
      expect('str' in clonedMockInstance.value).toBeFalsy()
    })

    it('should unset annotation type path', () => {
      setPath(clonedMockType, clonedMockType.elemID.createNestedID('annotation', 'testAnno'), undefined)
      expect('testAnno' in clonedMockType.annotationRefTypes).toBeFalsy()
    })

    it('should unset an annotation path', () => {
      setPath(clonedMockType, clonedMockType.elemID.createNestedID('attr', 'testAnno'), undefined)
      expect('testAnno' in clonedMockType.annotations).toBeFalsy()
    })

    it('should unset a field annotation path', () => {
      setPath(clonedMockType, clonedMockType.fields.str.elemID.createNestedID('testAnno'), undefined)
      expect('testAnno' in clonedMockType.fields.str.annotations).toBeFalsy()
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
    it('should resolve an instance value path', () => {
      expect(resolvePath(
        mockInstance,
        mockInstance.elemID.createNestedID('str')
      )).toBe('val')
    })
    it('should not resolve an annotation type path', () => {
      expect(resolvePath(
        mockType,
        mockType.elemID.createNestedID('annotation', 'testAnno', 'testAnno')
      )).toBeUndefined()
    })
    it('should resolve an instance annotation value path', () => {
      expect(resolvePath(
        mockInstance,
        mockInstance.elemID.createNestedID(CORE_ANNOTATIONS.DEPENDS_ON)
      )?.reference).toBe(valueRef)
    })
  })

  describe('findElement functions', () => {
    /**   ElemIDs   * */
    const primID = new ElemID('test', 'prim')

    /**   primitives   * */
    const primStr = new PrimitiveType({
      elemID: primID,
      primitive: PrimitiveTypes.STRING,
      annotationRefsOrTypes: {},
      annotations: {},
    })

    const primNum = new PrimitiveType({
      elemID: primID,
      primitive: PrimitiveTypes.NUMBER,
      annotationRefsOrTypes: {},
      annotations: {},
    })

    /**   object types   * */
    const otID = new ElemID('test', 'obj')
    const ot = new ObjectType({
      elemID: otID,
      fields: {
        // eslint-disable-next-line camelcase
        num_field: { refType: primNum },
        // eslint-disable-next-line camelcase
        str_field: { refType: primStr },
      },
      annotationRefsOrTypes: {},
      annotations: {},
    })
    const otRef = createRefToElmWithValue(ot)
    const instances = [
      new InstanceElement('1', otRef, {}),
      new InstanceElement('2', otRef, {}),
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

    it('should not modify a map type', () => {
      const flatMap = flattenElementStr(mockMap)
      expect(flatMap).toEqual(mockMap)
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
        str: { refType: BuiltinTypes.STRING },
        num: { refType: BuiltinTypes.NUMBER },
      },
    })
    const objElemID = new ElemID('salto', 'obj')
    const obj = new ObjectType({
      elemID: objElemID,
      annotationRefsOrTypes: {
        obj: annoType,
        list: new ListType(BuiltinTypes.STRING),
        map: new MapType(BuiltinTypes.STRING),
      },
      annotations: {
        obj: {
          str: 'HOW MUCH IS 6 * 9',
          num: 42,
        },
        list: ['I', 'do', 'not', 'write', 'jokes', 'in', 'base 13'],
        map: {
          oh: 'no',
          need: 'a joke',
        },
      },
      fields: {
        obj: { refType: annoType, annotations: { label: 'LABEL' } },
        list: { refType: new ListType(BuiltinTypes.STRING) },
        map: { refType: new MapType(BuiltinTypes.STRING) },
      },
    })
    const inst = new InstanceElement(
      'inst',
      obj,
      {
        obj: { str: 'Well I do', num: 42 },
        list: ['Do', 'you', 'get', 'it', '?'],
        map: { Do: 'you?' },
      },
      [],
      {
        [CORE_ANNOTATIONS.DEPENDS_ON]: [{ reference: new ObjectType({ elemID: new ElemID('salto', 'dep') }) }],
      }
    )
    const prim = new PrimitiveType({
      elemID: new ElemID('salto', 'prim'),
      annotationRefsOrTypes: {
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
        async id => id.idType === 'type' || id.idType === 'field'
      )
      expect(onlyFields).toBeDefined()
      expectEqualFields(onlyFields?.fields, obj.fields)
      expect(onlyFields?.annotations).toEqual({})
      expect(onlyFields?.annotationRefTypes).toEqual({})
      const onlyAnno = await filterByID(
        objElemID,
        obj,
        async id => id.idType === 'type' || id.idType === 'attr'
      )
      expect(onlyAnno).toBeDefined()
      expect(onlyAnno?.fields).toEqual({})
      expect(onlyAnno?.annotations).toEqual(obj.annotations)
      expect(onlyAnno?.annotationRefTypes).toEqual({})

      const onlyAnnoType = await filterByID(
        objElemID,
        obj,
        async id => id.idType === 'type' || id.idType === 'annotation'
      )
      expect(onlyAnnoType).toBeDefined()
      expect(onlyAnnoType?.fields).toEqual({})
      expect(onlyAnnoType?.annotations).toEqual({})
      expect(onlyAnnoType?.annotationRefTypes).toEqual(obj.annotationRefTypes)

      const withoutAnnoObjStr = await filterByID(
        objElemID,
        obj,
        async id => !id.getFullNameParts().includes('str')
      )
      expect(withoutAnnoObjStr).toBeDefined()
      expectEqualFields(withoutAnnoObjStr?.fields, obj.fields)
      expect(withoutAnnoObjStr?.annotations.obj).toEqual({ num: 42 })
      expect(withoutAnnoObjStr?.annotations.list).toEqual(obj.annotations.list)
      expect(withoutAnnoObjStr?.annotations.map).toEqual(obj.annotations.map)
      expect(withoutAnnoObjStr?.annotationRefTypes).toEqual(obj.annotationRefTypes)

      const withoutFieldAnnotations = await filterByID(
        objElemID,
        obj,
        async id => id.getFullName() !== 'salto.obj.field.obj.label'
      )

      expect(withoutFieldAnnotations).toBeDefined()
      expect(withoutFieldAnnotations?.annotations).toEqual(obj.annotations)
      expect(withoutFieldAnnotations?.annotationRefTypes).toEqual(obj.annotationRefTypes)
      expect(withoutFieldAnnotations?.fields.obj).toBeDefined()
      expect(withoutFieldAnnotations?.fields.obj.annotations).toEqual({})
      const onlyI = await filterByID(
        objElemID,
        obj,
        async id => (
          Number.isNaN(Number(_.last(id.getFullNameParts())))
          || Number(_.last(id.getFullNameParts())) === 0
        )
      )
      expect(onlyI).toBeDefined()
      expectEqualFields(onlyI?.fields, obj.fields)
      expect(onlyI?.annotations.obj).toEqual(obj.annotations.obj)
      expect(onlyI?.annotations.list).toEqual(['I'])
      expect(onlyI?.annotationRefTypes).toEqual(obj.annotationRefTypes)
    })

    it('should filter primitive type', async () => {
      const filteredPrim = await filterByID(
        prim.elemID,
        prim,
        async id => !id.getFullNameParts().includes('str')
      )
      expect(filteredPrim?.annotations.obj).toEqual({ num: 17 })
      expect(filteredPrim?.annotationRefTypes).toEqual({ obj: createRefToElmWithValue(annoType) })
    })

    it('should filter instances', async () => {
      const filteredInstance = await filterByID(
        inst.elemID,
        inst,
        async id => !id.getFullNameParts().includes('list')
      )
      expect(filteredInstance?.value).toEqual({ obj: inst.value.obj, map: inst.value.map })
      expect(filteredInstance?.annotations).toEqual(inst.annotations)
    })

    it('should not filter empty values', async () => {
      const instance = new InstanceElement(
        'instance',
        obj,
        {
          emptyList: [],
          emptyObj: {},
        },
      )
      const filteredInstance = await filterByID(
        instance.elemID,
        instance,
        async () => true
      )
      expect(filteredInstance?.value).toEqual({ emptyList: [], emptyObj: {} })
    })

    it('should return undefined if the base item fails the filter func', async () => {
      const filteredInstance = await filterByID(
        inst.elemID,
        inst,
        async id => id.idType !== 'instance'
      )
      expect(filteredInstance).toBeUndefined()
    })

    it('should not set array, map and obj values that are empty after filtering', async () => {
      const withoutList = await filterByID(
        inst.elemID,
        inst,
        async id => Number.isNaN(Number(_.last(id.getFullNameParts())))
      )
      expect(withoutList?.value).toEqual({ obj: inst.value.obj, map: inst.value.map })

      const withoutObj = await filterByID(
        inst.elemID,
        inst,
        async id => !id.getFullNameParts().includes('str') && !id.getFullNameParts().includes('num')
      )
      expect(withoutObj?.value).toEqual({ list: inst.value.list, map: inst.value.map })

      const withoutMap = await filterByID(
        inst.elemID,
        inst,
        async id => !id.getFullNameParts().includes('Do'),
      )
      expect(withoutMap?.value).toEqual({ obj: inst.value.obj, list: inst.value.list })
    })

    it('should not call filter function with invalid attr ID', async () => {
      const filterFunc = jest.fn().mockResolvedValue(true)
      await filterByID(
        obj.elemID,
        obj,
        filterFunc
      )

      expect(filterFunc).not.toHaveBeenCalledWith(obj.elemID.createNestedID('attr'))
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
        .toEqual(expect.arrayContaining(['BOOL', 'STR', 'OBJ', 'OBJWITHINNEROBJ', 'NUMMAP']))
      expect(Object.keys(result.OBJWITHINNEROBJ)).toContain('INNEROBJ')
      expect(Object.keys(result.OBJWITHINNEROBJ.INNEROBJ))
        .toEqual(expect.arrayContaining(['LISTKEY', 'STRINGKEY']))
      expect(Object.keys(result.NUMMAP)).toEqual(expect.arrayContaining(['KEY12', 'NUM13']))
    })

    it('should map keys recursively when passing the pathID', () => {
      const result = mapKeysRecursive(mockInstance.value, ({ key, pathID }) => {
        if (pathID?.getFullName().toLowerCase().includes('key')) {
          return key.toUpperCase()
        }
        return key
      }, mockInstance.elemID)
      expect(Object.keys(result))
        .toEqual(expect.arrayContaining(['bool', 'str', 'obj', 'objWithInnerObj', 'numMap']))
      expect(Object.keys(result.objWithInnerObj)).toContain('innerObj')
      expect(Object.keys(result.objWithInnerObj.innerObj))
        .toEqual(expect.arrayContaining(['LISTKEY', 'STRINGKEY']))
      expect(Object.keys(result.numMap)).toEqual(expect.arrayContaining(['KEY12', 'num13']))
    })
  })

  describe('applyInstancesDefaults', () => {
    const baseElemID = new ElemID('salto', 'base')
    const base = new ObjectType({
      elemID: baseElemID,
      fields: {
        field1: { refType: BuiltinTypes.STRING, annotations: { label: 'base' } },
        field2: { refType: BuiltinTypes.STRING, annotations: { label: 'base' } },
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
        field1: { refType: strType, annotations: { [CORE_ANNOTATIONS.DEFAULT]: 'field1' } },
        field2: { refType: strType },
        base: { refType: base },
      },
    })
    const nestedTypeRef = createRefToElmWithValue(nested)
    const ins1 = new InstanceElement(
      'ins',
      nestedTypeRef,
      { field1: 'ins1', field2: 'ins1' },
      undefined,
      { anno: 1 },
    )
    const shouldUseFieldDef = new InstanceElement(
      'ins',
      nestedTypeRef,
      {
        field2: 'ins1',
        base: { field1: 'ins2', field2: 'ins2' },
      }
    )

    it('should use field defaults', async () => {
      const elements = [shouldUseFieldDef.clone()]
      const [transformed] = await awu(applyInstancesDefaults(awu(elements)))
        .toArray() as [InstanceElement]
      expect(transformed.value).toEqual({
        field1: 'field1',
        field2: 'ins1',
        base: {
          field1: 'ins2',
          field2: 'ins2',
        },
      })
    })

    it('should use type defaults', async () => {
      const shouldUseTypeDef = new InstanceElement(
        'ins',
        nestedTypeRef,
        {
          field1: 'ins1',
          base: { field1: 'ins2', field2: 'ins2' },
        }
      )
      const elements = [shouldUseTypeDef]
      const [transformed] = await awu(applyInstancesDefaults(awu(elements)))
        .toArray() as [InstanceElement]
      expect(transformed.value).toEqual({
        field1: 'ins1',
        field2: 'type',
        base: {
          field1: 'ins2',
          field2: 'ins2',
        },
      })
    })

    it('should use object defaults', async () => {
      const elements = [ins1.clone()]
      const [transformed] = await awu(applyInstancesDefaults(awu(elements)))
        .toArray() as [InstanceElement]
      expect(transformed.value).toEqual({
        field1: 'ins1',
        field2: 'ins1',
        base: {
          field1: 'base1',
          field2: 'base2',
        },
      })
    })

    it('should not remove values that have no corresponding field', async () => {
      const instanceWithAdditionalValues = ins1.clone()
      instanceWithAdditionalValues.value.hasNoCorrespondingField = 'hasNoCorrespondingField'
      const elements = [instanceWithAdditionalValues]
      const [transformed] = await awu(applyInstancesDefaults(awu(elements)))
        .toArray() as [InstanceElement]
      expect(transformed.value).toEqual({
        field1: 'ins1',
        field2: 'ins1',
        base: {
          field1: 'base1',
          field2: 'base2',
        },
        hasNoCorrespondingField: 'hasNoCorrespondingField',
      })
    })

    it('should use the existing value in case it does not match the field type', async () => {
      const instanceWithAdditionalValues = ins1.clone()
      instanceWithAdditionalValues.value.base = 'differentType'
      const elements = [instanceWithAdditionalValues]
      const [transformed] = await awu(applyInstancesDefaults(awu(elements)))
        .toArray() as [InstanceElement]
      expect(transformed.value).toEqual({
        field1: 'ins1',
        field2: 'ins1',
        base: 'differentType',
      })
    })

    it('should not use defaults for inner fields when its value is undefined', async () => {
      const typeWithNestedDefaultsElemID = new ElemID('salto', 'typeWithNestedDefaults')
      const typeWithNestedDefaults = new ObjectType({
        elemID: typeWithNestedDefaultsElemID,
        fields: {
          withDefault: { refType: strType, annotations: { [CORE_ANNOTATIONS.DEFAULT]: 'default val' } },
          nestedTypeHasDefaults: { refType: nested },
        },
      })

      const instanceWithNoValues = new InstanceElement(
        'instance',
        typeWithNestedDefaults,
      )

      const elements = [instanceWithNoValues]
      const [transformed] = await awu(applyInstancesDefaults(awu(elements)))
        .toArray() as [InstanceElement]
      expect(transformed.value).toEqual({
        withDefault: 'default val',
      })
    })
  })

  describe('createDefaultInstanceFromType', () => {
    it('should create default instance from type', async () => {
      const mockElemID = new ElemID('test')
      const configType = new ObjectType({
        elemID: mockElemID,
        fields: {
          val1: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.DEFAULT]: 'test' },
          },
        },
      })
      expect((await createDefaultInstanceFromType('test', configType)).isEqual(new InstanceElement(
        'test',
        configType,
        { val1: 'test' }
      ))).toBeTruthy()
      expect(await createDefaultInstanceFromType('test', configType))
        .toEqual(new InstanceElement(
          'test',
          configType,
          { val1: 'test' }
        ))
    })
  })

  describe('safeJsonStringify', () => {
    describe('with circular references', () => {
      const elemID = new ElemID('salto', 'obj')
      const obj = new ObjectType({
        elemID,
        fields: {
          field: {
            refType: BuiltinTypes.STRING,
          },
          anotherField: {
            refType: BuiltinTypes.STRING,
          },
        },
        annotations: {
          target: 'target',
        },
      })
      obj.annotations.ref = new ReferenceExpression(
        elemID.createNestedID('attr', 'target'),
        'target',
        obj
      )
      const json = safeJsonStringify(obj)
      const parsed = JSON.parse(json)
      it('should serialize circular deps as [Circular]', () => {
        expect(parsed.annotations.ref.topLevelParent).toEqual('[Circular]')
        expect(parsed.fields.field.parent).toEqual('[Circular]')
      })
      it('should not serialize and object which is accessed twice without '
        + 'actually being circular as [Circulr]', () => {
        /*
        TODO: See what to do with this
        expect(parsed.fields.field).toEqual(undefined)
        expect(parsed.fields.field.getType()).not.toEqual('[Circular]')
        expect(parsed.fields.anotherField.getType()).not.toEqual('[Circular]')
        */
      })
    })
    describe('without circular references', () => {
      const elemID = new ElemID('salto', 'obj')
      const obj = new ObjectType({
        elemID,
        annotationRefsOrTypes: {
          target: BuiltinTypes.STRING,
        },
        annotations: {
          target: 'target',
        },
      })
      obj.annotations.ref = new ReferenceExpression(
        elemID.createNestedID('attr', 'target'),
        'target',
      )
      const saltoJSON = safeJsonStringify(obj)
      // eslint-disable-next-line no-restricted-syntax
      const regJSON = JSON.stringify(obj)
      it('should serialize to the same result JSON.stringify', () => {
        expect(saltoJSON).toEqual(regJSON)
      })
    })
    describe('with reference replacer', () => {
      let inst: InstanceElement
      beforeAll(() => {
        const elemID = new ElemID('salto', 'obj')
        inst = new InstanceElement(
          'test2',
          new ObjectType({ elemID }),
          {
            title: 'test',
            refWithVal: new ReferenceExpression(new ElemID('a', 'b'), 'something'),
            refWithoutVal: new ReferenceExpression(new ElemID('c', 'd')),
          },
        )
      })
      it('should replace the reference expression object with a serialized representation', () => {
        const res = safeJsonStringify(inst, elementExpressionStringifyReplacer, 2)
        expect(res).not.toEqual(safeJsonStringify(inst))
        expect(res).toEqual(`{
  "elemID": "ElemID(salto.obj.instance.test2)",
  "annotations": {},
  "annotationRefTypes": {},
  "value": {
    "title": "test",
    "refWithVal": "ReferenceExpression(a.b, <omitted>)",
    "refWithoutVal": "ReferenceExpression(c.d, <no value>)"
  },
  "refType": "TypeReference(salto.obj, <omitted>)"
}`)
      })
      it('should replace static file objects with the file\'s path', () => {
        const element = new ObjectType({
          elemID: new ElemID('salto', 'obj_staticfile'),
          annotationRefsOrTypes: {
            refValue: BuiltinTypes.STRING,
            reg: BuiltinTypes.STRING,

          },
          annotations: {},
          fields: {
            fileValue: { refType: BuiltinTypes.STRING },
          },
        })
        const instance = new InstanceElement(
          'test3',
          element,
          {
            fileValue: valueFile,
          },
          [],
          {},
        )
        const res = safeJsonStringify(instance, elementExpressionStringifyReplacer, 2)
        expect(res).toEqual(`{
  "elemID": "ElemID(salto.obj_staticfile.instance.test3)",
  "annotations": {},
  "annotationRefTypes": {},
  "path": [],
  "value": {
    "fileValue": "StaticFile(${valueFile.filepath}, ${valueFile.hash})"
  },
  "refType": "TypeReference(salto.obj_staticfile, <omitted>)"
}`)
      })
    })
  })

  describe('getAllReferencedIds', () => {
    it('should find referenced ids', () => {
      const res = getAllReferencedIds(mockInstance)
      expect(res).toEqual(new Set(['mockAdapter.test', 'mockAdapter.test2.field.aaa',
        templateElemID.getFullName(), templateElemID2.getFullName()]))
    })
    it('should find referenced ids only in annotations', () => {
      const res = getAllReferencedIds(mockInstance, true)
      expect(res).toEqual(new Set(['mockAdapter.test']))
    })
  })

  describe('getParents', () => {
    let result: ReturnType<typeof getParents>
    const obj = new ObjectType({ elemID: new ElemID('test', 'test') })
    describe('for an element with parents', () => {
      beforeEach(() => {
        const inst = new InstanceElement(
          'test',
          obj,
          {},
          undefined,
          { [CORE_ANNOTATIONS.PARENT]: ['a', 'b'] },
        )
        result = getParents(inst)
      })
      it('should return the parents annotation', () => {
        expect(result).toEqual(['a', 'b'])
      })
    })
    describe('for an element without parents', () => {
      beforeEach(() => {
        const inst = new InstanceElement(
          'test',
          obj,
          {},
        )
        result = getParents(inst)
      })
      it('should return an empty array', () => {
        expect(result).toEqual([])
      })
    })
  })

  describe('getParent', () => {
    let parent: InstanceElement
    let child: InstanceElement

    beforeEach(() => {
      const obj = new ObjectType({ elemID: new ElemID('test', 'test') })
      parent = new InstanceElement(
        'parent',
        obj,
        {},
      )
      child = new InstanceElement(
        'child',
        obj,
        {},
        [],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)],
        },
      )
    })

    it('should return the parent when there is a single instance parent', () => {
      expect(getParent(child)).toBe(parent)
    })

    it('should throw when having more than one parent', () => {
      child.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(parent.elemID, parent),
        new ReferenceExpression(parent.elemID, parent),
      ]
      expect(() => getParent(child)).toThrow()
    })

    it('should throw when having a non instance parent', () => {
      child.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(parent.elemID, 'a'),
      ]
      expect(() => getParent(child)).toThrow()
    })
  })

  describe('resolveTypeShallow', () => {
    const cloneAndAddField = (objectType: ObjectType): ObjectType => {
      const clonedObj = objectType.clone()
      clonedObj.fields.newField = new Field(
        objectType,
        'newField',
        BuiltinTypes.STRING,
      )
      return clonedObj
    }
    const fieldType = new ObjectType(
      { elemID: new ElemID('ad', 'fieldType') },
    )
    const fieldTypeWithAdditionalField = cloneAndAddField(fieldType)
    const annoType = new ObjectType(
      { elemID: new ElemID('ad', 'annoType') },
    )
    const annoTypeWithAdditionalField = cloneAndAddField(annoType)
    const objWithResolved = new ObjectType({
      elemID: new ElemID('ad', 'withResolved'),
      fields: {
        a: { refType: fieldType },
      },
      annotationRefsOrTypes: {
        annoA: annoType,
      },
    })
    const objWithResolvedWithAdditionalField = cloneAndAddField(objWithResolved)
    const objWithUnresolved = new ObjectType({
      elemID: new ElemID('ad', 'withResolved'),
      fields: {
        a: { refType: new TypeReference(fieldType.elemID) },
      },
      annotationRefsOrTypes: {
        annoA: new TypeReference(annoType.elemID),
      },
    })
    const instWithResolvedType = new InstanceElement(
      'resolved',
      objWithResolved,
      {
        a: 'does not matter',
      }
    )
    const instWithUnresolvedType = new InstanceElement(
      'resolved',
      new TypeReference(objWithResolved.elemID),
      {
        a: 'does not matter',
      }
    )
    const elementsSource = buildElementsSourceFromElements(
      [
        fieldTypeWithAdditionalField, annoTypeWithAdditionalField, instWithUnresolvedType,
        objWithResolvedWithAdditionalField, instWithResolvedType,
      ],
    )

    it('Should keep an ObjectType with resolved field types as is', async () => {
      const clonedObj = objWithResolved.clone()
      await resolveTypeShallow(clonedObj, elementsSource)
      expect(clonedObj).toEqual(objWithResolved)
    })

    it('Should resolve ObjectType fields types according to elementsSource', async () => {
      const clonedObj = objWithUnresolved.clone()
      expect(clonedObj.fields.a.refType.type).toBeUndefined()
      await resolveTypeShallow(clonedObj, elementsSource)
      expect(await clonedObj.fields.a.getType()).toEqual(fieldTypeWithAdditionalField)
      expect((await clonedObj.getAnnotationTypes()).annoA).toEqual(annoTypeWithAdditionalField)
    })

    it('Should keep an InstanceElement with a resolved type as is', async () => {
      const clonedInst = instWithResolvedType.clone()
      await resolveTypeShallow(clonedInst, elementsSource)
      expect(clonedInst).toEqual(instWithResolvedType)
    })

    it('Should resolve the type of the InstanceElement according to elementSource', async () => {
      const clonedInst = instWithUnresolvedType.clone()
      expect(clonedInst.refType.type).toBeUndefined()
      await resolveTypeShallow(clonedInst, elementsSource)
      expect(await clonedInst.getType()).toEqual(objWithResolvedWithAdditionalField)
    })
  })

  describe('createSchemeGuard', () => {
    it('Should create a scheme guard for a given scheme', () => {
      const scheme = Joi.object({
        a: Joi.string().required(),
      })
      const schemeGuard = createSchemeGuard<{a: string}>(scheme, 'message')
      expect(schemeGuard({ a: 'string' })).toBeTruthy()
      expect(schemeGuard({ a: 2 })).toBeFalsy()
    })
  })
})
