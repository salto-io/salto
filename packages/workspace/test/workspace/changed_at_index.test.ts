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
import { updateChangedAtIndex, CHANGED_AT_INDEX_VERSION } from '../../src/workspace/changed_at_index'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { RemoteMap } from '../../src/workspace/remote_map'
import { createMockRemoteMap } from '../utils'

describe('changed at index', () => {
  let changedAtIndex: MockInterface<RemoteMap<ElemID[]>>
  let mapVersions: MockInterface<RemoteMap<number>>
  let elementsSource: ElementsSource
  let object: ObjectType
  let knownUserInstance: InstanceElement
  let unknownUserInstance: InstanceElement
  let knownUserSecondInstance: InstanceElement

  beforeEach(() => {
    jest.resetAllMocks()
    changedAtIndex = createMockRemoteMap<ElemID[]>()
    mapVersions = createMockRemoteMap<number>()
    mapVersions.get.mockResolvedValue(CHANGED_AT_INDEX_VERSION)
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
      { [CORE_ANNOTATIONS.CHANGED_AT]: '2000-01-01T00:00:00.000Z' },
    )
    knownUserSecondInstance = new InstanceElement(
      'instance3',
      object,
      {},
      undefined,
      { [CORE_ANNOTATIONS.CHANGED_AT]: '2001-01-01T00:00:00.000Z' },
    )
    unknownUserInstance = new InstanceElement(
      'instance2',
      object,
      {},
      undefined,
      {},
    )
  })
  describe('mixed changes', () => {
    beforeEach(async () => {
      changedAtIndex.getMany.mockResolvedValue([[knownUserInstance.elemID],
        [knownUserSecondInstance.elemID]])
      const changes = [
        toChange({ after: knownUserInstance }),
        toChange({ before: knownUserSecondInstance, after: knownUserSecondInstance }),
        toChange({ before: unknownUserInstance }),
      ]
      await updateChangedAtIndex(
        changes,
        changedAtIndex,
        mapVersions,
        elementsSource,
        true
      )
    })
    it('should add the new instances changed by values to index', () => {
      expect(changedAtIndex.getMany).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z', '2001-01-01T00:00:00.000Z'])
      expect(changedAtIndex.setAll).toHaveBeenCalledWith([{ key: '2000-01-01T00:00:00.000Z', value: [knownUserInstance.elemID] }, { key: '2001-01-01T00:00:00.000Z', value: [knownUserSecondInstance.elemID] }])
    })
  })

  describe('when got new elements', () => {
    beforeEach(async () => {
      changedAtIndex.getMany.mockResolvedValue([undefined, undefined])
      const changes = [
        toChange({ after: knownUserInstance }),
        toChange({ after: knownUserSecondInstance }),
        toChange({ after: unknownUserInstance }),
      ]
      await updateChangedAtIndex(
        changes,
        changedAtIndex,
        mapVersions,
        elementsSource,
        true
      )
    })
    it('should add the new instances changed by values to index', () => {
      expect(changedAtIndex.getMany).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z', '2001-01-01T00:00:00.000Z'])
      expect(changedAtIndex.setAll).toHaveBeenCalledWith([{ key: '2000-01-01T00:00:00.000Z', value: [knownUserInstance.elemID] }, { key: '2001-01-01T00:00:00.000Z', value: [knownUserSecondInstance.elemID] }])
    })
  })
  describe('when elements were modified', () => {
    describe('date updated after change', () => {
      beforeEach(async () => {
        const modifiedInstance = new InstanceElement(
          'instance1',
          object,
          {},
          undefined,
          { [CORE_ANNOTATIONS.CHANGED_AT]: '2002-01-01T00:00:00.000Z' },
        )
        changedAtIndex.getMany.mockResolvedValue([[knownUserInstance.elemID], undefined])
        const changes = [toChange({ before: knownUserInstance, after: modifiedInstance })]
        await updateChangedAtIndex(
          changes,
          changedAtIndex,
          mapVersions,
          elementsSource,
          true
        )
      })
      it('should add new date', () => {
        expect(changedAtIndex.getMany).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z', '2002-01-01T00:00:00.000Z'])
        expect(changedAtIndex.setAll).toHaveBeenCalledWith([{ key: '2002-01-01T00:00:00.000Z', value: [knownUserInstance.elemID] }])
        expect(changedAtIndex.deleteAll).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z'])
      })
    })
  })
  describe('when elements were deleted', () => {
    describe('without pre existing values', () => {
      beforeEach(async () => {
        changedAtIndex.getMany.mockResolvedValue([undefined])
        const changes = [toChange({ before: knownUserInstance })]
        await updateChangedAtIndex(
          changes,
          changedAtIndex,
          mapVersions,
          elementsSource,
          true
        )
      })
      it('should do nothing', () => {
        expect(changedAtIndex.getMany).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z'])
        expect(changedAtIndex.setAll).toHaveBeenCalledWith([])
        expect(changedAtIndex.deleteAll).toHaveBeenCalledWith([])
      })
    })
    describe('with pre existing values', () => {
      describe('delete key', () => {
        beforeEach(async () => {
          changedAtIndex.getMany.mockResolvedValue([[knownUserInstance.elemID]])
          const changes = [toChange({ before: knownUserInstance })]
          await updateChangedAtIndex(
            changes,
            changedAtIndex,
            mapVersions,
            elementsSource,
            true
          )
        })
        it('should delete empty key', () => {
          expect(changedAtIndex.getMany).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z'])
          expect(changedAtIndex.setAll).toHaveBeenCalledWith([])
          expect(changedAtIndex.deleteAll).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z'])
        })
      })
      describe('set key', () => {
        beforeEach(async () => {
          changedAtIndex.getMany.mockResolvedValue([[unknownUserInstance.elemID]])
          const changes = [toChange({ before: knownUserInstance })]
          await updateChangedAtIndex(
            changes,
            changedAtIndex,
            mapVersions,
            elementsSource,
            true
          )
        })
        it('should try to remove old values', () => {
          expect(changedAtIndex.getMany).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z'])
          expect(changedAtIndex.setAll).toHaveBeenCalledWith([{ key: '2000-01-01T00:00:00.000Z', value: [unknownUserInstance.elemID] }])
          expect(changedAtIndex.deleteAll).toHaveBeenCalledWith([])
        })
      })
    })
  })

  describe('invalid indexes', () => {
    describe('When cache is invalid', () => {
      beforeEach(async () => {
        await updateChangedAtIndex(
          // all elements will be considered as new when cache is invalid
          [toChange({ after: knownUserInstance }), toChange({ after: unknownUserInstance })],
          changedAtIndex,
          mapVersions,
          elementsSource,
          false
        )
      })
      it('should update changed by index with all additions', () => {
        expect(changedAtIndex.clear).toHaveBeenCalled()
        expect(changedAtIndex.getMany).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z'])
        expect(changedAtIndex.setAll).toHaveBeenCalledWith([{ key: '2000-01-01T00:00:00.000Z', value: [knownUserInstance.elemID] }])
      })
    })

    describe('When indexes are out of date', () => {
      beforeEach(async () => {
        await elementsSource.set(knownUserInstance)
        await elementsSource.set(unknownUserInstance)
        mapVersions.get.mockResolvedValue(0)
        await updateChangedAtIndex(
          [],
          changedAtIndex,
          mapVersions,
          elementsSource,
          true
        )
      })
      it('should update changed by index using the element source', () => {
        expect(changedAtIndex.clear).toHaveBeenCalled()
        expect(changedAtIndex.getMany).toHaveBeenCalledWith(['2000-01-01T00:00:00.000Z'])
        expect(changedAtIndex.setAll).toHaveBeenCalledWith([{ key: '2000-01-01T00:00:00.000Z', value: [knownUserInstance.elemID] }])
      })
    })
  })
})
