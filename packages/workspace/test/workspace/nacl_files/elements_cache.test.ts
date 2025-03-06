/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import { Change, ElemID, ObjectType, SaltoError, toChange } from '@salto-io/adapter-api'
import { DuplicateAnnotationError, mergeElements } from '../../../src/merger'
import { createInMemoryElementSource, ElementsSource } from '../../../src/workspace/elements_source'
import {
  ElementMergeManager,
  createMergeManager,
  Flushable,
  ChangeSet,
} from '../../../src/workspace/nacl_files/elements_cache'
import { inMemRemoteMapCreator, RemoteMap, RemoteMapCreator } from '../../../src/workspace/remote_map'

const { awu } = collections.asynciterable
const NAMESPACE = 'TEST_NAMESPACE'

describe('createMergeManager', () => {
  let remoteMapCreator: RemoteMapCreator
  let sources: Record<'nacl' | 'state', ElementsSource>
  let manager: ElementMergeManager
  let flushables: Flushable[]

  const createFlushable = (): Flushable => ({
    flush: jest.fn(),
    clear: jest.fn(),
  })

  beforeEach(async () => {
    remoteMapCreator = inMemRemoteMapCreator()
    sources = {
      nacl: createInMemoryElementSource(),
      state: createInMemoryElementSource(),
    }
    flushables = [createFlushable(), createFlushable(), createFlushable()]
    manager = await createMergeManager(flushables, sources, remoteMapCreator, NAMESPACE, true)
  })

  describe('mergeComponents', () => {
    describe('when an existing element is added to another source with the same values', () => {
      let element: ObjectType
      let mergeErrorsMap: RemoteMap<SaltoError[]>
      let mergeResult: ChangeSet<Change>
      beforeEach(async () => {
        element = new ObjectType({ elemID: new ElemID('test', 'type'), annotations: { val: 'val' } })
        mergeErrorsMap = await remoteMapCreator.create<SaltoError[]>({
          namespace: 'test-mergeErrors',
          // Dummy parameters, using an in memory remote map creator we never call these...
          serialize: async () => '',
          deserialize: async () => [],
          persistent: true,
        })

        // In this scenario, "element" exists in the "state" (and therefore also in the "current elements")
        // and we are now adding it also to the "nacl" source, which will cause a merge conflict on "val"
        await sources.state.set(element)
        const currentElements = createInMemoryElementSource([element])

        mergeResult = await manager.mergeComponents({
          src1Changes: {
            cacheValid: true,
            changes: [toChange({ after: element })],
          },
          currentElements,
          currentErrors: mergeErrorsMap,
          mergeFunc: elements => mergeElements(elements),
          src1Prefix: 'nacl',
          src2Prefix: 'state',
        })
      })
      it('should return no changes', () => {
        // Since the element value did not change, we do not expect to report changes to the higher layers
        expect(mergeResult.changes).toBeEmpty()
      })
      it('should update the merge errors', async () => {
        const mergeErrors = await awu(mergeErrorsMap.entries()).toArray()
        expect(mergeErrors).not.toBeEmpty()
        expect(mergeErrors).toContainEqual(
          expect.objectContaining({
            key: element.elemID.getFullName(),
            value: [expect.any(DuplicateAnnotationError)],
          }),
        )
      })
    })

    describe('when an element with errors is removed from the nacl source', () => {
      let element: ObjectType
      let mergeErrorsMap: RemoteMap<SaltoError[]>
      let mergeResult: ChangeSet<Change>
      beforeEach(async () => {
        element = new ObjectType({ elemID: new ElemID('test', 'type'), annotations: { val: 'val' } })
        mergeErrorsMap = await remoteMapCreator.create<SaltoError[]>({
          namespace: 'test-mergeErrors',
          serialize: async () => '',
          deserialize: async () => [],
          persistent: true,
        })

        // Set up initial state with an element that has errors
        await sources.state.set(element)
        // Not adding the element to the nacl source, because it is deleted at this point
        const currentElements = createInMemoryElementSource([element])

        await mergeErrorsMap.set(element.elemID.getFullName(), [
          new DuplicateAnnotationError({
            elemID: element.elemID,
            key: 'val',
            existingValue: 'val',
            newValue: 'val',
          }),
        ])

        // Delete the element
        mergeResult = await manager.mergeComponents({
          src1Changes: {
            cacheValid: true,
            changes: [toChange({ before: element, after: undefined })],
          },
          // Note: the workspace code would ensure that if a non-hidden element is removed from the nacl source,
          // it will also be removed from the state source
          src2Changes: {
            cacheValid: true,
            changes: [toChange({ before: element, after: undefined })],
          },
          currentElements,
          currentErrors: mergeErrorsMap,
          mergeFunc: elements => mergeElements(elements),
          src1Prefix: 'nacl',
          src2Prefix: 'state',
        })
      })

      it('should return the deletion change', () => {
        expect(mergeResult.changes).toHaveLength(1)
        expect(mergeResult.changes[0]).toEqual(toChange({ before: element, after: undefined }))
      })

      it('should remove the errors for the deleted element', async () => {
        const mergeErrors = await awu(mergeErrorsMap.entries()).toArray()
        expect(mergeErrors).toBeEmpty()
      })
    })
  })

  describe('On clear', () => {
    it('calls clear on each flushable', async () => {
      await manager.clear()
      await Promise.all(
        flushables.map(async flushable => {
          expect(flushable.clear).toHaveBeenCalled()
        }),
      )
    })
  })
  describe('On flush', () => {
    it('If flush was successful, doesnt clear on init', async () => {
      await manager.flush()
      await Promise.all(
        flushables.map(async flushable => {
          expect(flushable.clear).not.toHaveBeenCalled()
        }),
      )
    })

    it('If flush was unsuccessful, clears on init', async () => {
      const mapCreator = inMemRemoteMapCreator()
      const origManager = await createMergeManager(flushables, {}, mapCreator, NAMESPACE, true)
      flushables[1].flush = () => {
        throw new Error('Error within flush')
      }
      try {
        await origManager.flush()
        throw new Error('Flush should throw exception!')
      } catch {
        // Do nothing
      }
      const nextManager = await createMergeManager(flushables, {}, mapCreator, NAMESPACE, true)
      await nextManager.getHash('')
      await Promise.all(
        flushables.map(async flushable => {
          expect(flushable.clear).toHaveBeenCalled()
        }),
      )
    })
  })
})
