/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { EventEmitter } from 'pietile-eventemitter'
import {
  ElemID, Field, BuiltinTypes, ObjectType, getChangeElement, AdapterOperations, Element,
  PrimitiveType, PrimitiveTypes, OBJECT_SERVICE_ID, InstanceElement, CORE_ANNOTATIONS,
  ListType, FieldDefinition, FIELD_NAME, INSTANCE_NAME, OBJECT_NAME, ReferenceExpression,
  ReadOnlyElementsSource,
  TypeReference,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import * as utils from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { elementSource, pathIndex, remoteMap, createAdapterReplacedID } from '@salto-io/workspace'
import { mockFunction } from '@salto-io/test-utils'
import { mockWorkspace } from '../common/workspace'
import {
  fetchChanges, FetchChange, generateServiceIdToStateElemId,
  FetchChangesResult, FetchProgressEvents, getAdaptersFirstFetchPartial,
  fetchChangesFromWorkspace, createElemIdGetter,
} from '../../src/core/fetch'
import { getPlan, Plan } from '../../src/core/plan'
import { createElementSource } from '../common/helpers'

const { createInMemoryElementSource } = elementSource
const { awu } = collections.asynciterable
const mockAwu = awu
jest.mock('pietile-eventemitter')
jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  applyInstancesDefaults: jest.fn().mockImplementation(e => mockAwu(e)),
}))

