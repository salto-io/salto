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
import { EventEmitter } from 'pietile-eventemitter'
import {
  ElemID, Field, BuiltinTypes, ObjectType, getChangeElement, AdapterOperations, Element,
  PrimitiveType, PrimitiveTypes, ADAPTER, OBJECT_SERVICE_ID, InstanceElement, CORE_ANNOTATIONS,
  isModificationDiff, ListType, FieldDefinition, FIELD_NAME, INSTANCE_NAME, OBJECT_NAME,
} from '@salto-io/adapter-api'
import * as utils from '@salto-io/adapter-utils'
import {
  fetchChanges, FetchChange, generateServiceIdToStateElemId,
  FetchChangesResult, FetchProgressEvents,
} from '../../src/core/fetch'
import { getPlan, Plan } from '../../src/core/plan'
import { mockFunction } from '../common/helpers'

jest.mock('pietile-eventemitter')
jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual('@salto-io/adapter-utils'),
  applyInstancesDefaults: jest.fn(),
}))

describe('fetch', () => {
  const testID = new ElemID('dummy', 'elem')
  const typeWithField = new ObjectType({
    elemID: testID,
    fields: { test: { type: BuiltinTypes.STRING, annotations: { annotation: 'value' } } },
  })
  const typeWithFieldChange = typeWithField.clone()
  typeWithFieldChange.fields.test.annotations.annotation = 'changed'
  const typeWithFieldConflict = typeWithField.clone()
  typeWithFieldConflict.fields.test.annotations.annotation = 'conflict'
  const newTypeID = new ElemID('dummy', 'new')
  const newTypeBase = new ObjectType({
    elemID: newTypeID,
    fields: { base: { type: BuiltinTypes.STRING } },
    path: ['path', 'base'],
  })

  const anotherTypeID = new ElemID('dummy', 'hiddenType')
  const typeWithHiddenField = new ObjectType({
    elemID: anotherTypeID,
    fields: {
      reg: { type: BuiltinTypes.STRING },
      notHidden: {
        type: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: false },
      },
      hidden: {
        type: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
    },
    path: ['records', 'hidden'],
  })

  const hiddenInstance = new InstanceElement('instance_elem_id_name', typeWithHiddenField, {
    reg: 'reg',
    notHidden: 'notHidden',
    hidden: 'Hidden',
  })

  // // Workspace elements should not contains hidden values
  // const workspaceInstance = hiddenValues.removeHiddenFieldsValues(hiddenInstance)

  const newTypeBaseModified = new ObjectType({
    elemID: newTypeID,
    fields: { base: { type: new ListType(BuiltinTypes.STRING) } },
    path: ['path', 'base'],
  })
  const newTypeExt = new ObjectType({
    elemID: newTypeID,
    fields: { ext: { type: BuiltinTypes.STRING } },
    path: ['path', 'ext'],
  })
  const newTypeMerged = new ObjectType({
    elemID: newTypeID,
    fields: {
      base: { type: BuiltinTypes.STRING },
      ext: { type: BuiltinTypes.STRING },
    },
  })

  describe('fetchChanges', () => {
    const mockAdapters = {
      dummy: {
        fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
        deploy: mockFunction<AdapterOperations['deploy']>(),
      },
    }
    let changes: FetchChange[]
    describe('when the adapter returns elements with merge errors', () => {
      beforeEach(() => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          { elements: [newTypeBase, newTypeBaseModified, typeWithField] },
        )
      })
      it('should fail', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters,
          [],
          [],
          [],
        )
        expect(fetchChangesResult.mergeErrors).toHaveLength(1)
      })
    })
    describe('config changes', () => {
      const configElemID = new ElemID('dummy')
      const configType = new ObjectType({
        elemID: configElemID,
        fields: { test: { type: new ListType(BuiltinTypes.STRING) } },
      })
      const configInstance = new InstanceElement('ins', configType, { test: ['SkipMe'] })
      const currentInstanceConfig = new InstanceElement('ins', configType, { test: [] })

      const verifyPlan = (plan: Plan, expectedPlan: Plan, expectedPlanLength: number): void => {
        const configChanges = [...plan.itemsByEvalOrder()]
        const expectedConfigChanges = [...expectedPlan.itemsByEvalOrder()]
        expect(configChanges).toHaveLength(expectedPlanLength)
        expect(configChanges.map(change => [...change.items.values()]))
          .toEqual(expectedConfigChanges.map(change => [...change.items.values()]))
      }

      beforeEach(() => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          { elements: [], updatedConfig: { config: configInstance, message: 'test' } }
        )
      })
      it('should return config change plan when there is no current config', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters, [], [], [],
        )
        verifyPlan(
          fetchChangesResult.configChanges,
          await getPlan({ before: [], after: [configInstance] }),
          1,
        )
      })

      it('should return config change plan when there is current config', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters,
          [],
          [],
          [currentInstanceConfig],
        )
        verifyPlan(
          fetchChangesResult.configChanges,
          await getPlan({ before: [currentInstanceConfig], after: [configInstance] }),
          1
        )
      })

      it('should return empty plan when there is no change', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters, [], [], [configInstance],
        )
        expect([...fetchChangesResult.configChanges.itemsByEvalOrder()]).toHaveLength(0)
      })
    })
    describe('when merge elements returns errors', () => {
      const dupTypeID = new ElemID('dummy', 'dup')
      const dupTypeBase = new ObjectType({
        elemID: dupTypeID,
        fields: {},
        annotations: { bla: 'bla' },
      })
      const dupTypeBase2 = new ObjectType({
        elemID: dupTypeID,
        fields: {},
        annotations: { bla: 'blu' },
      })
      describe('when state', () => {
        describe('contains elements with errored elem ids', () => {
          it('should throw an exception', async () => {
            try {
              mockAdapters.dummy.fetch.mockResolvedValueOnce(
                Promise.resolve({ elements: [dupTypeBase, dupTypeBase2] })
              )
              await fetchChanges(mockAdapters, [], [dupTypeBase], [])
              expect(false).toBeTruthy()
            } catch (e) {
              expect(e.message).toMatch(/.*duplicate annotation.*/)
              expect(e.message).toMatch(/.*bla.*/)
            }
          })
        })
      })
      describe('when instance type has merge error', () => {
        let fetchChangesResult: FetchChangesResult
        beforeEach(async () => {
          const instance = new InstanceElement('instance_elem_id_name', dupTypeBase, { fname: 'fvalue' })
          const instance2 = new InstanceElement('instance_elem_id_name2', typeWithField, { fname: 'fvalue2' })
          mockAdapters.dummy.fetch.mockResolvedValueOnce(
            Promise.resolve(
              { elements: [instance, instance2, dupTypeBase, dupTypeBase2, typeWithField] }
            )
          )
          fetchChangesResult = await fetchChanges(mockAdapters, [], [], [])
        })
        it('should return errors', async () => {
          expect(fetchChangesResult.mergeErrors).toHaveLength(1)
        })
        it('should drop instance elements', () => {
          expect(fetchChangesResult.elements).toHaveLength(2)
          expect(fetchChangesResult.elements.map(e => e.elemID.getFullName())).not.toContain(['dummy.elem.instance.instance_elem_id_name'])
          expect(fetchChangesResult.elements.map(e => e.elemID.getFullName())).toContain('dummy.elem.instance.instance_elem_id_name2')
        })
      })
    })
    describe('when there are no changes', () => {
      let elements: Element[]
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [newTypeBase, newTypeExt, hiddenInstance] }),
        )

        const result = await fetchChanges(
          mockAdapters,
          [newTypeMerged, hiddenInstance],
          [newTypeMerged, hiddenInstance],
          [],
        )
        elements = result.elements
        changes = [...result.changes]
      })

      it('should return merged elements', () => {
        expect(elements).toHaveLength(2)
      })
      it('should not return changes', () => {
        expect(changes).toHaveLength(0)
      })
    })

    describe('when the change is only in the service', () => {
      const hiddenChangedVal = 'hiddenChanged'

      beforeEach(async () => {
        // the (changed) service instance
        const hiddenInstanceFromService = hiddenInstance.clone()
        hiddenInstanceFromService.value.hidden = hiddenChangedVal
        hiddenInstanceFromService.value.notHidden = 'notHiddenChanged'

        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [typeWithFieldChange, hiddenInstanceFromService] })
        )

        const result = await fetchChanges(
          mockAdapters,
          [typeWithField, hiddenInstance],
          [typeWithField, hiddenInstance],
          [],
        )
        changes = [...result.changes]
      })

      it('should return the change with no conflict', () => {
        expect(changes).toHaveLength(3)
        changes.forEach(c => expect(c.pendingChange).toBeUndefined())
      })

      it('shouldn not remove hidden values from changes', () => {
        changes.forEach(c => expect(isModificationDiff(c.change)).toEqual(true))
        expect(changes.some(c => (getChangeElement(c.change)) === hiddenChangedVal))
          .toBeTruthy()
      })
    })
    describe('when a progressEmitter is provided', () => {
      let progressEmitter: EventEmitter<FetchProgressEvents>
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [newTypeBase, newTypeExt] })
        )
        progressEmitter = new EventEmitter<FetchProgressEvents>()
        const result = await fetchChanges(
          mockAdapters,
          [],
          [],
          [],
          progressEmitter
        )
        changes = [...result.changes]
      })

      it('should call emit on changesWillBeFetched & diffWillBeCalculcated', () => {
        expect(progressEmitter.emit).toHaveBeenCalledTimes(2)
        expect(progressEmitter.emit).toHaveBeenCalledWith('changesWillBeFetched', expect.anything(), expect.anything())
        expect(progressEmitter.emit).toHaveBeenCalledWith('diffWillBeCalculated', expect.anything())
      })
    })
    describe('when the adapter returns elements that should be split', () => {
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [newTypeBase, newTypeExt] })
        )
        const result = await fetchChanges(
          mockAdapters,
          [],
          [],
          [],
        )
        changes = [...result.changes]
      })
      it('should return separate changes according to the input elements', () => {
        expect(changes).toHaveLength(2)
      })
      it('should have path hint for new elements', () => {
        expect(changes.map(change => getChangeElement(change.change).path).sort()).toEqual([
          ['path', 'base'],
          ['path', 'ext'],
        ])
      })
      describe('when adapter returns splitted elements with added nested elements', () => {
        describe('when nested elements are fields', () => {
          beforeEach(async () => {
            const newTypeBaseWPath = newTypeBase.clone()
            newTypeBaseWPath.path = ['a', 'b']
            const newTypeExtWPath = newTypeExt.clone()
            newTypeExtWPath.path = ['c', 'd']
            mockAdapters.dummy.fetch.mockResolvedValueOnce(
              Promise.resolve({ elements: [
                newTypeBaseWPath,
                newTypeExtWPath] })
            )
            const result = await fetchChanges(
              mockAdapters,
              [newTypeBaseWPath],
              [newTypeBaseWPath],
              [],
            )
            changes = [...result.changes]
          })


          it('should create one field change', () => {
            expect(changes.length).toEqual(1)
          })
          it('should populate the change with the containing parent path', () => {
            expect(changes[0].change.id.getFullName()).toBe('dummy.new.field.ext')
            expect(changes[0].change.path).toEqual(['c', 'd'])
          })
        })
        describe('when nested elements are annotations', () => {
          beforeEach(async () => {
            const newTypeA = new ObjectType({
              elemID: newTypeID,
              path: ['a', 'b'],
            })

            const newTypeB = new ObjectType({
              elemID: newTypeID,
              annotations: { baba: 'bob' },
              path: ['c', 'd'],
            })

            mockAdapters.dummy.fetch.mockResolvedValueOnce(
              Promise.resolve({ elements: [
                newTypeA,
                newTypeB] })
            )
            const result = await fetchChanges(
              mockAdapters,
              [newTypeA],
              [newTypeA],
              [],
            )
            changes = [...result.changes]
          })


          it('should create one field change', () => {
            expect(changes.length).toEqual(1)
          })
          it('should populate the change with the containing parent path', () => {
            expect(changes[0].change.id.getFullName()).toBe('dummy.new.attr.baba')
            expect(changes[0].change.path).toEqual(['c', 'd'])
          })
        })
      })
      describe('when the working copy is already the same as the service', () => {
        beforeEach(async () => {
          mockAdapters.dummy.fetch.mockResolvedValueOnce(
            Promise.resolve({ elements: [typeWithFieldChange] })
          )
          const result = await fetchChanges(
            mockAdapters,
            [typeWithFieldChange],
            [typeWithField],
            [],
          )
          changes = [...result.changes]
        })
        it('should not return any change', () => {
          expect(changes).toHaveLength(0)
        })
      })

      describe('when the working copy has a conflicting change', () => {
        beforeEach(async () => {
          mockAdapters.dummy.fetch.mockResolvedValueOnce(
            Promise.resolve({ elements: [typeWithFieldChange] })
          )
          const result = await fetchChanges(
            mockAdapters,
            [typeWithFieldConflict],
            [typeWithField],
            [],
          )
          changes = [...result.changes]
        })
        it('should return the change with the conflict', () => {
          expect(changes).toHaveLength(1)
          expect(changes[0].pendingChange).toBeDefined()
        })
      })
      describe('when the changed element is removed in the working copy', () => {
        beforeEach(async () => {
          mockAdapters.dummy.fetch.mockResolvedValueOnce(
            Promise.resolve({ elements: [typeWithFieldChange] })
          )
          const result = await fetchChanges(
            mockAdapters,
            [],
            [typeWithField],
            [],
          )
          changes = [...result.changes]
        })
        it('should return only one change', () => {
          expect(changes).toHaveLength(1)
        })
        describe('returned change', () => {
          let change: FetchChange
          beforeEach(() => {
            [change] = changes
          })
          it('should contain the service change', () => {
            expect(change.serviceChange.action).toEqual('modify')
          })
          it('should contain the local change', () => {
            expect(change.pendingChange).toBeDefined()
            if (change.pendingChange) { // If only here to help typescript compiler
              expect(change.pendingChange.action).toEqual('remove')
            }
          })
          it('should have the change that syncs the working copy to the service', () => {
            expect(change.change.action).toEqual('add')
          })
        })
      })
    })

    describe('generateServiceIdToStateElemId', () => {
      const SERVICE_ID_ANNOTATION = 'service_id_annotation_type_name'
      const SERVICE_ID_FIELD_NAME = 'service_id_field_name'
      const REGULAR_FIELD_NAME = 'regular_field_name'

      const typeElemID = new ElemID('adapter', 'elem_id_name')
      const serviceIdField = { name: SERVICE_ID_FIELD_NAME, type: BuiltinTypes.SERVICE_ID }
      const origRegularFieldType = new PrimitiveType({
        elemID: new ElemID('adapter', 'regular'),
        primitive: PrimitiveTypes.STRING,
        annotationTypes: {
          [SERVICE_ID_ANNOTATION]: BuiltinTypes.SERVICE_ID,
        },
      })
      const origObj = new ObjectType({
        elemID: typeElemID,
        annotationTypes: {
          [SERVICE_ID_ANNOTATION]: BuiltinTypes.SERVICE_ID,
        },
        annotations: {
          [SERVICE_ID_ANNOTATION]: 'ObjectServiceId',
        },
      })

      type FieldDefinitionWithName = FieldDefinition & { name: string }
      const addField = (obj: ObjectType, field: FieldDefinitionWithName): Field => {
        const newField = new Field(obj, field.name, field.type, field.annotations)
        obj.fields[field.name] = newField
        return newField
      }
      let obj: ObjectType
      let regularFieldDef: Required<FieldDefinitionWithName>
      let regularFieldType: PrimitiveType
      let instance: InstanceElement
      beforeEach(() => {
        obj = origObj.clone()
        regularFieldType = origRegularFieldType.clone()
        regularFieldDef = { name: REGULAR_FIELD_NAME, type: regularFieldType, annotations: { [SERVICE_ID_ANNOTATION]: 'FieldServiceId' } }
        instance = new InstanceElement('instance_elem_id_name', obj, { [SERVICE_ID_FIELD_NAME]: 'serviceIdValue' })
      })

      it('should generate for ObjectType and its fields', () => {
        const regularField = addField(obj, regularFieldDef)

        const serviceIdToStateElemId = generateServiceIdToStateElemId([obj])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(2)
        const objectServiceId = Object.entries(serviceIdToStateElemId)[1][0]
        expect(objectServiceId)
          .toEqual(`${ADAPTER},${obj.elemID.adapter},${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`)
        expect(Object.entries(serviceIdToStateElemId)[1][1]).toEqual(obj.elemID)

        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${regularField.elemID.adapter},${OBJECT_SERVICE_ID},${objectServiceId},${SERVICE_ID_ANNOTATION},${regularField.annotations[SERVICE_ID_ANNOTATION]}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(regularField.elemID)
      })
      it('should generate for ObjectType and its fields with no SERVICE_ID annotations', () => {
        delete obj.annotations[SERVICE_ID_ANNOTATION]
        delete regularFieldDef.annotations[SERVICE_ID_ANNOTATION]
        const regularField = addField(obj, regularFieldDef)

        const serviceIdToStateElemId = generateServiceIdToStateElemId([obj])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(2)
        const objectServiceId = Object.entries(serviceIdToStateElemId)[1][0]
        expect(objectServiceId)
          .toEqual(`${ADAPTER},${obj.elemID.adapter},${SERVICE_ID_ANNOTATION},${obj.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[1][1]).toEqual(obj.elemID)

        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${regularField.elemID.adapter},${OBJECT_SERVICE_ID},${objectServiceId},${SERVICE_ID_ANNOTATION},${regularField.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(regularField.elemID)
      })
      it('should generate for ObjectType and its fields with no SERVICE_ID annotations & annotationType', () => {
        delete obj.annotations[SERVICE_ID_ANNOTATION]
        delete obj.annotationTypes[SERVICE_ID_ANNOTATION]
        delete regularFieldDef.annotations[SERVICE_ID_ANNOTATION]
        delete regularFieldType.annotationTypes[SERVICE_ID_ANNOTATION]
        const regularField = addField(obj, regularFieldDef)

        const serviceIdToStateElemId = generateServiceIdToStateElemId([obj])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(2)
        const objectServiceId = Object.entries(serviceIdToStateElemId)[1][0]
        expect(objectServiceId)
          .toEqual(`${ADAPTER},${obj.elemID.adapter},${OBJECT_NAME},${obj.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[1][1]).toEqual(obj.elemID)

        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${regularField.elemID.adapter},${FIELD_NAME},${regularField.elemID.getFullName()},${OBJECT_SERVICE_ID},${objectServiceId}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(regularField.elemID)
      })
      it('should generate for InstanceElement with no SERVICE_ID value', () => {
        addField(obj, serviceIdField)
        delete instance.value[SERVICE_ID_FIELD_NAME]

        const serviceIdToStateElemId = generateServiceIdToStateElemId([instance])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(1)
        const expectedObjectServiceId = `${ADAPTER},${obj.elemID.adapter},${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`
        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${instance.elemID.adapter},${OBJECT_SERVICE_ID},${expectedObjectServiceId},${SERVICE_ID_FIELD_NAME},${instance.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(instance.elemID)
      })
      it('should generate for InstanceElement', () => {
        addField(obj, serviceIdField)

        const serviceIdToStateElemId = generateServiceIdToStateElemId([instance])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(1)
        const expectedObjectServiceId = `${ADAPTER},${obj.elemID.adapter},${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`
        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${instance.elemID.adapter},${OBJECT_SERVICE_ID},${expectedObjectServiceId},${SERVICE_ID_FIELD_NAME},${instance.value[SERVICE_ID_FIELD_NAME]}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(instance.elemID)
      })
      it('should generate for InstanceElement with no SERVICE_ID value & field', () => {
        serviceIdField.type = BuiltinTypes.STRING
        addField(obj, serviceIdField)
        delete instance.value[SERVICE_ID_FIELD_NAME]

        const serviceIdToStateElemId = generateServiceIdToStateElemId([instance])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(1)
        const expectedObjectServiceId = `${ADAPTER},${obj.elemID.adapter},${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`
        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${instance.elemID.adapter},${INSTANCE_NAME},${instance.elemID.getFullName()},${OBJECT_SERVICE_ID},${expectedObjectServiceId}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(instance.elemID)
      })
    })

    describe('first fetch', () => {
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [typeWithField, hiddenInstance] })
        )
        const result = await fetchChanges(
          mockAdapters,
          [],
          [],
          [],
        )
        changes = [...result.changes]
      })

      it('should return the changes with no conflict', () => {
        expect(changes).toHaveLength(2)
        changes.forEach(c => expect(c.pendingChange).toBeUndefined())
      })

      it('changes should be equal to the service elements', () => {
        expect(getChangeElement(changes[0].change)).toEqual(typeWithField)
        expect(getChangeElement(changes[1].change)).toEqual(hiddenInstance)
      })
    })

    describe('instance defaults', () => {
      it('should call applyInstancesDefaults', async () => {
        // spyOn where utils is defined https://stackoverflow.com/a/53307822
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [hiddenInstance] })
        )
        await fetchChanges(
          mockAdapters,
          [],
          [],
          [],
        )
        expect(utils.applyInstancesDefaults).toHaveBeenCalledWith([hiddenInstance])
      })
    })
  })
})
