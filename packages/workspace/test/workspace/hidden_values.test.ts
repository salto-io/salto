/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ObjectType,
  ElemID,
  BuiltinTypes,
  PrimitiveType,
  PrimitiveTypes,
  isObjectType,
  InstanceElement,
  isInstanceElement,
  CORE_ANNOTATIONS,
  DetailedChange,
  getChangeData,
  INSTANCE_ANNOTATIONS,
  ReferenceExpression,
  MapType,
  isRemovalChange,
  isAdditionChange,
  ListType,
  ReadOnlyElementsSource,
  Field,
  isField,
  toChange,
  TypeReference,
  DetailedChangeWithBaseChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, toDetailedChangeFromBaseChange } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { mockState } from '../common/state'
import { MergeResult } from '../../src/merger'
import { mergeWithHidden, handleHiddenChanges, getElementHiddenParts } from '../../src/workspace/hidden_values'
import { RemoteElementSource, createInMemoryElementSource } from '../../src/workspace/elements_source'
import { State } from '../../src/workspace/state'

const { awu } = collections.asynciterable

describe('mergeWithHidden', () => {
  const getFieldType = (typeName: string, primitive: PrimitiveTypes): PrimitiveType =>
    new PrimitiveType({
      elemID: new ElemID('test', typeName),
      primitive,
      annotationRefsOrTypes: { hiddenAnno: BuiltinTypes.HIDDEN_STRING },
    })
  describe('when parent value is deleted in the workspace', () => {
    let result: MergeResult
    beforeEach(async () => {
      const fieldType = getFieldType('text', PrimitiveTypes.STRING)
      const mockObjType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          f1: {
            refType: fieldType,
            annotations: { hiddenAnno: 'asd' },
          },
        },
      })
      const workspaceObjType = mockObjType.clone()
      delete workspaceObjType.fields.f1
      result = await mergeWithHidden(
        awu([fieldType, workspaceObjType]),
        createInMemoryElementSource([fieldType, mockObjType]),
      )
    })
    it('should omit the hidden value', async () => {
      const mergedWorkspaceObj = (await awu(result.merged.values()).find(isObjectType)) as ObjectType
      expect(mergedWorkspaceObj?.fields).not.toHaveProperty('f1')
    })
  })
  describe('when field type is changed in the workspace', () => {
    let result: MergeResult
    beforeEach(async () => {
      const workspaceFieldType = getFieldType('num', PrimitiveTypes.NUMBER)
      const workspaceType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          test: { refType: workspaceFieldType },
        },
      })
      const stateFieldType = getFieldType('text', PrimitiveTypes.STRING)
      const stateType = new ObjectType({
        ...workspaceType,
        fields: {
          test: {
            refType: stateFieldType,
            annotations: { hiddenAnno: 'asd' },
          },
        },
      })
      result = await mergeWithHidden(
        awu([workspaceFieldType, workspaceType]),
        createInMemoryElementSource([stateFieldType, stateType]),
      )
    })
    it('should not have merge errors', async () => {
      expect(await awu(result.errors.values()).flat().toArray()).toHaveLength(0)
    })
    it('should still add hidden annotations to the field', async () => {
      const type = (await awu(result.merged.values()).find(isObjectType)) as ObjectType
      expect(type?.fields.test.annotations).toHaveProperty('hiddenAnno', 'asd')
    })
  })

  describe('when the parent value in the workspace is not an object', () => {
    let result: MergeResult
    beforeEach(async () => {
      const innerType = new ObjectType({
        elemID: new ElemID('test', 'inner'),
        fields: {
          hidden: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
          },
          notHidden: {
            refType: BuiltinTypes.STRING,
          },
        },
      })

      const type = new ObjectType({
        elemID: new ElemID('adapter', 'type'),
        fields: {
          obj1: { refType: innerType },
          obj2: { refType: innerType },
          obj3: { refType: innerType },
          obj4: { refType: innerType },
        },
      })

      const stateInstance = new InstanceElement('instance', type, {
        obj1: { hidden: 'hidden', notHidden: 'notHidden' },
        obj2: { hidden: 'hidden', notHidden: 'notHidden' },
        obj3: { hidden: 'hidden', notHidden: 'notHidden' },
        obj4: { hidden: 'hidden', notHidden: 'notHidden' },
      })

      const workspaceInstance = new InstanceElement('instance', type, {
        obj2: 2,
        obj3: [],
        obj4: { notHidden: 'notHidden2' },
      })

      result = await mergeWithHidden(
        awu([workspaceInstance, type, innerType]),
        createInMemoryElementSource([stateInstance, type, innerType]),
      )
    })
    it('should not have merge errors', async () => {
      expect(await awu(result.errors.values()).flat().toArray()).toHaveLength(0)
    })
    it('should not add the hidden value to the instance when parent value is not an object', async () => {
      const instance = (await awu(result.merged.values()).find(isInstanceElement)) as InstanceElement
      expect(instance.value).toEqual({
        obj2: 2,
        obj3: [],
        obj4: { hidden: 'hidden', notHidden: 'notHidden2' },
      })
    })
  })

  describe('when a reference is pointing a value with hidden value', () => {
    let result: MergeResult
    beforeEach(async () => {
      const innerType = new ObjectType({
        elemID: new ElemID('test', 'inner'),
        fields: {
          hidden: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
          },
        },
      })

      const type = new ObjectType({
        elemID: new ElemID('adapter', 'type'),
        fields: {
          obj: { refType: innerType },
          ref: { refType: innerType },
        },
      })

      const stateInstance = new InstanceElement('instance', type, {
        obj: { hidden: 'hidden' },
        ref: { hidden: 'hidden' },
      })

      const workspaceInstance = new InstanceElement('instance', type, {
        obj: {},
        ref: new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'instance', 'obj')),
      })

      result = await mergeWithHidden(
        awu([workspaceInstance, type, innerType]),
        createInMemoryElementSource([stateInstance, type, innerType]),
      )
    })
    it('should not have merge errors', async () => {
      expect(await awu(result.errors.values()).flat().toArray()).toHaveLength(0)
    })
    it('should not change the reference', async () => {
      const instance = (await awu(result.merged.values()).find(isInstanceElement)) as InstanceElement
      expect(instance.value.ref).toBeInstanceOf(ReferenceExpression)
    })
    it('should add the hidden value to the non reference value', async () => {
      const instance = (await awu(result.merged.values()).find(isInstanceElement)) as InstanceElement
      expect(instance.value.obj).toEqual({ hidden: 'hidden' })
    })
  })

  describe('hidden_string in instance annotation', () => {
    let result: MergeResult
    beforeEach(async () => {
      const workspaceInstance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID('test', 'type'),
        }),
      )

      const stateInstance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID('test', 'type'),
        }),
        {},
        undefined,
        { [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl' },
      )

      result = await mergeWithHidden(awu([workspaceInstance]), createInMemoryElementSource([stateInstance]))
    })
    it('should not have merge errors', async () => {
      expect(await awu(result.errors.values()).flat().toArray()).toHaveLength(0)
    })
    it('should have the hidden_string value', async () => {
      const instance = await awu(result.merged.values()).find(isInstanceElement)
      expect(instance?.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toBe('someUrl')
    })
  })

  describe('hidden annotation in field', () => {
    let result: MergeResult
    beforeEach(async () => {
      const workspaceObject = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          field: {
            refType: BuiltinTypes.STRING,
          },
        },
      })

      const stateObject = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          field: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl' },
          },
        },
      })

      result = await mergeWithHidden(awu([workspaceObject]), createInMemoryElementSource([stateObject]))
    })
    it('should not have merge errors', async () => {
      expect(await awu(result.errors.values()).flat().isEmpty()).toBeTruthy()
    })
    it('should have the hidden annotation value', async () => {
      const object = (await awu(result.merged.values()).find(isObjectType)) as ObjectType
      expect(object?.fields?.field?.annotations?.[CORE_ANNOTATIONS.SERVICE_URL]).toBe('someUrl')
    })
  })
})

