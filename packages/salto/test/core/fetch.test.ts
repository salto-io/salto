import {
  ElemID, Field, BuiltinTypes, ObjectType, getChangeElement, Adapter, Element,
  PrimitiveType, PrimitiveTypes, ADAPTER, OBJECT_SERVICE_ID, InstanceElement,
} from 'adapter-api'
import { EventEmitter } from 'pietile-eventemitter'
import * as plan from '../../src/core/plan'
import {
  fetchChanges, FetchChange, generateServiceIdToStateElemId,
  FetchChangesResult, FetchProgressEvents,
} from '../../src/core/fetch'

import * as merger from '../../src/core/merger'
import { DuplicateAnnotationError } from '../../src/core/merger/internal/object_types'

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
  })
  newTypeBase.path = ['path', 'base']
  const newTypeExt = new ObjectType({
    elemID: newTypeID,
    fields: { ext: new Field(newTypeID, 'ext', BuiltinTypes.STRING) },
  })
  newTypeExt.path = ['path', 'ext']
  const newTypeMerged = new ObjectType({
    elemID: newTypeID,
    fields: {
      base: new Field(newTypeID, 'base', BuiltinTypes.STRING),
      ext: new Field(newTypeID, 'ext', BuiltinTypes.STRING),
    },
  })
  const configID = new ElemID('conf')
  const configType = new ObjectType({
    elemID: configID,
    fields: {
      username: new Field(configID, 'username', BuiltinTypes.STRING),
    },
    annotationTypes: {},
    annotations: {},
  })
  const config = new InstanceElement(ElemID.CONFIG_NAME, configType, { username: 'bla' })

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
          Promise.resolve([newTypeBase, newTypeBase, typeWithField]),
        )
      })
      it('should fail', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [],
          [],
        )
        expect(fetchChangesResult.mergeErrors).toHaveLength(1)
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
              await fetchChanges({}, [], [newTypeBase])
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

            fetchChangesResult = await fetchChanges({}, [], [])
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
          fetchChangesResult = await fetchChanges({}, [], [])
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
          Promise.resolve([newTypeBase, newTypeExt]),
        )
        const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [newTypeMerged],
          [newTypeMerged],
        )
        elements = result.elements
        changes = [...result.changes]
      })
      it('should return merged elements', () => {
        expect(elements).toHaveLength(1)
      })
      it('should not return changes', () => {
        expect(changes).toHaveLength(0)
      })
    })
    describe('when the change is only in the service', () => {
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([typeWithFieldChange])
        )
        const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [typeWithField],
          [typeWithField],
        )
        changes = [...result.changes]
      })
      it('should return the change with no conflict', () => {
        expect(changes).toHaveLength(1)
        expect(changes[0].pendingChange).toBeUndefined()
      })
    })
    describe('when a progressEmitter is provided', () => {
      let progressEmitter: EventEmitter<FetchProgressEvents>
      beforeEach(async () => {
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([newTypeBase, newTypeExt])
        )
        progressEmitter = new EventEmitter<FetchProgressEvents>()
        const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
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
          Promise.resolve([newTypeBase, newTypeExt])
        )
        const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
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
              Promise.resolve([
                newTypeBaseWPath,
                newTypeExtWPath])
            )
            const result = await fetchChanges(
            mockAdapters as unknown as Record<string, Adapter>,
            [newTypeBaseWPath],
            [newTypeBaseWPath],
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
            })

            newTypeA.path = ['a', 'b']
            const newTypeB = new ObjectType({
              elemID: newTypeID,
              annotations: { baba: 'bob' },
            })
            newTypeB.path = ['c', 'd']
            mockAdapters.dummy.fetch.mockResolvedValueOnce(
              Promise.resolve([
                newTypeA,
                newTypeB])
            )
            const result = await fetchChanges(
            mockAdapters as unknown as Record<string, Adapter>,
            [newTypeA],
            [newTypeA],
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
            Promise.resolve([typeWithFieldChange])
          )
          const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [typeWithFieldChange],
          [typeWithField],
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
            Promise.resolve([typeWithFieldChange])
          )
          const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [typeWithFieldConflict],
          [typeWithField],
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
            Promise.resolve([typeWithFieldChange])
          )
          const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [],
          [typeWithField],
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
      let planSpy: jest.SpyInstance
      beforeEach(async () => {
        planSpy = jest.spyOn(plan, 'getFetchPlan')
        mockAdapters.dummy.fetch.mockResolvedValueOnce(
          Promise.resolve([typeWithField])
        )
        const result = await fetchChanges(
          mockAdapters as unknown as Record<string, Adapter>,
          [configType, config],
          [configType, config],
        )
        changes = [...result.changes]
      })
      it('should return the change with no conflict', () => {
        expect(changes).toHaveLength(1)
        expect(changes[0].pendingChange).toBeUndefined()
      })

      it('shouldn\'t call plan', () => {
        expect(planSpy).not.toHaveBeenCalled()
      })
    })
  })
})
