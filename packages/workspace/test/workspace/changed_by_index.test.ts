/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { updateChangedByIndex, CHANGED_BY_INDEX_VERSION } from '../../src/workspace/changed_by_index'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { RemoteMap } from '../../src/workspace/remote_map'
import { createMockRemoteMap } from '../utils'

describe('updateReferenceIndexes', () => {
  let changedByIndex: MockInterface<RemoteMap<ElemID[]>>
  let mapVersions: MockInterface<RemoteMap<number>>
  let elementsSource: ElementsSource
  let object: ObjectType
  let knownUserInstance: InstanceElement
  let unKnownUserInstance: InstanceElement

  beforeEach(() => {
    changedByIndex = createMockRemoteMap<ElemID[]>()
    mapVersions = createMockRemoteMap<number>()
    mapVersions.get.mockResolvedValue(CHANGED_BY_INDEX_VERSION)
    elementsSource = createInMemoryElementSource()

    object = new ObjectType({
      elemID: new ElemID('test', 'object'),
      annotations: {},
      fields: {},
    })
    knownUserInstance = new InstanceElement(
      'instance1',
      object,
      {},
      undefined,
      { [CORE_ANNOTATIONS.CHANGED_BY]: 'user one' },
    )
    unKnownUserInstance = new InstanceElement(
      'instance2',
      object,
      {},
      undefined,
      {},
    )
  })

  describe('when got new elements', () => {
    beforeEach(async () => {
      const changes = [
        toChange({ after: knownUserInstance }),
        toChange({ after: unKnownUserInstance }),
      ]
      await updateChangedByIndex(
        changes,
        changedByIndex,
        mapVersions,
        elementsSource,
        true
      )
    })
    it('should add the new instances changed by values to index', () => {
      expect(changedByIndex.get).toHaveBeenNthCalledWith(1, 'test@@user one')
      expect(changedByIndex.get).toHaveBeenNthCalledWith(2, 'test@@Unknown')
      expect(changedByIndex.set).toHaveBeenNthCalledWith(1, 'test@@user one', [knownUserInstance.elemID])
      expect(changedByIndex.set).toHaveBeenNthCalledWith(2, 'test@@Unknown', [unKnownUserInstance.elemID])
    })
  })
  describe('when elements were modified', () => {
    describe('without pre existing values', () => {
      beforeEach(async () => {
        const changes = [toChange({ before: knownUserInstance, after: unKnownUserInstance })]
        await updateChangedByIndex(
          changes,
          changedByIndex,
          mapVersions,
          elementsSource,
          true
        )
      })
      it('should try to remove old values and place new values', () => {
        expect(changedByIndex.get).toHaveBeenNthCalledWith(1, 'test@@user one')
        expect(changedByIndex.get).toHaveBeenNthCalledWith(2, 'test@@Unknown')
        expect(changedByIndex.set).toHaveBeenNthCalledWith(1, 'test@@Unknown', [unKnownUserInstance.elemID])
      })
    })
    describe.skip('with pre existing values', () => {
      beforeEach(async () => {
        const changes = [
          toChange({ after: knownUserInstance }),
          toChange({ before: knownUserInstance, after: unKnownUserInstance }),
        ]
        await updateChangedByIndex(
          changes,
          changedByIndex,
          mapVersions,
          elementsSource,
          true
        )
      })
      it('should remove old values and place new values', () => {
        expect(changedByIndex.get).toHaveBeenNthCalledWith(1, 'test@@user one')
        expect(changedByIndex.set).toHaveBeenNthCalledWith(1, 'test@@user one', [knownUserInstance.elemID])
        // setup finished
        expect(changedByIndex.get).toHaveBeenNthCalledWith(2, 'test@@user one')
        expect(changedByIndex.set).toHaveBeenNthCalledWith(2, 'test@@user one', [])
        expect(changedByIndex.set).toHaveBeenNthCalledWith(3, 'test@@Unknown', [unKnownUserInstance.elemID])
      })
    })
  })
  describe('when elements were deleted', () => {
    describe('without pre existing values', () => {
      beforeEach(async () => {
        const changes = [toChange({ before: knownUserInstance })]
        await updateChangedByIndex(
          changes,
          changedByIndex,
          mapVersions,
          elementsSource,
          true
        )
      })
      it('should try to remove old values', () => {
        expect(changedByIndex.get).toHaveBeenNthCalledWith(1, 'test@@user one')
        expect(changedByIndex.set).not.toHaveBeenCalled()
      })
    })
    describe.skip('with pre existing values', () => {
      beforeEach(async () => {
        const changes = [
          toChange({ after: knownUserInstance }),
          toChange({ before: knownUserInstance }),
        ]
        await updateChangedByIndex(
          changes,
          changedByIndex,
          mapVersions,
          elementsSource,
          true
        )
      })
      it('should remove old values', () => {
        expect(changedByIndex.get).toHaveBeenNthCalledWith(1, 'test@@user one')
        expect(changedByIndex.set).toHaveBeenNthCalledWith(1, 'test@@user one', [knownUserInstance.elemID])
        expect(changedByIndex.get).toHaveBeenNthCalledWith(2, 'test@@user one')
        expect(changedByIndex.set).toHaveBeenNthCalledWith(2, 'test@@user one', [])
      })
    })
  })

  describe('invalid indexes', () => {
    describe('When cache is invalid', () => {
      beforeEach(async () => {
        await updateChangedByIndex(
          // all elements will be considered as new when cache is invalid
          [toChange({ after: knownUserInstance }), toChange({ after: unKnownUserInstance })],
          changedByIndex,
          mapVersions,
          elementsSource,
          false
        )
      })
      it('should update changed by index with all additions', () => {
        expect(changedByIndex.clear).toHaveBeenCalled()
        expect(changedByIndex.get).toHaveBeenNthCalledWith(1, 'test@@user one')
        expect(changedByIndex.get).toHaveBeenNthCalledWith(2, 'test@@Unknown')
        expect(changedByIndex.set).toHaveBeenNthCalledWith(1, 'test@@user one', [knownUserInstance.elemID])
        expect(changedByIndex.set).toHaveBeenNthCalledWith(2, 'test@@Unknown', [unKnownUserInstance.elemID])
      })
    })

    describe('When indexes are out of date', () => {
      beforeEach(async () => {
        await elementsSource.set(knownUserInstance)
        await elementsSource.set(unKnownUserInstance)
        mapVersions.get.mockResolvedValue(0)
        await updateChangedByIndex(
          [],
          changedByIndex,
          mapVersions,
          elementsSource,
          true
        )
      })
      it('should update changed by index using the element source', () => {
        expect(changedByIndex.clear).toHaveBeenCalled()
        expect(changedByIndex.set).toHaveBeenNthCalledWith(1, 'test@@user one', [knownUserInstance.elemID])
        expect(changedByIndex.set).toHaveBeenNthCalledWith(2, 'test@@Unknown', [unKnownUserInstance.elemID])
      })
    })
  })
})