describe('fetch', () => {
  const testID = new ElemID('dummy', 'elem')
  const typeWithField = new ObjectType({
    elemID: testID,
    fields: {
      test: {
        refType: BuiltinTypes.STRING,
        annotations: { annotation: 'value' },
      },
    },
  })
  const typeWithFieldChange = typeWithField.clone()
  typeWithFieldChange.fields.test.annotations.annotation = 'changed'
  typeWithFieldChange.fields.test.annotations.newAnnotation = 'new'
  const typeWithFieldConflict = typeWithField.clone()
  typeWithFieldConflict.fields.test.annotations.annotation = 'conflict'
  const newTypeID = new ElemID('dummy', 'new')
  const newTypeDifferentAdapterID = new ElemID('dummyServiceName', 'new')
  const typeWithFieldDifferentID = new ObjectType({
    elemID: new ElemID(newTypeDifferentAdapterID.adapter, typeWithField.elemID.typeName),
    fields: {
      test: {
        refType: BuiltinTypes.STRING,
        annotations: { annotation: 'value' },
      },
    },
  })
  const typeWithFieldChangeDifferentID = typeWithFieldDifferentID.clone()
  typeWithFieldChangeDifferentID.fields.test.annotations.annotation = 'changed'
  typeWithFieldChangeDifferentID.fields.test.annotations.newAnnotation = 'new'
  const typeWithFieldConflictDifferentID = typeWithFieldDifferentID.clone()
  typeWithFieldConflictDifferentID.fields.test.annotations.annotation = 'conflict'
  const newTypeBase = new ObjectType({
    elemID: newTypeID,
    fields: { base: { refType: BuiltinTypes.STRING } },
    path: ['path', 'base'],
  })
  const newTypeBaseDifferentAdapterID = new ObjectType({
    elemID: newTypeDifferentAdapterID,
    fields: { base: { refType: BuiltinTypes.STRING } },
    path: ['path', 'base'],
  })

  const anotherTypeID = new ElemID('dummy', 'hiddenType')
  const typeWithHiddenField = new ObjectType({
    elemID: anotherTypeID,
    fields: {
      reg: {
        refType: BuiltinTypes.STRING,
      },
      notHidden: {
        refType: BuiltinTypes.STRING,
      },
      hidden: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
      hiddenValue: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
    path: ['records', 'hidden'],
  })
  const typeWithHiddenFieldAlternativeId = new ObjectType({
    elemID: createAdapterReplacedID(anotherTypeID, newTypeDifferentAdapterID.adapter),
    fields: {
      reg: {
        refType: BuiltinTypes.STRING,
      },
      notHidden: {
        refType: BuiltinTypes.STRING,
      },
      hidden: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN]: true },
      },
      hiddenValue: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
    path: ['records', 'hidden'],
  })
  // parent isn't changed
  Object.values(typeWithHiddenFieldAlternativeId.fields).forEach(field => {
    const parentId = field.parent.elemID
    field.parent = expect.anything()
    _.set(field.parent, 'elemID', createAdapterReplacedID(parentId,
      newTypeDifferentAdapterID.adapter))
  })

  const hiddenInstance = new InstanceElement('instance_elem_id_name', typeWithHiddenField, {
    reg: 'reg',
    notHidden: 'notHidden',
    hidden: 'Hidden',
    hiddenValue: 'hidden val',
  })

  const hiddenInstanceAlternateId = new InstanceElement('instance_elem_id_name',
    typeWithHiddenFieldAlternativeId, {
      reg: 'reg',
      notHidden: 'notHidden',
      hidden: 'Hidden',
      hiddenValue: 'hidden val',
    })

  // // Workspace elements should not contains hidden values
  // const workspaceInstance = hiddenValues.removeHiddenFieldsValues(hiddenInstance)

  const newTypeBaseModified = new ObjectType({
    elemID: newTypeID,
    fields: { base: { refType: new ListType(BuiltinTypes.STRING) } },
    path: ['path', 'base'],
  })
  const newTypeBaseModifiedDifferentId = new ObjectType({
    elemID: newTypeDifferentAdapterID,
    fields: { base: { refType: new ListType(BuiltinTypes.STRING) } },
    path: ['path', 'base'],
  })
  const newTypeExt = new ObjectType({
    elemID: newTypeID,
    fields: { ext: { refType: BuiltinTypes.STRING } },
    path: ['path', 'ext'],
  })
  const newTypeMerged = new ObjectType({
    elemID: newTypeDifferentAdapterID,
    fields: {
      base: { refType: BuiltinTypes.STRING },
      ext: { refType: BuiltinTypes.STRING },
    },
  })

  describe('fetchChanges', () => {
    const mockAdapters = {
      [newTypeDifferentAdapterID.adapter]: {
        fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
        deploy: mockFunction<AdapterOperations['deploy']>(),
      },
    }
    let changes: FetchChange[]
    describe('when the adapter returns elements with merge errors', () => {
      beforeEach(() => {
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          { elements: [newTypeBase, newTypeBaseModified, typeWithField] },
        )
      })
      it('should fail', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters,
          createElementSource([]),
          createElementSource([]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        expect(fetchChangesResult.mergeErrors).toHaveLength(1)
      })
    })
    describe('partial fetch results', () => {
      describe('fetch is partial', () => {
        it('should ignore deletions', async () => {
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
            { elements: [newTypeBaseModified], isPartial: true },
          )
          const fetchChangesResult = await fetchChanges(
            mockAdapters,
            createInMemoryElementSource([newTypeBaseModifiedDifferentId, typeWithFieldDifferentID]),
            createInMemoryElementSource([]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
            [],
          )
          expect(Array.from(fetchChangesResult.changes).length).toBe(0)
        })

        it('should return the state elements with the account elements', async () => {
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
            { elements: [newTypeBaseModified], isPartial: true },
          )
          const fetchChangesResult = await fetchChanges(
            mockAdapters,
            createInMemoryElementSource([]),
            createInMemoryElementSource([newTypeBaseDifferentAdapterID, typeWithFieldDifferentID]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
            [],
          )
          expect(fetchChangesResult.elements).toEqual([newTypeBaseModifiedDifferentId,
            typeWithFieldDifferentID])
        })
      })
      describe('fetch is not partial', () => {
        it('should not ignore deletions', async () => {
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
            { elements: [newTypeBaseModified], isPartial: false },
          )
          const fetchChangesResult = await fetchChanges(
            mockAdapters,
            createInMemoryElementSource([newTypeBaseModifiedDifferentId, typeWithFieldDifferentID]),
            createInMemoryElementSource([]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
            [],
          )
          const resultChanges = Array.from(fetchChangesResult.changes)
          expect(resultChanges.length).toBe(1)
          expect(resultChanges[0].change.action).toBe('remove')
        })

        it('should return only the account elements', async () => {
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
            { elements: [newTypeBaseModified], isPartial: false },
          )
          const fetchChangesResult = await fetchChanges(
            mockAdapters,
            createInMemoryElementSource([]),
            createInMemoryElementSource([newTypeBaseDifferentAdapterID, typeWithFieldDifferentID]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
            [],
          )
          expect(fetchChangesResult.elements).toEqual([newTypeBaseModifiedDifferentId])
        })
      })

      it('should use the existing elements to resolve the fetched elements when calculcating changes', async () => {
        const beforeElement = new InstanceElement(
          'name',
          new ObjectType({
            elemID: new ElemID(newTypeDifferentAdapterID.adapter, 'type'),
            fields: {
              field: { refType: BuiltinTypes.NUMBER },
            },
          }),
          { field: new ReferenceExpression(new ElemID(newTypeDifferentAdapterID.adapter, 'type',
            'instance', 'referenced', 'field')) }
        )

        const workspaceReferencedElement = new InstanceElement(
          'referenced',
          new ObjectType({
            elemID: new ElemID(newTypeDifferentAdapterID.adapter, 'type'),
            fields: {
              field: { refType: BuiltinTypes.NUMBER },
            },
          }),
          { field: 5 }
        )
        const stateReferencedElement = workspaceReferencedElement.clone()
        stateReferencedElement.value.field = 6

        const afterElement = beforeElement.clone()
        afterElement.value.field = 4

        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          { elements: [afterElement], isPartial: true },
        )
        const fetchChangesResult = await fetchChanges(
          mockAdapters,
          createInMemoryElementSource([beforeElement, workspaceReferencedElement]),
          createInMemoryElementSource([beforeElement, stateReferencedElement]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )

        const resultChanges = Array.from(fetchChangesResult.changes)
        expect(resultChanges.length).toBe(1)

        const workspaceChange = resultChanges[0].change
        const [accountChange] = resultChanges[0].serviceChanges

        expect(workspaceChange.action).toBe('modify')
        expect(accountChange.action).toBe('modify')

        if (workspaceChange.action === 'modify' && accountChange.action === 'modify') {
          expect(workspaceChange.data.after).toBe(4)
          expect(workspaceChange.data.before.resValue).toBe(5)

          expect(accountChange.data.after).toBe(4)
          expect(accountChange.data.before.resValue).toBe(6)
        }
      })

      describe('multiple adapters', () => {
        const adapters = {
          dummy1AccountName: {
            fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [], isPartial: true }),
            deploy: mockFunction<AdapterOperations['deploy']>(),
          },
          dummy2: {
            fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [], isPartial: false }),
            deploy: mockFunction<AdapterOperations['deploy']>(),
          },
        }

        it('should ignore deletions only for adapter with partial results', async () => {
          const fetchChangesResult = await fetchChanges(
            adapters,
            createInMemoryElementSource([
              new ObjectType({ elemID: new ElemID('dummy1', 'type') }),
              new ObjectType({ elemID: new ElemID('dummy2', 'type') }),
            ]),
            createInMemoryElementSource([]),
            { dummy1AccountName: 'dummy1', dummy2: 'dummy2' },
            [],
          )
          const resultChanges = Array.from(fetchChangesResult.changes)
          expect(resultChanges.length).toBe(1)
          expect(resultChanges[0].change.action).toBe('remove')
          expect(getChangeElement(resultChanges[0].change).elemID.adapter).toBe('dummy2')
        })
      })

      describe('getAdaptersFirstFetchPartial', () => {
        const elements = createInMemoryElementSource([
          new ObjectType({ elemID: new ElemID('adapter1', 'type') }),
        ])
        const partiallyFetchedAdapters = new Set(['adapter1', 'adapter3'])

        it('results should only include adapter which is first fetch is partial', async () => {
          const resultAdapters = await getAdaptersFirstFetchPartial(
            elements,
            partiallyFetchedAdapters
          )
          expect(resultAdapters).toEqual(new Set(['adapter3']))
        })
      })
    })
    describe('config changes', () => {
      const configElemID = new ElemID('dummy')
      const configType = new ObjectType({
        elemID: configElemID,
        fields: {
          test: {
            refType: new ListType(BuiltinTypes.STRING),
          },
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
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          { elements: [], updatedConfig: { config: [configInstance], message: 'test' } }
        )
      })
      it('should return config change plan when there is no current config', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters,
          createElementSource([]),
          createElementSource([]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        expect(fetchChangesResult.configChanges).toBeDefined()
        verifyPlan(
          fetchChangesResult.configChanges as Plan,
          await getPlan({
            before: createElementSource([]),
            after: createElementSource([configInstance]),
          }),
          1,
        )
      })

      it('should return config change plan when there is current config', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters,
          createElementSource([]),
          createElementSource([]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [currentInstanceConfig],
        )
        expect(fetchChangesResult.configChanges).toBeDefined()
        verifyPlan(
          fetchChangesResult.configChanges as Plan,
          await getPlan({
            before: createElementSource([currentInstanceConfig]),
            after: createElementSource([configInstance]),
          }),
          1
        )
      })

      it('should return empty plan when there is no change', async () => {
        const fetchChangesResult = await fetchChanges(
          mockAdapters,
          createElementSource([]),
          createElementSource([]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [configInstance],
        )
        expect([...fetchChangesResult.configChanges?.itemsByEvalOrder() ?? []]).toHaveLength(0)
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
      describe('when instance type has merge error', () => {
        let fetchChangesResult: FetchChangesResult
        let dupInstance: InstanceElement
        let validInstance: InstanceElement
        beforeEach(async () => {
          dupInstance = new InstanceElement('instance_elem_id_name', dupTypeBase, { fname: 'fvalue' })
          validInstance = new InstanceElement('instance_elem_id_name2', typeWithField, { fname: 'fvalue2' })
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
            Promise.resolve(
              { elements: [dupInstance, validInstance, dupTypeBase, dupTypeBase2, typeWithField] }
            )
          )
          fetchChangesResult = await fetchChanges(
            mockAdapters,
            createElementSource([]),
            createElementSource([]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
            [],
          )
        })
        it('should return errors', async () => {
          expect(fetchChangesResult.mergeErrors).toHaveLength(1)
        })
        it('should drop instance elements', () => {
          expect(fetchChangesResult.elements).toHaveLength(2)
          const elemIds = fetchChangesResult.elements.map(e => e.elemID.getFullName())
          expect(elemIds).not.toContain(dupTypeBase.elemID.getFullName())
          expect(elemIds).not.toContain(dupInstance.elemID.getFullName())
        })
        it('should drop instances and type from fetch changes', () => {
          const fetchedChanges = [...fetchChangesResult.changes]
          const addedElementIds = fetchedChanges
            .map(change => getChangeElement(change.change))
            .map(elem => elem.elemID.getFullName())
          expect(addedElementIds).not.toContain(dupTypeBase.elemID.getFullName())
          expect(addedElementIds).not.toContain(dupInstance.elemID.getFullName())
        })
      })
    })
    describe('when there are no changes', () => {
      let elements: Element[]
      beforeEach(async () => {
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [newTypeBase, newTypeExt, hiddenInstance] }),
        )

        const result = await fetchChanges(
          mockAdapters,
          createElementSource([newTypeMerged, hiddenInstanceAlternateId]),
          createElementSource([newTypeMerged, hiddenInstanceAlternateId]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
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

    describe('when the change is only in the account', () => {
      const hiddenChangedVal = 'hiddenChanged'
      const hiddenValueChangedVal = 'hiddenChanged2'

      beforeEach(async () => {
        // the (changed) service instance
        const hiddenInstanceFromService = hiddenInstance.clone()
        const typeWithFieldAndAnnotations = typeWithField.clone()
        typeWithFieldAndAnnotations.annotations = { [CORE_ANNOTATIONS.CHANGED_AT]: 'test' }
        hiddenInstanceFromService.value.hidden = hiddenChangedVal
        hiddenInstanceFromService.value.hiddenValue = hiddenValueChangedVal
        hiddenInstanceFromService.value.notHidden = 'notHiddenChanged'

        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [typeWithFieldAndAnnotations, hiddenInstanceFromService] })
        )

        const result = await fetchChanges(
          mockAdapters,
          createElementSource([typeWithFieldDifferentID, hiddenInstanceAlternateId]),
          createElementSource([typeWithFieldDifferentID, hiddenInstanceAlternateId]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        changes = [...result.changes]
      })

      it('should return the change with no conflict', () => {
        expect(changes).toHaveLength(4)
        changes.forEach(c => expect(c.pendingChanges).toHaveLength(0))
      })

      it('should return the change with metadata', () => {
        expect(changes.some(c => c.metadata?.changedAt === 'test')).toBeTruthy()
      })

      it('should not remove hidden values from changes', () => {
        expect(changes.some(c => (getChangeElement(c.change)) === hiddenChangedVal))
          .toBeTruthy()
        expect(changes.some(c => (getChangeElement(c.change)) === hiddenValueChangedVal))
          .toBeTruthy()
      })
    })
    describe('when a progressEmitter is provided', () => {
      let progressEmitter: EventEmitter<FetchProgressEvents>
      beforeEach(() => {
        progressEmitter = new EventEmitter<FetchProgressEvents>()
      })

      describe('when adapter progress is not reported', () => {
        beforeEach(async () => {
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
            Promise.resolve({ elements: [newTypeBase, newTypeExt] })
          )
          const result = await fetchChanges(
            mockAdapters,
            elementSource.createInMemoryElementSource([]),
            elementSource.createInMemoryElementSource([]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
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
      describe('when adapter progress is reported ', () => {
        beforeEach(async () => {
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch
            .mockImplementationOnce(fetchOpts => {
              fetchOpts.progressReporter.reportProgress({ message: 'done' })
              return Promise.resolve({ elements: [newTypeBase, newTypeExt] })
            })
          const result = await fetchChanges(
            mockAdapters,
            elementSource.createInMemoryElementSource([]),
            elementSource.createInMemoryElementSource([]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
            [],
            progressEmitter
          )
          changes = [...result.changes]
        })
        it('should call emit on changesWillBeFetched & diffWillBeCalculcated and adapter events', () => {
          expect(progressEmitter.emit).toHaveBeenCalledTimes(3)
          expect(progressEmitter.emit).toHaveBeenCalledWith('changesWillBeFetched', expect.anything(), expect.anything())
          expect(progressEmitter.emit).toHaveBeenCalledWith('diffWillBeCalculated', expect.anything())
          expect(progressEmitter.emit).toHaveBeenCalledWith('adapterProgress',
            newTypeDifferentAdapterID.adapter, 'fetch', { message: 'done' })
        })
      })
    })

    describe('when the adapter returns elements that includes type and its instances', () => {
      const inst = new InstanceElement('inst', newTypeBase)
      beforeEach(async () => {
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [newTypeBase, inst, typeWithHiddenField] })
        )
        const result = await fetchChanges(
          mockAdapters,
          createElementSource([typeWithHiddenFieldAlternativeId]),
          createElementSource([]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        changes = [...result.changes]
      })
      it('should return changes for both elements', () => {
        expect(changes).toHaveLength(2)
      })
      it('should return correct changes', () => {
        expect(changes[0].change).toMatchObject({ action: 'add',
          id: newTypeBaseDifferentAdapterID.elemID })
        expect(changes[1].change).toMatchObject({ action: 'add',
          id: createAdapterReplacedID(inst.elemID, newTypeDifferentAdapterID.adapter) })
      })
    })

    describe('when the adapter returns elements that should be split', () => {
      beforeEach(async () => {
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [newTypeBase, newTypeExt] })
        )
        const result = await fetchChanges(
          mockAdapters,
          createElementSource([]),
          createElementSource([]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
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
            mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
              Promise.resolve({ elements: [
                newTypeBaseWPath,
                newTypeExtWPath] })
            )
            const newTypeBaseWPathDifferentID = newTypeBaseDifferentAdapterID.clone()
            newTypeBaseWPathDifferentID.path = ['a', 'b']
            const result = await fetchChanges(
              mockAdapters,
              createElementSource([newTypeBaseWPathDifferentID]),
              createElementSource([newTypeBaseWPathDifferentID]),
              { [newTypeDifferentAdapterID.adapter]: 'dummy' },
              [],
            )
            changes = [...result.changes]
          })


          it('should create one field change', () => {
            expect(changes.length).toEqual(1)
          })
          it('should populate the change with the containing parent path', () => {
            expect(changes[0].change.id.getFullName()).toBe(`${newTypeDifferentAdapterID.adapter}.new.field.ext`)
            expect(changes[0].change.path).toEqual(['c', 'd'])
          })
        })
        describe('when nested elements are annotations', () => {
          beforeEach(async () => {
            const newTypeA = new ObjectType({
              elemID: newTypeID,
              path: ['a', 'b'],
            })

            const expectedNewTypeA = new ObjectType({
              elemID: newTypeDifferentAdapterID,
              path: ['a', 'b'],
            })

            const newTypeB = new ObjectType({
              elemID: newTypeID,
              annotations: { baba: 'bob' },
              path: ['c', 'd'],
            })

            mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
              Promise.resolve({ elements: [
                newTypeA,
                newTypeB] })
            )
            const result = await fetchChanges(
              mockAdapters,
              createElementSource([expectedNewTypeA]),
              createElementSource([expectedNewTypeA]),
              { [newTypeDifferentAdapterID.adapter]: 'dummy' },
              [],
            )
            changes = [...result.changes]
          })


          it('should create one field change', () => {
            expect(changes.length).toEqual(1)
          })
          it('should populate the change with the containing parent path', () => {
            expect(changes[0].change.id.getFullName()).toBe(`${newTypeDifferentAdapterID.adapter}.new.attr.baba`)
            expect(changes[0].change.path).toEqual(['c', 'd'])
          })
        })
      })
      describe('when the working copy is already the same as the account', () => {
        beforeEach(async () => {
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
            Promise.resolve({ elements: [typeWithFieldChange] })
          )
          const result = await fetchChanges(
            mockAdapters,
            createElementSource([typeWithFieldChangeDifferentID]),
            createElementSource([typeWithFieldDifferentID]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
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
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
            Promise.resolve({ elements: [typeWithFieldChange] })
          )
          const result = await fetchChanges(
            mockAdapters,
            createElementSource([typeWithFieldConflictDifferentID]),
            createElementSource([typeWithFieldDifferentID]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
            [],
          )
          changes = [...result.changes]
        })
        it('should return the change with the conflict along with normal changes', () => {
          expect(changes).toHaveLength(2)
          const [conflictChange, normalChange] = changes
          expect(conflictChange.pendingChanges?.length).toBeGreaterThan(0)
          expect(normalChange.pendingChanges).toHaveLength(0)
        })
      })
      describe('when the changed element is removed in the working copy', () => {
        beforeEach(async () => {
          mockAdapters[newTypeDifferentAdapterID.adapter].fetch
            .mockResolvedValueOnce({ elements: [typeWithFieldChange] })
          const result = await fetchChanges(
            mockAdapters,
            createElementSource([]),
            createElementSource([typeWithFieldDifferentID]),
            { [newTypeDifferentAdapterID.adapter]: 'dummy' },
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
          it('should contain the account changes', () => {
            expect(change.serviceChanges).toHaveLength(2)
            expect(change.serviceChanges[0].action).toEqual('modify')
          })
          it('should contain the local change', () => {
            expect(change.pendingChanges).toHaveLength(1)
            expect(change.pendingChanges?.[0].action).toEqual('remove')
          })
          it('should have the change that syncs the working copy to the account', () => {
            expect(change.change.action).toEqual('add')
          })
        })
      })
    })

    describe('when the changed element is removed from the account', () => {
      beforeEach(async () => {
        mockAdapters[newTypeDifferentAdapterID.adapter]
          .fetch.mockResolvedValueOnce({ elements: [] })
        const result = await fetchChanges(
          mockAdapters,
          createElementSource([typeWithFieldChangeDifferentID]),
          createElementSource([typeWithFieldDifferentID]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        changes = [...result.changes]
      })
      it('should return a single change with a conflict', () => {
        expect(changes).toHaveLength(1)
        const [change] = changes
        expect(change.serviceChanges).toHaveLength(1)
        expect(change.pendingChanges).toHaveLength(2)
      })
      it('should have the change that syncs the working copy to the account', () => {
        expect(changes[0].change.action).toEqual('remove')
      })
    })

    describe('when there is only a pending change and no account change', () => {
      beforeEach(async () => {
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch
          .mockResolvedValueOnce({ elements: [typeWithField] })
        const result = await fetchChanges(
          mockAdapters,
          createElementSource([typeWithFieldChangeDifferentID]),
          createElementSource([typeWithFieldDifferentID]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        changes = [...result.changes]
      })
      it('should not return any change', () => {
        expect(changes).toHaveLength(0)
      })
    })

    describe('generateServiceIdToStateElemId', () => {
      const SERVICE_ID_ANNOTATION = 'service_id_annotation_type_name'
      const SERVICE_ID_FIELD_NAME = 'service_id_field_name'
      const REGULAR_FIELD_NAME = 'regular_field_name'

      const typeElemID = new ElemID('adapter', 'elem_id_name')
      const serviceIdField = {
        name: SERVICE_ID_FIELD_NAME,
        refType: BuiltinTypes.SERVICE_ID,
      }
      const origRegularFieldType = new PrimitiveType({
        elemID: new ElemID('adapter', 'regular'),
        primitive: PrimitiveTypes.STRING,
        annotationRefsOrTypes: {
          [SERVICE_ID_ANNOTATION]: BuiltinTypes.SERVICE_ID,
        },
      })
      const origObj = new ObjectType({
        elemID: typeElemID,
        annotationRefsOrTypes: {
          [SERVICE_ID_ANNOTATION]: BuiltinTypes.SERVICE_ID,
        },
        annotations: {
          [SERVICE_ID_ANNOTATION]: 'ObjectServiceId',
        },
      })

      type FieldDefinitionWithName = FieldDefinition & { name: string }
      const addField = (obj: ObjectType, field: FieldDefinitionWithName): Field => {
        const newField = new Field(obj, field.name, field.refType, field.annotations)
        obj.fields[field.name] = newField
        return newField
      }
      let obj: ObjectType
      let regularFieldDef: Required<FieldDefinitionWithName>
      let regularFieldType: PrimitiveType
      let instance: InstanceElement
      let elements: Element[]
      let elementsSource: ReadOnlyElementsSource
      beforeEach(() => {
        obj = origObj.clone()
        regularFieldType = origRegularFieldType.clone()
        regularFieldDef = { name: REGULAR_FIELD_NAME, refType: regularFieldType, annotations: { [SERVICE_ID_ANNOTATION]: 'FieldServiceId' } }
        instance = new InstanceElement('instance_elem_id_name', obj, { [SERVICE_ID_FIELD_NAME]: 'serviceIdValue' })
        elements = [obj, regularFieldType, instance]
        elementsSource = createElementSource(elements)
      })

      it('should generate for ObjectType and its fields', async () => {
        const regularField = addField(obj, regularFieldDef)

        const serviceIdToStateElemId = await generateServiceIdToStateElemId(
          awu([obj]),
          elementsSource
        )

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(2)
        const objectServiceId = Object.entries(serviceIdToStateElemId)[1][0]
        expect(objectServiceId)
          .toEqual(`${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`)
        expect(Object.entries(serviceIdToStateElemId)[1][1]).toEqual(obj.elemID)

        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${OBJECT_SERVICE_ID},${objectServiceId},${SERVICE_ID_ANNOTATION},${regularField.annotations[SERVICE_ID_ANNOTATION]}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(regularField.elemID)
      })
      it('should generate for ObjectType and its fields with no SERVICE_ID annotations', async () => {
        delete obj.annotations[SERVICE_ID_ANNOTATION]
        delete regularFieldDef.annotations[SERVICE_ID_ANNOTATION]
        const regularField = addField(obj, regularFieldDef)

        const serviceIdToStateElemId = await generateServiceIdToStateElemId(
          awu([obj]),
          elementsSource
        )

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(2)
        const objectServiceId = Object.entries(serviceIdToStateElemId)[1][0]
        expect(objectServiceId)
          .toEqual(`${SERVICE_ID_ANNOTATION},${obj.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[1][1]).toEqual(obj.elemID)

        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${OBJECT_SERVICE_ID},${objectServiceId},${SERVICE_ID_ANNOTATION},${regularField.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(regularField.elemID)
      })
      it('should generate for ObjectType and its fields with no SERVICE_ID annotations & annotationType', async () => {
        delete obj.annotations[SERVICE_ID_ANNOTATION]
        delete obj.annotationRefTypes[SERVICE_ID_ANNOTATION]
        delete regularFieldDef.annotations[SERVICE_ID_ANNOTATION]
        delete regularFieldType.annotationRefTypes[SERVICE_ID_ANNOTATION]
        const regularField = addField(obj, regularFieldDef)

        const serviceIdToStateElemId = await generateServiceIdToStateElemId(
          awu([obj]),
          elementsSource
        )

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(2)
        const objectServiceId = Object.entries(serviceIdToStateElemId)[1][0]
        expect(objectServiceId)
          .toEqual(`${OBJECT_NAME},${obj.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[1][1]).toEqual(obj.elemID)

        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${FIELD_NAME},${regularField.elemID.getFullName()},${OBJECT_SERVICE_ID},${objectServiceId}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(regularField.elemID)
      })
      it('should generate for InstanceElement with no SERVICE_ID value', async () => {
        addField(obj, serviceIdField)
        delete instance.value[SERVICE_ID_FIELD_NAME]

        const serviceIdToStateElemId = await generateServiceIdToStateElemId(
          awu([instance]),
          elementsSource
        )

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(1)
        const expectedObjectServiceId = `${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`
        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${OBJECT_SERVICE_ID},${expectedObjectServiceId},${SERVICE_ID_FIELD_NAME},${instance.elemID.getFullName()}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(instance.elemID)
      })
      it('should generate for InstanceElement', async () => {
        addField(obj, serviceIdField)

        const serviceIdToStateElemId = await generateServiceIdToStateElemId(
          awu([instance]),
          elementsSource
        )

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(1)
        const expectedObjectServiceId = `${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`
        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${OBJECT_SERVICE_ID},${expectedObjectServiceId},${SERVICE_ID_FIELD_NAME},${instance.value[SERVICE_ID_FIELD_NAME]}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(instance.elemID)
      })
      it('should generate for InstanceElement with no SERVICE_ID value & field', async () => {
        serviceIdField.refType = BuiltinTypes.STRING
        addField(obj, serviceIdField)
        delete instance.value[SERVICE_ID_FIELD_NAME]

        const serviceIdToStateElemId = await generateServiceIdToStateElemId(
          awu([instance]),
          elementsSource
        )

        expect(Object.entries(serviceIdToStateElemId)).toHaveLength(1)
        const expectedObjectServiceId = `${SERVICE_ID_ANNOTATION},${obj.annotations[SERVICE_ID_ANNOTATION]}`
        expect(Object.entries(serviceIdToStateElemId)[0][0])
          .toEqual(`${INSTANCE_NAME},${instance.elemID.getFullName()},${OBJECT_SERVICE_ID},${expectedObjectServiceId}`)
        expect(Object.entries(serviceIdToStateElemId)[0][1]).toEqual(instance.elemID)
      })
    })

    describe('first fetch', () => {
      beforeEach(async () => {
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          { elements: [typeWithField, hiddenInstance] }
        )
        const result = await fetchChanges(
          mockAdapters,
          createElementSource([]),
          createElementSource([]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        changes = [...result.changes]
      })

      it('should return the changes with no conflict', () => {
        expect(changes).toHaveLength(2)
        changes.forEach(c => expect(c.pendingChanges).toBeUndefined())
      })

      it('changes should be equal to the account elements', () => {
        expect(getChangeElement(changes[0].change)).toEqual(typeWithFieldDifferentID)
        const expectedHiddenInstanceAlternateId = hiddenInstanceAlternateId.clone()
        expectedHiddenInstanceAlternateId.refType = _.clone(expectedHiddenInstanceAlternateId
          .refType)
        expectedHiddenInstanceAlternateId.refType.value = expect.anything()
        // refType's type property is not supposed to be transformed, so we don't assert on it.
        _.set(expectedHiddenInstanceAlternateId.refType, 'type', expect.anything())
        expect(getChangeElement(changes[1].change)).toEqual(expectedHiddenInstanceAlternateId)
      })
    })

    describe('instance defaults', () => {
      it('should call applyInstancesDefaults', async () => {
        // spyOn where utils is defined https://stackoverflow.com/a/53307822
        const mockApplyInstancesDefaults = utils.applyInstancesDefaults as jest.Mock
        let instancesPassed: AsyncIterable<Element> = awu([])
        mockApplyInstancesDefaults.mockImplementationOnce((elements: AsyncIterable<Element>) => {
          instancesPassed = elements
          return awu([])
        })
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [hiddenInstance] })
        )
        await fetchChanges(
          mockAdapters,
          createElementSource([]),
          createElementSource([]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        const passed = await awu(instancesPassed).toArray()
        const expectedHiddenInstanceAlternateId = hiddenInstanceAlternateId.clone()
        expectedHiddenInstanceAlternateId.refType = _.clone(expectedHiddenInstanceAlternateId
          .refType)
        expectedHiddenInstanceAlternateId.refType.value = expect.anything()
        // refType's type property is not supposed to be transformed, so we don't assert on it.
        _.set(expectedHiddenInstanceAlternateId.refType, 'type', expect.anything())
        expect(passed).toEqual([expectedHiddenInstanceAlternateId])
      })
    })
  })

  describe('fetchChanges with postFetch', () => {
    const mockAdapters = {
      [newTypeDifferentAdapterID.adapter]: {
        fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [] }),
        deploy: mockFunction<AdapterOperations['deploy']>(),
        postFetch: mockFunction<Required<AdapterOperations>['postFetch']>().mockResolvedValue(),
      },
    }
    describe('fetch is partial', () => {
      it('should call postFetch with the state and account elements combined in elementsByAccount, but only the fetched elements in currentAdapterElements', async () => {
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          Promise.resolve({ elements: [newTypeBaseModified], isPartial: true }),
        )
        const fetchChangesResult = await fetchChanges(
          mockAdapters,
          createElementSource([typeWithFieldDifferentID]),
          createElementSource([newTypeBaseDifferentAdapterID, typeWithFieldDifferentID]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        expect(fetchChangesResult.elements).toEqual([newTypeBaseModifiedDifferentId,
          typeWithFieldDifferentID])
        expect(mockAdapters[newTypeDifferentAdapterID.adapter].postFetch).toHaveBeenCalledWith({
          currentAdapterElements: expect.arrayContaining([
            newTypeBaseModifiedDifferentId,
          ]),
          elementsByAccount: {
            [newTypeDifferentAdapterID.adapter]: expect.arrayContaining([
              newTypeBaseModifiedDifferentId,
              typeWithFieldDifferentID,
            ]),
          },
          accountToServiceNameMap: {
            [newTypeDifferentAdapterID.adapter]: 'dummy',
          },
          progressReporter: expect.anything(),
        })
      })
    })
    describe('fetch is not partial', () => {
      it('should call postFetch with only the account elements', async () => {
        mockAdapters[newTypeDifferentAdapterID.adapter].fetch.mockResolvedValueOnce(
          { elements: [newTypeBaseModified], isPartial: false },
        )
        const fetchChangesResult = await fetchChanges(
          mockAdapters,
          createElementSource([]),
          createElementSource([newTypeBaseDifferentAdapterID, typeWithFieldDifferentID]),
          { [newTypeDifferentAdapterID.adapter]: 'dummy' },
          [],
        )
        expect(fetchChangesResult.elements).toEqual([newTypeBaseModifiedDifferentId])
        expect(mockAdapters[newTypeDifferentAdapterID.adapter].postFetch).toHaveBeenCalledWith({
          currentAdapterElements: expect.arrayContaining([
            newTypeBaseModifiedDifferentId,
          ]),
          elementsByAccount: {
            [newTypeDifferentAdapterID.adapter]: expect.arrayContaining([
              newTypeBaseModifiedDifferentId,
            ]),
          },
          accountToServiceNameMap: {
            [newTypeDifferentAdapterID.adapter]: 'dummy',
          },
          progressReporter: expect.anything(),
        })
      })
    })

    describe('multiple adapters, some of same account type', () => {
      const dummy2PrimStr = new PrimitiveType({
        elemID: new ElemID('dummy2', 'prim'),
        primitive: PrimitiveTypes.STRING,
        annotationRefsOrTypes: {},
        annotations: {},
      })
      const dummy3PrimStr = new PrimitiveType({
        elemID: new ElemID('dummy3', 'prim'),
        primitive: PrimitiveTypes.STRING,
        annotationRefsOrTypes: {},
        annotations: {},
      })
      const dummy2 = new ObjectType({ elemID: new ElemID('dummy2', 'type') })
      const dummy3 = new ObjectType({ elemID: new ElemID('dummy2', 'type') })
      const expectedDummy3ObjectAterRename = new ObjectType({ elemID: new ElemID('dummy3', 'type') })
      const dummy1Type1 = new ObjectType({ elemID: new ElemID('dummy1', 'd1t1'), fields: {} })
      const dummy2Type1 = new ObjectType({ elemID: new ElemID('dummy2', 'd2t1'), fields: {} })
      const dummy3Type1 = new ObjectType({ elemID: new ElemID('dummy2', 'd3t1'), fields: {} })
      const expectedDummy3Type1AfterRename = new ObjectType({ elemID: new ElemID('dummy3', 'd3t1'), fields: {} })
      dummy3Type1.fields.listListStr = new Field(dummy3Type1, 'listListStr',
        new ListType(new ListType(dummy2PrimStr)))
      const expectedDummy1 = new ObjectType({ elemID: new ElemID('dummy1AlternateServiceName', 'type') })
      const expectedDummy1Type1 = new ObjectType({ elemID: new ElemID(expectedDummy1.elemID
        .adapter, 'd1t1'),
      fields: {} })
      dummy3Type1.fields.listStr = new Field(dummy3Type1, 'listStr', new ListType(dummy2PrimStr))
      expectedDummy3Type1AfterRename.fields.listStr = new Field(expectedDummy3Type1AfterRename,
        'listStr', new ListType(dummy3PrimStr))
      expectedDummy3Type1AfterRename.fields.listListStr = new Field(expectedDummy3Type1AfterRename,
        'listListStr', new ListType(new ListType(dummy3PrimStr)))
      // These next lines remove expectation from resolved values
      expectedDummy3Type1AfterRename.fields.listListStr.refType.value = expect.anything()
      _.set(expectedDummy3Type1AfterRename.fields.listListStr.refType, 'type', expect.anything())
      expectedDummy3Type1AfterRename.fields.listStr.refType.value = expect.anything()
      _.set(expectedDummy3Type1AfterRename.fields.listStr.refType, 'type', expect.anything())


      const adapters = {
        [expectedDummy1.elemID.adapter]: {
          fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [dummy1Type1], isPartial: true }),
          deploy: mockFunction<AdapterOperations['deploy']>(),
        },
        dummy2: {
          fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [dummy2Type1], isPartial: false }),
          deploy: mockFunction<AdapterOperations['deploy']>(),
          postFetch: mockFunction<Required<AdapterOperations>['postFetch']>().mockResolvedValue(),
        },
        dummy3: {
          fetch: mockFunction<AdapterOperations['fetch']>().mockResolvedValue({ elements: [dummy3Type1], isPartial: false }),
          deploy: mockFunction<AdapterOperations['deploy']>(),
          postFetch: mockFunction<Required<AdapterOperations>['postFetch']>().mockResolvedValue(),
        },
      }
      beforeEach(() => {
        jest.clearAllMocks()
      })

      it('should call postFetch for all relevant adapters when all are fetched', async () => {
        await fetchChanges(
          adapters,
          createElementSource([]),
          createElementSource([expectedDummy1, dummy2, dummy3]),
          { [expectedDummy1.elemID.adapter]: 'dummy1', dummy2: 'dummy2', dummy3: 'dummy2' },
          [],
        )
        expect(adapters.dummy2.postFetch).toHaveBeenCalledWith({
          currentAdapterElements: expect.arrayContaining([dummy2Type1]),
          elementsByAccount: {
            [expectedDummy1.elemID.adapter]: expect.arrayContaining(
              [expectedDummy1Type1, expectedDummy1]
            ),
            dummy2: expect.arrayContaining([dummy2Type1]),
            dummy3: expect.arrayContaining([expectedDummy3Type1AfterRename]),
          },
          accountToServiceNameMap: {
            [expectedDummy1.elemID.adapter]: 'dummy1',
            dummy2: 'dummy2',
            dummy3: 'dummy2',
          },
          progressReporter: expect.anything(),
        })
        expect(adapters.dummy3.postFetch).toHaveBeenCalledWith({
          currentAdapterElements: expect.arrayContaining([expectedDummy3Type1AfterRename]),
          elementsByAccount: {
            [expectedDummy1.elemID.adapter]: expect
              .arrayContaining([expectedDummy1Type1, expectedDummy1]),
            dummy2: expect.arrayContaining([dummy2Type1]),
            dummy3: expect.arrayContaining([expectedDummy3Type1AfterRename]),
          },
          accountToServiceNameMap: {
            [expectedDummy1.elemID.adapter]: 'dummy1',
            dummy2: 'dummy2',
            dummy3: 'dummy2',
          },
          progressReporter: expect.anything(),
        })
      })
      it('should call postFetch only for fetched adapters (with postFetch defined) when not all are fetched', async () => {
        await fetchChanges(
          _.pick(adapters, [expectedDummy1.elemID.adapter, 'dummy2']),
          createElementSource([]),
          createElementSource([expectedDummy1, dummy2, expectedDummy3ObjectAterRename]),
          {
            [expectedDummy1.elemID.adapter]: 'dummy1',
            dummy2: 'dummy2',
            dummy3: 'dummy2',
          },
          [],
        )
        expect(adapters.dummy2.postFetch).toHaveBeenCalledWith({
          currentAdapterElements: expect.arrayContaining([dummy2Type1]),
          elementsByAccount: {
            // dummy1 is partial so it also includes elements from the workspace
            [expectedDummy1.elemID.adapter]: expect
              .arrayContaining([expectedDummy1Type1, expectedDummy1]),
            dummy2: expect.arrayContaining([dummy2Type1]),
            // dummy3 was not fetched so it includes only elements from the workspace
            dummy3: expect.arrayContaining([expectedDummy3ObjectAterRename]),
          },
          accountToServiceNameMap: {
            [expectedDummy1.elemID.adapter]: 'dummy1',
            dummy2: 'dummy2',
            dummy3: 'dummy2',
          },
          progressReporter: expect.anything(),
        })
        expect(adapters.dummy3.postFetch).not.toHaveBeenCalled()
      })
      it('should not fail on errors', async () => {
        adapters.dummy2.postFetch.mockImplementationOnce(() => { throw new Error(' failure') })
        await expect(fetchChanges(
          _.pick(adapters, [expectedDummy1.elemID.adapter, 'dummy2']),
          createElementSource([]),
          createElementSource([expectedDummy1, dummy2, expectedDummy3ObjectAterRename]),
          {
            [expectedDummy1.elemID.adapter]: 'dummy1',
            dummy2: 'dummy2',
            dummy3: 'dummy2',
          },
          [],
        )).resolves.not.toThrow()
        expect(adapters.dummy2.postFetch).toHaveBeenCalledWith({
          currentAdapterElements: expect.arrayContaining([dummy2Type1]),
          elementsByAccount: {
            // dummy1 is partial so it also includes elements from the workspace
            [expectedDummy1.elemID.adapter]: expect.arrayContaining(
              [expectedDummy1Type1, expectedDummy1]
            ),
            dummy2: expect.arrayContaining([dummy2Type1]),
            // dummy3 was not fetched so it includes only elements from the workspace
            dummy3: expect.arrayContaining([expectedDummy3ObjectAterRename]),
          },
          accountToServiceNameMap: {
            [expectedDummy1.elemID.adapter]: 'dummy1',
            dummy2: 'dummy2',
            dummy3: 'dummy2',
          },
          progressReporter: expect.anything(),
        })
        expect(adapters.dummy3.postFetch).not.toHaveBeenCalled()
      })
    })
  })
})

