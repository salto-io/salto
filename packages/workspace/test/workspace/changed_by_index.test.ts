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
import { updateChangedByIndex, CHANGED_BY_INDEX_VERSION, authorKeyToAuthor, authorToAuthorKey } from '../../src/workspace/changed_by_index'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { RemoteMap } from '../../src/workspace/remote_map'
import { createMockRemoteMap } from '../utils'

describe('authorKeyToAuthor', () => {
  it('should return the author from the author key', () => {
    expect(authorKeyToAuthor('adapter@@user')).toEqual({ user: 'user', account: 'adapter' })
  })
})

describe('authorToAuthorKey', () => {
  it('should return the author from the author key', () => {
    expect(authorToAuthorKey({ user: 'user', account: 'adapter' })).toEqual('adapter@@user')
  })
})

describe('changed by index', () => {
  let changedByIndex: MockInterface<RemoteMap<ElemID[]>>
  let mapVersions: MockInterface<RemoteMap<number>>
  let elementsSource: ElementsSource
  let object: ObjectType
  let knownUserInstance: InstanceElement
  let unKnownUserInstance: InstanceElement
  let knownUserSecondInstance: InstanceElement

  beforeEach(() => {
    jest.resetAllMocks()
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
    knownUserSecondInstance = new InstanceElement(
      'instance3',
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
  describe('mixed changes', () => {
    beforeEach(async () => {
      changedByIndex.getMany.mockResolvedValue([[], []])
      const changes = [
        toChange({ after: knownUserInstance }),
        toChange({ before: unKnownUserInstance, after: knownUserSecondInstance }),
        toChange({ before: unKnownUserInstance }),
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
      expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one', 'Unknown'])
      expect(changedByIndex.setAll).toHaveBeenCalledWith([{ key: 'test@@user one', value: [knownUserInstance.elemID, knownUserSecondInstance.elemID] }, { key: 'Unknown', value: [] }])
    })
  })

  describe('when got new elements', () => {
    beforeEach(async () => {
      changedByIndex.getMany.mockResolvedValue([[], []])
      const changes = [
        toChange({ after: knownUserInstance }),
        toChange({ after: knownUserSecondInstance }),
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
      expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one', 'Unknown'])
      expect(changedByIndex.setAll).toHaveBeenCalledWith([{ key: 'test@@user one', value: [knownUserInstance.elemID, knownUserSecondInstance.elemID] }, { key: 'Unknown', value: [unKnownUserInstance.elemID] }])
    })
  })
  describe('when elements were modified', () => {
    beforeEach(async () => {
      changedByIndex.getMany.mockResolvedValue([[], []])
      const changes = [toChange({ before: knownUserInstance, after: knownUserInstance }),
        toChange({ before: unKnownUserInstance, after: unKnownUserInstance })]
      await updateChangedByIndex(
        changes,
        changedByIndex,
        mapVersions,
        elementsSource,
        true
      )
    })
    it('should add new authors after change', () => {
      expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one', 'Unknown'])
      expect(changedByIndex.setAll).toHaveBeenCalledWith([{ key: 'test@@user one', value: [knownUserInstance.elemID] }, { key: 'Unknown', value: [unKnownUserInstance.elemID] }])
      expect(changedByIndex.deleteAll).toHaveBeenCalledWith([])
    })
  })
  describe('when elements were deleted', () => {
    describe('without pre existing values', () => {
      beforeEach(async () => {
        changedByIndex.getMany.mockResolvedValue([[]])
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
        expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one'])
        expect(changedByIndex.setAll).toHaveBeenCalledWith([{ key: 'test@@user one', value: [] }])
        expect(changedByIndex.deleteAll).toHaveBeenCalledWith(['test@@user one'])
      })
    })
    describe('with pre existing values', () => {
      describe('delete key', () => {
        beforeEach(async () => {
          changedByIndex.getMany.mockResolvedValue([[knownUserInstance.elemID]])
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
          expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one'])
          expect(changedByIndex.setAll).toHaveBeenCalledWith([{ key: 'test@@user one', value: [] }])
          expect(changedByIndex.deleteAll).toHaveBeenCalledWith(['test@@user one'])
        })
      })
      describe('set key', () => {
        beforeEach(async () => {
          changedByIndex.getMany.mockResolvedValue([[unKnownUserInstance.elemID]])
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
          expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one'])
          expect(changedByIndex.setAll).toHaveBeenCalledWith([{ key: 'test@@user one', value: [unKnownUserInstance.elemID] }])
          expect(changedByIndex.deleteAll).toHaveBeenCalledWith([])
        })
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
        expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one', 'Unknown'])
        expect(changedByIndex.setAll).toHaveBeenCalledWith([{ key: 'test@@user one', value: [knownUserInstance.elemID] }, { key: 'Unknown', value: [unKnownUserInstance.elemID] }])
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
        expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one', 'Unknown'])
        expect(changedByIndex.setAll).toHaveBeenCalledWith([{ key: 'test@@user one', value: [knownUserInstance.elemID] }, { key: 'Unknown', value: [unKnownUserInstance.elemID] }])
      })
    })
  })
})