describe('handleHiddenChanges', () => {
  describe('added Field change with hidden annotation refType', () => {
    it('should return correct hidden and visible parts', async () => {
      const fieldType = new ObjectType({
        elemID: new ElemID('test', 'fieldType'),
        annotationRefsOrTypes: {
          stringValue: BuiltinTypes.STRING,
          hiddenStringValue: BuiltinTypes.HIDDEN_STRING,
        },
      })
      const objectType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          field: {
            refType: fieldType,
            annotations: {
              stringValue: 'visible',
              hiddenStringValue: 'hidden',
            },
          },
        },
      })
      const { field } = objectType.fields
      const change = toDetailedChangeFromBaseChange(toChange({ after: field }))
      const { hidden, visible } = await handleHiddenChanges(
        [change],
        mockState([objectType]),
        createInMemoryElementSource(),
      )
      expect(hidden).toHaveLength(1)
      const fieldHiddenPart = getChangeData(hidden[0]) as Field
      expect(fieldHiddenPart).toSatisfy(isField)
      expect(fieldHiddenPart.annotations).toEqual({ hiddenStringValue: 'hidden' })
      expect(visible).toHaveLength(1)
      const fieldVisiblePart = getChangeData(visible[0]) as Field
      expect(fieldVisiblePart).toSatisfy(isField)
      expect(fieldVisiblePart.annotations).toEqual({ stringValue: 'visible' })
    })
  })

  describe('when a field with hidden value annotation is added', () => {
    it('should hide existing field values', async () => {
      const objectTypeBefore = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {},
      })
      const objectTypeAfter = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          stringValue: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
          },
        },
      })
      const instance = new InstanceElement('instance', objectTypeBefore, {
        stringValue: 'hidden',
      })
      const { stringValue } = objectTypeAfter.fields
      const change = toDetailedChangeFromBaseChange(toChange({ after: stringValue }))
      const { hidden, visible } = await handleHiddenChanges(
        [change],
        mockState([objectTypeAfter, instance]),
        createInMemoryElementSource([objectTypeAfter, instance]),
      )

      expect(hidden).toHaveLength(0)
      expect(visible).toHaveLength(2)
      expect(visible).toContainEqual(
        expect.objectContaining({
          id: instance.elemID.createNestedID('stringValue'),
          action: 'remove',
        }),
      )
    })
  })

  describe('when a field with hidden value annotation is removed', () => {
    it('should unhide existing field values', async () => {
      const objectTypeBefore = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          stringValue: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
          },
        },
      })
      const objectTypeAfter = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {},
      })
      const instance = new InstanceElement('instance', objectTypeAfter, {
        stringValue: 'hidden',
      })
      const instanceVisible = new InstanceElement('instance', objectTypeBefore)
      const { stringValue } = objectTypeBefore.fields
      const change = toDetailedChangeFromBaseChange(toChange({ before: stringValue }))
      const { visible } = await handleHiddenChanges(
        [change],
        mockState([objectTypeAfter, instance]),
        createInMemoryElementSource([objectTypeAfter, instanceVisible]),
      )

      expect(visible).toContainEqual(
        expect.objectContaining({
          id: instance.elemID.createNestedID('stringValue'),
          action: 'add',
        }),
      )
    })
  })

  // This scenario happens when a field changes both hidden_value and refType
  describe('when a hidden value annotation is part of a field modification', () => {
    describe('when changed to hidden', () => {
      it('should hide existing field values', async () => {
        const objectTypeBefore = new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            myField: {
              refType: BuiltinTypes.STRING,
            },
          },
        })
        const objectTypeAfter = new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            myField: {
              refType: BuiltinTypes.STRING,
              annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
            },
          },
        })
        const instance = new InstanceElement('instance', objectTypeAfter, {
          myField: 'myValue',
        })
        const change = toDetailedChangeFromBaseChange(
          toChange({ before: objectTypeBefore.fields.myField, after: objectTypeAfter.fields.myField }),
        )
        const { visible } = await handleHiddenChanges(
          [change],
          mockState([objectTypeAfter, instance]),
          createInMemoryElementSource([objectTypeAfter, instance]),
        )

        expect(visible).toContainEqual(
          expect.objectContaining({
            id: instance.elemID.createNestedID('myField'),
            action: 'remove',
          }),
        )
      })
    })
    describe('when changed to visible', () => {
      it('should unhide existing field values', async () => {
        const objectTypeBefore = new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            myField: {
              refType: BuiltinTypes.STRING,
              annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
            },
          },
        })
        const objectTypeAfter = new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            myField: {
              refType: BuiltinTypes.STRING,
            },
          },
        })
        const instance = new InstanceElement('instance', objectTypeAfter, {
          myField: 'myValue',
        })
        const instanceVisible = new InstanceElement('instance', objectTypeBefore)
        const change = toDetailedChangeFromBaseChange(
          toChange({ before: objectTypeBefore.fields.myField, after: objectTypeAfter.fields.myField }),
        )
        const { visible } = await handleHiddenChanges(
          [change],
          mockState([objectTypeAfter, instance]),
          createInMemoryElementSource([objectTypeAfter, instanceVisible]),
        )
        expect(visible).toContainEqual(
          expect.objectContaining({
            id: instance.elemID.createNestedID('myField'),
            action: 'add',
          }),
        )
      })
    })
  })

  describe('hidden_string in instance annotations', () => {
    let instance: InstanceElement
    let instanceType: ObjectType
    beforeEach(() => {
      instanceType = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          val: { refType: BuiltinTypes.STRING },
        },
      })
      instance = new InstanceElement('instance', instanceType, { val: 'asd' }, undefined, {
        [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl',
      })
    })

    describe('when adding the whole instance', () => {
      let result: { visible: DetailedChange[]; hidden: DetailedChange[] }
      let visibleInstance: InstanceElement
      let hiddenInstance: InstanceElement
      beforeEach(async () => {
        const change = toDetailedChangeFromBaseChange(toChange({ after: instance }))

        result = await handleHiddenChanges([change], mockState(), createInMemoryElementSource())
        expect(result.visible).toHaveLength(1)
        expect(result.hidden).toHaveLength(1)
        visibleInstance = getChangeData(result.visible[0])
        hiddenInstance = getChangeData(result.hidden[0])
      })
      it('should omit the hidden annotation from visible and add it to hidden', () => {
        expect(visibleInstance.annotations).not.toHaveProperty(INSTANCE_ANNOTATIONS.SERVICE_URL)
        expect(hiddenInstance.annotations).toHaveProperty(INSTANCE_ANNOTATIONS.SERVICE_URL)
      })
      it('should keep non hidden values in visible and omit them from hidden', () => {
        expect(visibleInstance.value).toHaveProperty('val', 'asd')
        expect(hiddenInstance.value).not.toHaveProperty('val', 'asd')
      })
    })

    describe('when adding only the hidden annotation', () => {
      let result: { visible: DetailedChange[]; hidden: DetailedChange[] }
      beforeAll(async () => {
        const change: DetailedChangeWithBaseChange = {
          id: instance.elemID.createNestedID(INSTANCE_ANNOTATIONS.SERVICE_URL),
          action: 'add',
          data: { after: instance.annotations[INSTANCE_ANNOTATIONS.SERVICE_URL] },
          baseChange: toChange({ before: instance, after: instance }),
        }

        result = await handleHiddenChanges([change], mockState([instanceType, instance]), createInMemoryElementSource())
      })
      it('should not have a visible change', () => {
        expect(result.visible).toHaveLength(0)
      })
      it('should have a hidden change', () => {
        expect(result.hidden).toHaveLength(1)
        expect(_.get(result.hidden[0].data, 'after')).toEqual('someUrl')
      })
    })

    describe('when converting a remove change', () => {
      const obj = new ObjectType({
        elemID: new ElemID('salto', 'obj'),
      })
      const inst = new InstanceElement('hidden', obj, {}, [], {
        [INSTANCE_ANNOTATIONS.HIDDEN]: true,
      })
      const change = toDetailedChangeFromBaseChange(toChange({ before: inst }))
      it('should return the entire change and both hidden and visible', async () => {
        const res = await handleHiddenChanges(
          [change],
          mockState([instanceType, instance]),
          createInMemoryElementSource(),
        )
        expect(res.visible).toHaveLength(1)
        expect(res.hidden).toHaveLength(1)
        expect(res.hidden[0].id).toEqual(change.id)
        expect(res.visible[0].id).toEqual(change.id)
      })
    })
  })

  describe('hidden annotation of field', () => {
    let result: { visible: DetailedChange[]; hidden: DetailedChange[] }
    beforeAll(async () => {
      const object = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          field: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.SERVICE_URL]: 'someUrl' },
          },
        },
      })
      const change: DetailedChangeWithBaseChange = {
        id: object.fields.field.elemID.createNestedID(CORE_ANNOTATIONS.SERVICE_URL),
        action: 'add',
        data: { after: 'someUrl' },
        baseChange: toChange({ before: object.fields.field, after: object.fields.field }),
      }
      result = await handleHiddenChanges([change], mockState([object]), createInMemoryElementSource())
    })

    it('should not have a visible change', () => {
      expect(result.visible).toHaveLength(0)
    })
    it('should have a hidden change', () => {
      expect(result.hidden).toHaveLength(1)
      expect(_.get(result.hidden[0].data, 'after')).toEqual('someUrl')
    })
  })

  describe('reference expression', () => {
    let instance: InstanceElement
    beforeEach(() => {
      const refTargetType = new ObjectType({ elemID: new ElemID('test', 'refTarget') })
      instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID('test', 'type'),
          fields: {
            val: { refType: refTargetType },
            ref: { refType: refTargetType },
          },
        }),
        { val: 'asd' },
      )
    })

    describe('when adding a reference expression', () => {
      let result: { visible: DetailedChange[]; hidden: DetailedChange[] }
      let filteredValue: unknown
      beforeEach(async () => {
        const change: DetailedChangeWithBaseChange = {
          id: instance.elemID.createNestedID('ref'),
          action: 'add',
          data: {
            after: new ReferenceExpression(new ElemID('a', 'b')),
          },
          baseChange: toChange({ before: instance, after: instance }),
        }

        result = await handleHiddenChanges([change], mockState([instance]), createInMemoryElementSource())
        expect(result.visible).toHaveLength(1)
        expect(result.hidden).toHaveLength(0)
        filteredValue = getChangeData(result.visible[0])
      })
      it('should keep the reference expression as-is', () => {
        expect(filteredValue).toBeInstanceOf(ReferenceExpression)
      })
    })
    describe('when converting a value to a reference expression', () => {
      let result: { visible: DetailedChange[]; hidden: DetailedChange[] }
      let filteredValue: unknown
      beforeEach(async () => {
        const change: DetailedChangeWithBaseChange = {
          id: instance.elemID.createNestedID('val'),
          action: 'modify',
          data: {
            before: 'asd',
            after: new ReferenceExpression(new ElemID('a', 'b')),
          },
          baseChange: toChange({ before: instance, after: instance }),
        }

        result = await handleHiddenChanges([change], mockState([instance]), createInMemoryElementSource())
        expect(result.visible).toHaveLength(1)
        expect(result.hidden).toHaveLength(0)
        filteredValue = getChangeData(result.visible[0])
      })
      it('should keep the updated value as a reference expression', () => {
        expect(filteredValue).toBeInstanceOf(ReferenceExpression)
      })
    })
  })

  describe('undefined values', () => {
    const workspaceInstance = new InstanceElement(
      'instance',
      new ObjectType({
        elemID: new ElemID('test', 'type'),
      }),
      {
        [CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]: [{ reference: 'aaa', occurrences: undefined }],
        emptyList: [],
        undefinedValue: undefined,
      },
    )

    const change = toDetailedChangeFromBaseChange(toChange({ after: workspaceInstance }))

    it('should not hide anything if there is no hidden part, even if nested values are undefined', async () => {
      const result = await handleHiddenChanges([change], mockState([]), createInMemoryElementSource())
      expect(result.visible.length).toBe(1)
      expect(result.hidden.length).toBe(0)
    })
  })

  it('should not remove empty values', async () => {
    const valType = new ObjectType({
      elemID: new ElemID('adapter', 'valType'),
      fields: {
        list: { refType: new ListType(BuiltinTypes.STRING) },
        obj: { refType: new MapType(BuiltinTypes.STRING) },
      },
    })
    const type = new ObjectType({
      elemID: new ElemID('adapter', 'type'),
      fields: {
        val: { refType: valType },
      },
    })
    const instance = new InstanceElement('instance', type, {
      val: {
        list: [],
        obj: {},
      },
    })

    const change: DetailedChangeWithBaseChange = {
      id: instance.elemID.createNestedID('val'),
      action: 'add',
      data: { after: instance.value.val },
      baseChange: toChange({ before: instance, after: instance }),
    }
    const result = await handleHiddenChanges([change], mockState([instance]), createInMemoryElementSource([]))
    expect(result.visible).toEqual([change])
    expect(result.hidden.length).toBe(0)
  })

  describe('with nested visible change', () => {
    const type = new ObjectType({
      elemID: new ElemID('test', 'type'),
      fields: {
        val: {
          refType: new ObjectType({
            elemID: new ElemID('test', 'type'),
            fields: { inner: { refType: BuiltinTypes.STRING } },
          }),
        },
      },
    })

    const stateInstance = new InstanceElement('instance', type, {})

    const change: DetailedChangeWithBaseChange = {
      id: stateInstance.elemID.createNestedID('val'),
      action: 'add',
      data: {
        after: { inner: 'abc' },
      },
      baseChange: toChange({ before: stateInstance, after: stateInstance }),
    }

    it('should not have a hidden change', async () => {
      const result = await handleHiddenChanges([change], mockState([stateInstance]), createInMemoryElementSource())
      expect(result.visible.length).toBe(1)
      expect(result.hidden.length).toBe(0)
    })
  })

  describe('map with hidden values', () => {
    const innerType = new ObjectType({
      elemID: new ElemID('test', 'inner'),
      fields: {
        hidden: {
          refType: BuiltinTypes.STRING,
          annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
        },
        visible: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    const type = new ObjectType({
      elemID: new ElemID('test', 'type'),
      fields: {
        map: { refType: new MapType(innerType) },
      },
    })
    describe('with an addition of map with hidden value', () => {
      const stateInstance = new InstanceElement('instance', type, {})

      const change: DetailedChangeWithBaseChange = {
        id: stateInstance.elemID.createNestedID('map'),
        action: 'add',
        data: {
          after: {
            val: {
              hidden: 'hidden',
              visible: 'visible',
            },
          },
        },
        baseChange: toChange({ before: stateInstance, after: stateInstance }),
      }

      it('should have a hidden change', async () => {
        const result = await handleHiddenChanges(
          [change],
          mockState([type, innerType, stateInstance]),
          createInMemoryElementSource(),
        )
        expect(result.visible.length).toBe(1)
        expect(result.hidden.length).toBe(1)
      })
    })

    describe('with an addition of map item with hidden value', () => {
      const stateInstance = new InstanceElement('instance', type, {
        map: {},
      })

      const change: DetailedChangeWithBaseChange = {
        id: stateInstance.elemID.createNestedID('map', 'val'),
        action: 'add',
        data: {
          after: {
            hidden: 'hidden',
            visible: 'visible',
          },
        },
        baseChange: toChange({ before: stateInstance, after: stateInstance }),
      }

      it('should have a hidden change', async () => {
        const result = await handleHiddenChanges(
          [change],
          mockState([type, innerType, stateInstance]),
          createInMemoryElementSource(),
        )
        expect(result.visible.length).toBe(1)
        expect(result.hidden.length).toBe(1)
      })
    })
  })

  describe("when an instance type's hidden_value value is changed", () => {
    let obj: ObjectType
    let hiddenObj: ObjectType
    let inst: InstanceElement
    let hidden1: InstanceElement
    let hidden2: InstanceElement
    let hidden: InstanceElement
    let state: State
    let visibleSource: RemoteElementSource

    beforeEach(() => {
      obj = new ObjectType({
        elemID: ElemID.fromFullName('salto.obj'),
        path: ['this', 'is', 'path', 'to', 'obj'],
      })
      hiddenObj = new ObjectType({
        elemID: ElemID.fromFullName('salto.hidden'),
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
        path: ['this', 'is', 'path', 'to', 'hiddenObj'],
      })
      inst = new InstanceElement('visible', obj, {}, ['this', 'is', 'path', 'to', 'inst'])
      hidden1 = new InstanceElement('hidden', hiddenObj, { a: 1 }, ['this', 'is', 'path', 'to', 'hidden'])
      hidden2 = new InstanceElement('hidden', hiddenObj, { b: 2 }, ['this', 'is', 'path', 'to', 'hidden2'])
      hidden = new InstanceElement('hidden', hiddenObj, { a: 1, b: 2 })
      state = mockState([obj, hiddenObj, inst, hidden])
      visibleSource = createInMemoryElementSource([obj, hiddenObj, inst])
    })
    describe("when the type's hidden_value values is changed to true", () => {
      let changes: DetailedChange[]

      beforeEach(async () => {
        obj.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
        const toHiddenChange: DetailedChangeWithBaseChange = {
          id: obj.elemID.createNestedID('attr', CORE_ANNOTATIONS.HIDDEN_VALUE),
          action: 'add',
          data: { after: true },
          baseChange: { action: 'modify', data: { before: obj, after: obj } },
        }
        changes = (await handleHiddenChanges([toHiddenChange], state, visibleSource)).visible
      })

      it('should create remove changes for instances with this type', () => {
        const removeChange = changes.find(c => c.id.getFullName() === inst.elemID.getFullName())
        expect(removeChange).toBeDefined()
        expect(isRemovalChange(removeChange as DetailedChange)).toBeTruthy()
      })
    })

    describe("when the type's hidden_value values is changed to false", () => {
      let changes: DetailedChange[]

      beforeEach(async () => {
        delete hiddenObj.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE]
        // This only updates the pathIndex
        await state.updateStateFromChanges({
          changes: [],
          unmergedElements: [obj, hiddenObj, inst, hidden1, hidden2],
        })

        const fromHiddenChange: DetailedChangeWithBaseChange = {
          id: hiddenObj.elemID.createNestedID('attr', CORE_ANNOTATIONS.HIDDEN_VALUE),
          action: 'remove',
          data: { before: true },
          baseChange: { action: 'modify', data: { before: hiddenObj, after: hiddenObj } },
        }
        changes = (await handleHiddenChanges([fromHiddenChange], state, visibleSource)).visible
      })
      it('should create add changes with the instance value from the state', () => {
        const addChanges = changes.filter(
          c => c.id.getFullName() === hidden.elemID.getFullName() && isAdditionChange(c),
        )
        expect(addChanges).toHaveLength(2)
        expect(addChanges.map(c => c.path)).toEqual([
          ['this', 'is', 'path', 'to', 'hidden'],
          ['this', 'is', 'path', 'to', 'hidden2'],
        ])
      })
    })
  })

  describe('field annotation change when the field is not in the state', () => {
    let result: { visible: DetailedChange[]; hidden: DetailedChange[] }
    let change: DetailedChangeWithBaseChange
    beforeAll(async () => {
      const stateObject = new ObjectType({ elemID: new ElemID('test', 'type') })
      const fullObject = new ObjectType({
        elemID: stateObject.elemID,
        fields: {
          field: {
            refType: BuiltinTypes.STRING,
          },
        },
      })
      change = {
        id: fullObject.fields.field.elemID.createNestedID(CORE_ANNOTATIONS.SERVICE_URL),
        action: 'add',
        data: { after: 'someUrl' },
        baseChange: { action: 'modify', data: { before: fullObject.fields.field, after: fullObject.fields.field } },
      }
      result = await handleHiddenChanges([change], mockState([stateObject]), createInMemoryElementSource())
    })

    it('should make the change visible', () => {
      expect(result.visible).toHaveLength(1)
      expect(result.visible[0]).toMatchObject(change)
    })
    it('should not have a hidden change', () => {
      expect(result.hidden).toHaveLength(0)
    })
  })

  describe('when a type is hidden', () => {
    let obj: ObjectType
    let state: State
    let visibleSource: RemoteElementSource

    beforeEach(() => {
      obj = new ObjectType({
        elemID: new ElemID('salto', 'obj'),
        path: ['path', 'to', 'obj'],
      })
      state = mockState([obj])
      visibleSource = createInMemoryElementSource([obj])
    })

    describe("when the change is on the 'hidden' annotation", () => {
      let changes: DetailedChange[]

      beforeEach(async () => {
        const toHiddenChange: DetailedChangeWithBaseChange = {
          id: obj.elemID.createNestedID('attr', CORE_ANNOTATIONS.HIDDEN),
          action: 'add',
          data: { after: true },
          baseChange: { action: 'modify', data: { before: obj, after: obj } },
        }
        changes = (await handleHiddenChanges([toHiddenChange], state, visibleSource)).visible
      })

      it('should create a remove change for the type', () => {
        expect(changes).toHaveLength(1)
        const [change] = changes
        expect(isRemovalChange(change)).toBeTrue()
        expect(change.id.isEqual(obj.elemID)).toBeTrue()
      })
    })

    describe('when the change is on the whole element', () => {
      let changes: DetailedChange[]

      beforeEach(async () => {
        const hiddenObj = obj.clone()
        hiddenObj.annotations[CORE_ANNOTATIONS.HIDDEN] = true
        const toHiddenChange = toDetailedChangeFromBaseChange(
          toChange({
            before: obj,
            after: hiddenObj,
          }),
        )
        changes = (await handleHiddenChanges([toHiddenChange], state, visibleSource)).visible
      })

      it('should create a remove change for the type', () => {
        expect(changes).toHaveLength(1)
        const [change] = changes
        expect(isRemovalChange(change)).toBeTrue()
        expect(change.id.isEqual(obj.elemID)).toBeTrue()
      })
    })
  })

  describe('when a hidden type has a top level modification', () => {
    let obj: ObjectType
    let state: State
    let visibleSource: RemoteElementSource
    let changes: DetailedChange[]

    beforeEach(async () => {
      obj = new ObjectType({
        elemID: new ElemID('salto', 'obj'),
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN]: true,
        },
        path: ['path', 'to', 'obj'],
      })
      state = mockState([obj])
      visibleSource = createInMemoryElementSource([])

      const objWithMeta = obj.clone()
      objWithMeta.metaType = new TypeReference(new ElemID('salto', 'meta'))
      const addMetaChange = toDetailedChangeFromBaseChange(
        toChange({
          before: obj,
          after: objWithMeta,
        }),
      )
      changes = (await handleHiddenChanges([addMetaChange], state, visibleSource)).visible
    })

    it('should have no visible changes', () => {
      expect(changes).toBeEmpty()
    })
  })
})