describe('fetch from workspace', () => {
  describe('workspace mismatch errors', () => {
    it('should fail when attempting to fetch an env not present in the source workspace', async () => {
      const sourceWS = mockWorkspace({
        accounts: ['salto'],
      })

      const fetchRes = await fetchChangesFromWorkspace(
        sourceWS,
        ['salto'],
        createInMemoryElementSource([]),
        createInMemoryElementSource([]),
        [],
        'nonexisiting'
      )
      expect([...fetchRes.changes]).toHaveLength(0)
      expect(fetchRes.elements).toHaveLength(0)
      expect(fetchRes.unmergedElements).toHaveLength(0)
      expect(fetchRes.errors).toHaveLength(1)
      expect(fetchRes.errors[0].message).toBe('nonexisiting env does not exist in the source workspace.')
      expect(fetchRes.errors[0].severity).toBe('Error')
    })

    it('should fail when attempting to fetch an account not present in the source workspace', async () => {
      const sourceWS = mockWorkspace({
        accounts: ['salto'],
      })

      const fetchRes = await fetchChangesFromWorkspace(
        sourceWS,
        ['salto', 'salesforce'],
        createInMemoryElementSource([]),
        createInMemoryElementSource([]),
        [],
        'default'
      )
      expect([...fetchRes.changes]).toHaveLength(0)
      expect(fetchRes.elements).toHaveLength(0)
      expect(fetchRes.unmergedElements).toHaveLength(0)
      expect(fetchRes.errors).toHaveLength(1)
      expect(fetchRes.errors[0].message).toBe('Source env does not contain the following accounts: salesforce')
      expect(fetchRes.errors[0].severity).toBe('Error')
    })

    it('should fail if the source workspace has errors', async () => {
      const sourceWS = mockWorkspace({
        accounts: ['salto'],
        errors: [{ message: 'A glitch', severity: 'Error' }],
      })

      const fetchRes = await fetchChangesFromWorkspace(
        sourceWS,
        ['salto'],
        createInMemoryElementSource([]),
        createInMemoryElementSource([]),
        [],
        'default'
      )
      expect([...fetchRes.changes]).toHaveLength(0)
      expect(fetchRes.elements).toHaveLength(0)
      expect(fetchRes.unmergedElements).toHaveLength(0)
      expect(fetchRes.errors).toHaveLength(1)
      expect(fetchRes.errors[0].message).toBe('Can not fetch from a workspace with errors.')
      expect(fetchRes.errors[0].severity).toBe('Error')
    })

    it('should fail if there is a mismatch in the adapter configs', async () => {
      const currentServiceConfigs = [
        new InstanceElement(
          'salto_config',
          new TypeReference(ElemID.fromFullName('salto_config')),
          {
            key: 'value',
          }
        ),
        new InstanceElement(
          'salto_config2',
          new TypeReference(ElemID.fromFullName('salto_config2')),
          {
            key: 'value2',
          }
        ),
      ]

      const sourceServiceConfigs = {
        salto_config: currentServiceConfigs[0].clone(),
        salto_config2: currentServiceConfigs[1].clone(),
      }
      sourceServiceConfigs.salto_config2.value.key = 'otherValue'
      const sourceWS = mockWorkspace({
        accountConfigs: sourceServiceConfigs,
      })

      const fetchRes = await fetchChangesFromWorkspace(
        sourceWS,
        ['salto'],
        createInMemoryElementSource([]),
        createInMemoryElementSource([]),
        currentServiceConfigs,
        'default'
      )

      expect([...fetchRes.changes]).toHaveLength(0)
      expect(fetchRes.elements).toHaveLength(0)
      expect(fetchRes.unmergedElements).toHaveLength(0)
      expect(fetchRes.errors).toHaveLength(1)
      expect(fetchRes.errors[0].message).toBe('Can not fetch from a workspace. Found different configs for salto_config2')
      expect(fetchRes.errors[0].severity).toBe('Error')
    })
  })

  describe('fetch changes from workspace', () => {
    const objElemId = new ElemID('salto', 'obj')
    const objFragStdFields = new ObjectType({
      elemID: objElemId,
      fields: {
        stdField: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            test: 'test',
          },
        },
      },
      path: ['salto', 'obj', 'standardFields'],
    })
    const objFragCustomFields = new ObjectType({
      elemID: objElemId,
      fields: {
        customField: {
          refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
          annotations: {
            test: 'test',
          },
        },
      },
      path: ['salto', 'obj', 'customFields'],
    })
    const objFragAnnotations = new ObjectType({
      elemID: objElemId,
      annotationRefsOrTypes: {
        anno: createRefToElmWithValue(BuiltinTypes.STRING),
      },
      annotations: {
        anno: 'Anno!!!! Anno!!!! Annnooooooooooo!!!!!!!!',
      },
      path: ['salto', 'obj', 'annotations'],
    })

    const objFull = new ObjectType({
      elemID: objElemId,
      fields: {
        stdField: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {
            test: 'test',
          },
        },
        customField: {
          refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
          annotations: {
            test: 'test',
          },
        },
      },
      annotationRefsOrTypes: {
        anno: createRefToElmWithValue(BuiltinTypes.STRING),
      },
      annotations: {
        anno: 'Anno!!!! Anno!!!! Annnooooooooooo!!!!!!!!',
      },
    })
    const otherAdapterElem = new ObjectType({
      elemID: new ElemID('other', 'obj'),
      path: ['other', 'obj', 'all'],
    })
    const existingElement = new ObjectType({
      elemID: new ElemID('salto', 'existing'),
      path: ['salto', 'existing', 'all'],
    })
    const mergedElements = [objFull, existingElement, otherAdapterElem]
    const unmergedElements = [
      objFragStdFields, objFragCustomFields,
      objFragAnnotations, existingElement, otherAdapterElem,
    ]
    const pi = new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>()
    let fetchRes: FetchChangesResult

    beforeEach(async () => {
      await pathIndex.overridePathIndex(pi, unmergedElements)
      const configs = [
        new InstanceElement('_config', new ReferenceExpression(new ElemID('salto'))),
      ]
      fetchRes = await fetchChangesFromWorkspace(
        mockWorkspace({
          elements: mergedElements,
          index: await awu(pi.entries()).toArray(),
          accountConfigs: { salto: configs[0] },
        }),
        ['salto'],
        createInMemoryElementSource([existingElement]),
        createInMemoryElementSource([existingElement]),
        configs,
        'default'
      )
    })


    it('should return all merged elements of the fetched services', () => {
      const elemIDSorter = (a: Element, b: Element): number => {
        if (a.elemID.getFullName() > b.elemID.getFullName()) {
          return -1
        }
        if (a.elemID.getFullName() < b.elemID.getFullName()) {
          return 1
        }
        return 0
      }

      const allMerged = [...fetchRes.elements]
      expect(allMerged.sort(elemIDSorter)).toEqual(mergedElements
        .filter(e => e.elemID.adapter === 'salto')
        .sort(elemIDSorter))
    })

    it('should return all unmerged elements fragments with the same pathes as the source pathes', () => {
      const unmerged = [...fetchRes.unmergedElements]
      const expectedFrags = unmergedElements.filter(e => e.elemID.adapter === 'salto')
      expect(unmerged).toHaveLength(expectedFrags.length)
      expectedFrags
        .forEach(frag => expect(unmerged.filter(e => e.isEqual(frag))).toHaveLength(1))
    })

    it('should create changes based on the current elements', () => {
      const changes = [...fetchRes.changes]
      const unmergedDiffElement = unmergedElements
        .filter(elem => elem.elemID.getFullName() === 'salto.obj')
      expect(changes).toHaveLength(unmergedDiffElement.length)
      const changesElements = changes
        .map(change => getChangeElement(change.change))
      unmergedDiffElement
        .forEach(frag => expect(changesElements.filter(e => e.isEqual(frag))).toHaveLength(1))
    })
  })

  describe('elem id getter test', () => {
    it('translated id to new account name', async () => {
      const objID = new ElemID('salesforce', 'obj')
      const obj = new ObjectType({
        elemID: new ElemID('salesforceaccountName', 'obj'),
      })
      const idGetter = await createElemIdGetter(awu([obj]), createElementSource([]))
      expect(idGetter('salesforce', { [OBJECT_SERVICE_ID]: objID.getFullName() },
        'obj')).toEqual(objID)
    })
  })
})
