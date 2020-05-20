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
  ElemID, Field, BuiltinTypes, ObjectType, getChangeElement, Adapter, Element,
  PrimitiveType, PrimitiveTypes, ADAPTER, OBJECT_SERVICE_ID, InstanceElement, CORE_ANNOTATIONS,
  isModificationDiff,
  ListType,
} from '@salto-io/adapter-api'
import * as utils from '@salto-io/adapter-utils'
import {
  fetchChanges, FetchChange, generateServiceIdToStateElemId,
  FetchChangesResult, FetchProgressEvents,
} from '../../src/core/fetch'
import * as merger from '../../src/core/merger'
import { getPlan, Plan } from '../../src/core/plan'
import {
  removeHiddenFieldsValues,
} from '../../src/workspace/hidden_values'

const { DuplicateAnnotationError } = merger

jest.mock('pietile-eventemitter')

describe('fetch', () => {
  const mockMergeResult = (mockResult: merger.MergeResult): jest.SpyInstance =>
    jest.spyOn(merger, 'mergeElements').mockImplementation(() => mockResult)
  const testID = new ElemID('dummy', 'elem')
  const testField = new Field(testID, 'test', BuiltinTypes.STRING, { annotation: 'value' })
  const typeWithField = new ObjectType({
    elemID: testID,
    fields: { test: testField },
  })
  const typeWithFieldChange = typeWithField.clone()
  typeWithFieldChange.fields.test.annotations.annotation = 'changed'
  const typeWithFieldConflict = typeWithField.clone()
  typeWithFieldConflict.fields.test.annotations.annotation = 'conflict'
  const newTypeID = new ElemID('dummy', 'new')
  const newTypeBase = new ObjectType({
    elemID: newTypeID,
    fields: { base: new Field(newTypeID, 'base', BuiltinTypes.STRING) },
    path: ['path', 'base'],
  })

  const anotherTypeID = new ElemID('dummy', 'hiddenType')
  const typeWithHiddenField = new ObjectType({
    elemID: anotherTypeID,
    fields: {
      reg: new Field(anotherTypeID, 'reg', BuiltinTypes.STRING),
      notHidden: new Field(
        anotherTypeID,
        'notHidden',
        BuiltinTypes.STRING,
        { [CORE_ANNOTATIONS.HIDDEN]: false }
      ),
      hidden: new Field(
        anotherTypeID,
        'hidden',
        BuiltinTypes.STRING,
        { [CORE_ANNOTATIONS.HIDDEN]: true }
      ),
    },
    path: ['records', 'hidden'],
  })

  const hiddenInstance = new InstanceElement('instance_elem_id_name', typeWithHiddenField, {
    reg: 'reg',
    notHidden: 'notHidden',
    hidden: 'Hidden',
  })

  // Workspace elements should not contains hidden values
  const workspaceInstance = removeHiddenFieldsValues(hiddenInstance)

  const newTypeBaseModified = new ObjectType({
    elemID: newTypeID,
    fields: { base: new Field(newTypeID, 'base', new ListType(BuiltinTypes.STRING), {}) },
    path: ['path', 'base'],
  })
  const newTypeExt = new ObjectType({
    elemID: newTypeID,
    fields: { ext: new Field(newTypeID, 'ext', BuiltinTypes.STRING) },
    path: ['path', 'ext'],
  })
  const newTypeMerged = new ObjectType({
    elemID: newTypeID,
    fields: {
      base: new Field(newTypeID, 'base', BuiltinTypes.STRING),
      ext: new Field(newTypeID, 'ext', BuiltinTypes.STRING),
    },
  })

  beforeEach(() => jest.spyOn(merger, 'mergeElements').mockRestore())

  describe('fetchChanges', () => {
    const mockAdapters = {
      dummy: {
        fetch: jest.fn().mockResolvedValue(Promise.resolve([])),
      },
    }
    let changes: FetchChange[]
    describe('when the adapter returns elements with merge errors', () => {
      beforeEach(() => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [newTypeBase, newTypeBaseModified, typeWithField] }),
        )
      })
      it('should fail', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
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
        fields: {
          test: new Field(configElemID, 'test', new ListType(BuiltinTypes.STRING)),
        },
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
          mockAdapters as unknown as Record<string, Adapter>, [], [], [],
        )
        verifyPlan(fetchChangesResult.configChanges, await getPlan([], [configInstance]), 1)
      })

      it('should return config change plan when there is current config', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>, [], [], [currentInstanceConfig],
        )
        verifyPlan(
          fetchChangesResult.configChanges,
          await getPlan([currentInstanceConfig], [configInstance]),
          1
        )
      })

      it('should return empty plan when there is no change', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>, [], [], [configInstance],
        )
        expect([...fetchChangesResult.configChanges.itemsByEvalOrder()]).toHaveLength(0)
      })
    })
    describe('when merge elements returns errors', () => {
      describe('when state', () => {
        describe('contains elements with errored elem ids', () => {
          it('should throw an exception', async () => {
            mockMergeResult({
              merged: [newTypeBase],
              errors: [
                new DuplicateAnnotationError({ elemID: newTypeBase.elemID, key: 'bla' }),
              ],
            })

            try {
              await fetchChanges({}, [], [newTypeBase], [])
              expect(false).toBeTruthy()
            } catch (e) {
              expect(e.message).toMatch(/.*duplicate annotation.*/)
              expect(e.message).toMatch(/.*bla.*/)
            }
          })
        })
        describe('contains no element elements with errors ', () => {
          let fetchChangesResult: FetchChangesResult
          beforeEach(async () => {
            mockMergeResult({
              merged: [newTypeBase, typeWithField],
              errors: [
                new DuplicateAnnotationError({ elemID: newTypeBase.elemID, key: 'blu' }),
              ],
            })

            fetchChangesResult = await fetchChanges({}, [], [], [])
          })
          it('should return errors', async () => {
            expect(fetchChangesResult.mergeErrors).toHaveLength(1)
          })
          it('should drop elements', async () => {
            expect(fetchChangesResult.elements).toHaveLength(1)
          })
        })
      })
      describe('when instance parent type elements have merge errors', () => {
        let fetchChangesResult: FetchChangesResult
        beforeEach(async () => {
          const instance = new InstanceElement('instance_elem_id_name', newTypeBase, { fname: 'fvalue' })
          const instance2 = new InstanceElement('instance_elem_id_name2', typeWithField, { fname: 'fvalue2' })

          mockMergeResult({
            merged: [newTypeBase, typeWithField, instance, instance2],
            errors: [
              new DuplicateAnnotationError({ elemID: newTypeBase.elemID, key: 'bla' }),
            ],
          })
          fetchChangesResult = await fetchChanges({}, [], [], [])
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
          mockAdapters as unknown as Record<string, Adapter>,
          [newTypeMerged, workspaceInstance],
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
          mockAdapters as unknown as Record<string, Adapter>,
          [typeWithField, workspaceInstance],
          [typeWithField, hiddenInstance],
          [],
        )
        changes = [...result.changes]
      })

      it('should return the change with no conflict', () => {
        expect(changes).toHaveLength(2)
        changes.forEach(c => expect(c.pendingChange).toBeUndefined())
      })

      it('shouldn remove hidden values from changes', () => {
        changes.forEach(c => expect(isModificationDiff(c.change)).toEqual(true))
        changes.forEach(c => expect(getChangeElement(c.change)).not.toEqual(hiddenChangedVal))
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
          mockAdapters as unknown as Record<string, Adapter>,
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
          mockAdapters as unknown as Record<string, Adapter>,
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
              mockAdapters as unknown as Record<string, Adapter>,
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
              mockAdapters as unknown as Record<string, Adapter>,
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
            mockAdapters as unknown as Record<string, Adapter>,
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
            mockAdapters as unknown as Record<string, Adapter>,
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
            mockAdapters as unknown as Record<string, Adapter>,
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
      const serviceIdField = new Field(typeElemID, SERVICE_ID_FIELD_NAME, BuiltinTypes.SERVICE_ID)
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
      let obj: ObjectType
      let regularField: Field
      let regularFieldType: PrimitiveType
      let instance: InstanceElement
      beforeEach(() => {
        obj = origObj.clone()
        regularFieldType = origRegularFieldType.clone()
        regularField = new Field(typeElemID, REGULAR_FIELD_NAME, regularFieldType, { [SERVICE_ID_ANNOTATION]: 'FieldServiceId' })
        instance = new InstanceElement('instance_elem_id_name', obj, { [SERVICE_ID_FIELD_NAME]: 'serviceIdValue' })
      })

      it('should generate for ObjectType and its fields', () => {
        obj.fields = { [REGULAR_FIELD_NAME]: regularField }

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
        delete regularField.annotations[SERVICE_ID_ANNOTATION]
        obj.fields = { [REGULAR_FIELD_NAME]: regularField }

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
        delete regularField.annotations[SERVICE_ID_ANNOTATION]
        delete regularFieldType.annotationTypes[SERVICE_ID_ANNOTATION]
        obj.fields = { [REGULAR_FIELD_NAME]: regularField }

        const serviceIdToStateElemId = generateServiceIdToStateElemId([obj])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(2)
        const objectServiceId = Object.entries(serviceIdToStateElemId)[1][0]
        expect(objectServiceId)
          .toEqual(`${ADAPTER},${obj.elemID.adapter},object_name,${obj.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[1][1]).toEqual(obj.elemID)

        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${regularField.elemID.adapter},field_name,${regularField.elemID.getFullName()},${OBJECT_SERVICE_ID},${objectServiceId}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(regularField.elemID)
      })
      it('should generate for InstanceElement with no SERVICE_ID value', () => {
        obj.fields = { [SERVICE_ID_FIELD_NAME]: serviceIdField }
        delete instance.value[SERVICE_ID_FIELD_NAME]

        const serviceIdToStateElemId = generateServiceIdToStateElemId([instance])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(1)
        const expectedObjectServiceId = `${ADAPTER},${obj.elemID.adapter},${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`
        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${instance.elemID.adapter},${OBJECT_SERVICE_ID},${expectedObjectServiceId},${SERVICE_ID_FIELD_NAME},${instance.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(instance.elemID)
      })
      it('should generate for InstanceElement', () => {
        obj.fields = { [SERVICE_ID_FIELD_NAME]: serviceIdField }

        const serviceIdToStateElemId = generateServiceIdToStateElemId([instance])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(1)
        const expectedObjectServiceId = `${ADAPTER},${obj.elemID.adapter},${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`
        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${instance.elemID.adapter},${OBJECT_SERVICE_ID},${expectedObjectServiceId},${SERVICE_ID_FIELD_NAME},${instance.value[SERVICE_ID_FIELD_NAME]}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(instance.elemID)
      })
      it('should generate for InstanceElement with no SERVICE_ID value & field', () => {
        obj.fields = { [SERVICE_ID_FIELD_NAME]: serviceIdField }
        serviceIdField.type = BuiltinTypes.STRING
        delete instance.value[SERVICE_ID_FIELD_NAME]

        const serviceIdToStateElemId = generateServiceIdToStateElemId([instance])

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(1)
        const expectedObjectServiceId = `${ADAPTER},${obj.elemID.adapter},${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`
        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${ADAPTER},${instance.elemID.adapter},instance_name,${instance.elemID.getFullName()},${OBJECT_SERVICE_ID},${expectedObjectServiceId}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(instance.elemID)
      })
    })

    describe('first fetch', () => {
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [typeWithField, hiddenInstance] })
        )
        const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [],
          [],
          [],
        )
        changes = [...result.changes]
      })

      it('should return the change with no conflict', () => {
        expect(changes).toHaveLength(2)
        changes.forEach(c => expect(c.pendingChange).toBeUndefined())
      })

      it('shouldn\'t remove hidden values from changes', () => {
        const fetchedInst = getChangeElement(changes[1].change)
        expect(fetchedInst.value.hidden).toBeUndefined()
        expect(fetchedInst.value.notHidden).toEqual('notHidden')
      })
    })

    describe('instance defaults', () => {
      it('should call applyInstancesDefaults', async () => {
        jest.spyOn(utils, 'applyInstancesDefaults')
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [workspaceInstance] })
        )
        await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [],
          [],
          [],
        )
        expect(utils.applyInstancesDefaults).toHaveBeenCalledWith([workspaceInstance])
      })
    })
  })
})