describe('getElemHiddenParts', () => {
  describe('ObjectType attribute handling', () => {
    let elementsSource: ReadOnlyElementsSource
    let testElement: ObjectType
    let annotationType: ObjectType

    beforeEach(() => {
      annotationType = new ObjectType({
        elemID: new ElemID('test', 'annotationType'),
      })
      testElement = new ObjectType({
        elemID: new ElemID('test', 'type'),
        annotations: {
          value1: 'test',
          value2: 'test',
        },
        annotationRefsOrTypes: {
          value1: annotationType,
          value2: BuiltinTypes.STRING,
        },
      })
      elementsSource = buildElementsSourceFromElements([annotationType, testElement])
    })

    it('should not hide annotation value of type that is _hidden', async () => {
      annotationType.annotations[CORE_ANNOTATIONS.HIDDEN] = true
      const result = await getElementHiddenParts(testElement, elementsSource)
      expect(result).toBeUndefined()
    })

    it('should hide annotation value of type that is _hidden_value', async () => {
      annotationType.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
      const result = (await getElementHiddenParts(testElement, elementsSource)) as ObjectType
      expect(result).toBeDefined()
      expect(result.annotations).toEqual({ value1: 'test' })
    })
  })

  describe('Object Type Fields Handling', () => {
    let elementsSource: ReadOnlyElementsSource
    let testElement: ObjectType

    beforeEach(() => {
      const fieldWithPartiallyHiddenAnnotations = new ObjectType({
        elemID: new ElemID('test', 'fieldWithPartiallyHiddenAnnotations'),
        annotationRefsOrTypes: {
          stringValue: BuiltinTypes.STRING,
          hiddenStringValue: BuiltinTypes.HIDDEN_STRING,
        },
      })
      const hiddenFieldWithNoHiddenAnnotations = new ObjectType({
        elemID: new ElemID('test', 'hiddenFieldWithNoHiddenAnnotations'),
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN]: true,
        },
        annotationRefsOrTypes: {
          stringValue: BuiltinTypes.STRING,
          booleanValue: BuiltinTypes.BOOLEAN,
        },
      })
      const hiddenValueFieldWithNoHiddenAnnotations = new ObjectType({
        elemID: new ElemID('test', 'hiddenValueFieldWithNoHiddenAnnotations'),
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
        annotationRefsOrTypes: {
          stringValue: BuiltinTypes.STRING,
          booleanValue: BuiltinTypes.BOOLEAN,
        },
      })

      testElement = new ObjectType({
        elemID: new ElemID('test', 'type'),
        fields: {
          fieldWithPartiallyHiddenAnnotations: {
            refType: fieldWithPartiallyHiddenAnnotations,
            annotations: {
              stringValue: 'test',
              hiddenStringValue: 'testHidden',
            },
          },
          hiddenFieldWithNoHiddenAnnotations: {
            refType: hiddenFieldWithNoHiddenAnnotations,
            annotations: {
              stringValue: 'test',
              booleanValue: true,
            },
          },
          hiddenValueFieldWithNoHiddenAnnotations: {
            refType: hiddenValueFieldWithNoHiddenAnnotations,
            annotations: {
              stringValue: 'test',
              booleanValue: true,
            },
          },
        },
      })
      elementsSource = buildElementsSourceFromElements([
        testElement,
        hiddenFieldWithNoHiddenAnnotations,
        hiddenFieldWithNoHiddenAnnotations,
        hiddenValueFieldWithNoHiddenAnnotations,
      ])
    })

    it('should return ObjectType with all of the hiddenValueFieldWithNoHiddenAnnotations and the specific annotations from fieldWithPartiallyHiddenAnnotations', async () => {
      const result = (await getElementHiddenParts(testElement, elementsSource)) as ObjectType
      expect(result).toBeDefined()
      const { fields } = result
      const {
        fieldWithPartiallyHiddenAnnotations,
        hiddenFieldWithNoHiddenAnnotations,
        hiddenValueFieldWithNoHiddenAnnotations,
      } = fields
      expect(fieldWithPartiallyHiddenAnnotations).toBeDefined()
      expect(hiddenFieldWithNoHiddenAnnotations).toBeDefined()
      expect(hiddenValueFieldWithNoHiddenAnnotations).toBeDefined()
      expect(fieldWithPartiallyHiddenAnnotations.annotations).toEqual({ hiddenStringValue: 'testHidden' })
      expect(hiddenFieldWithNoHiddenAnnotations.annotations).toEqual({})
      expect(hiddenValueFieldWithNoHiddenAnnotations.annotations).toEqual({})
    })
  })
})
