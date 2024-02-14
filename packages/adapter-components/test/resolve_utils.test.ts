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
import {
  AdditionChange,
  BuiltinTypes, CORE_ANNOTATIONS, createRefToElmWithValue,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  MapType, ModificationChange,
  ObjectType, PrimitiveType, PrimitiveTypes,
  ReferenceExpression, RemovalChange, StaticFile, TemplateExpression,
} from '@salto-io/adapter-api'
import { GetLookupNameFunc, ResolveValuesFunc, restoreValues } from '@salto-io/adapter-utils'
import { resolveValues, resolveChangeElement } from '../src/resolve_utils'

describe('resolve utils func', () => {
  const getName: GetLookupNameFunc = ({ ref }) => ref.value
  const mockStrType = new PrimitiveType({
    elemID: new ElemID('mockAdapter', 'str'),
    primitive: PrimitiveTypes.STRING,
    annotations: { testAnno: 'TEST ANNO TYPE' },
    path: ['here', 'we', 'go'],
  })
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
  const fileContent = 'bb'
  const valueFile = new StaticFile({ filepath: 'aa', content: Buffer.from(fileContent) })

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

  describe('resolveChangeElement func', () => {
    let afterData: InstanceElement
    let beforeData: InstanceElement
    let additionChange: AdditionChange<InstanceElement>
    let removalChange: RemovalChange<InstanceElement>
    let modificationChange: ModificationChange<InstanceElement>
    const templateElemID = new ElemID('template', 'test')
    const templateElemID2 = new ElemID('template2', 'test2')
    const templateRef = new TemplateExpression({ parts: ['this is:',
      new ReferenceExpression(templateElemID), 'a template',
      new ReferenceExpression(templateElemID2)] })
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
    beforeEach(() => {
      afterData = mockInstance.clone()
      beforeData = mockInstance.clone()
      additionChange = { action: 'add', data: { after: afterData } }
      removalChange = { action: 'remove', data: { before: beforeData } }
      modificationChange = { action: 'modify', data: { before: beforeData, after: afterData } }
    })
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
