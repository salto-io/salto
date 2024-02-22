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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import {
  updateChangedByIndex,
  CHANGED_BY_INDEX_VERSION,
  authorKeyToAuthor,
  authorToAuthorKey,
} from '../../src/workspace/changed_by_index'
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
  let emptyObject: ObjectType
  let knownUserInstance: InstanceElement
  let unKnownUserInstance: InstanceElement
  let knownUserSecondInstance: InstanceElement
  const objectKnownFieldElementId = new ElemID('test', 'object', 'field', 'known')
  const objectUnknownFieldElementId = new ElemID('test', 'object', 'field', 'unknown')

  beforeEach(() => {
    jest.resetAllMocks()
    changedByIndex = createMockRemoteMap<ElemID[]>()
    mapVersions = createMockRemoteMap<number>()
    mapVersions.get.mockResolvedValue(CHANGED_BY_INDEX_VERSION)
    elementsSource = createInMemoryElementSource()

    object = new ObjectType({
      elemID: new ElemID('test', 'object'),
      annotations: {
        [CORE_ANNOTATIONS.CHANGED_BY]: 'user two',
      },
      fields: {
        known: {
          annotations: {
            [CORE_ANNOTATIONS.CHANGED_BY]: 'user three',
          },
          refType: BuiltinTypes.STRING,
        },
        unknown: {
          annotations: {},
          refType: BuiltinTypes.STRING,
        },
      },
    })
    emptyObject = new ObjectType({
      elemID: new ElemID('test', 'object'),
      annotations: {
        [CORE_ANNOTATIONS.CHANGED_BY]: 'user two',
      },
      fields: {
        unknown: {
          annotations: {},
          refType: BuiltinTypes.STRING,
        },
      },
    })
    knownUserInstance = new InstanceElement('instance1', object, {}, undefined, {
      [CORE_ANNOTATIONS.CHANGED_BY]: 'user one',
    })
    knownUserSecondInstance = new InstanceElement('instance3', object, {}, undefined, {
      [CORE_ANNOTATIONS.CHANGED_BY]: 'user one',
    })
    unKnownUserInstance = new InstanceElement('instance2', object, {}, undefined, {})
  })
  describe('mixed changes', () => {
    beforeEach(async () => {
      changedByIndex.getMany.mockResolvedValue([[knownUserSecondInstance.elemID], undefined, undefined, undefined])
      const changes = [
        toChange({ after: knownUserInstance }),
        toChange({ before: knownUserSecondInstance, after: knownUserSecondInstance }),
        toChange({ before: unKnownUserInstance }),
        toChange({ after: object }),
      ]
      await updateChangedByIndex(changes, changedByIndex, mapVersions, elementsSource, true)
    })
    it('should add the new instances changed by values to index', () => {
      expect(changedByIndex.getMany).toHaveBeenCalledWith([
        'test@@user one',
        'Unknown',
        'test@@user three',
        'test@@user two',
      ])
      expect(changedByIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            key: 'test@@user one',
            value: expect.arrayContaining([knownUserInstance.elemID, knownUserSecondInstance.elemID]),
          },
        ]),
      )
      expect(changedByIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([{ key: 'test@@user two', value: [object.elemID] }]),
      )
      expect(changedByIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([{ key: 'test@@user three', value: [objectKnownFieldElementId] }]),
      )
      expect(changedByIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([{ key: 'Unknown', value: [objectUnknownFieldElementId] }]),
      )
    })
  })

  describe('when got new elements', () => {
    beforeEach(async () => {
      changedByIndex.getMany.mockResolvedValue([undefined, undefined, undefined, undefined])
      const changes = [
        toChange({ after: knownUserInstance }),
        toChange({ after: knownUserSecondInstance }),
        toChange({ after: unKnownUserInstance }),
        toChange({ after: object }),
      ]
      await updateChangedByIndex(changes, changedByIndex, mapVersions, elementsSource, true)
    })
    it('should add the new instances changed by values to index', () => {
      expect(changedByIndex.getMany).toHaveBeenCalledWith([
        'test@@user one',
        'Unknown',
        'test@@user three',
        'test@@user two',
      ])
      expect(changedByIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([
          { key: 'test@@user one', value: [knownUserInstance.elemID, knownUserSecondInstance.elemID] },
        ]),
      )
      expect(changedByIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([{ key: 'Unknown', value: [unKnownUserInstance.elemID, objectUnknownFieldElementId] }]),
      )
      expect(changedByIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([{ key: 'test@@user two', value: [object.elemID] }]),
      )
      expect(changedByIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([{ key: 'test@@user three', value: [objectKnownFieldElementId] }]),
      )
    })
  })
  describe('when elements were modified', () => {
    describe('changed authors', () => {
      beforeEach(async () => {
        const modifiedInstance = new InstanceElement('instance1', object, {}, undefined, {
          [CORE_ANNOTATIONS.CHANGED_BY]: 'user two',
        })
        changedByIndex.getMany.mockResolvedValue([[knownUserInstance.elemID], undefined])
        const changes = [toChange({ before: knownUserInstance, after: modifiedInstance })]
        await updateChangedByIndex(changes, changedByIndex, mapVersions, elementsSource, true)
      })
      it('should add new author', () => {
        expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one', 'test@@user two'])
        expect(changedByIndex.setAll).toHaveBeenCalledWith([
          { key: 'test@@user two', value: [knownUserInstance.elemID] },
        ])
        expect(changedByIndex.deleteAll).toHaveBeenCalledWith(['test@@user one'])
      })
    })
    describe('same author', () => {
      describe('instances changed', () => {
        beforeEach(async () => {
          changedByIndex.getMany.mockResolvedValue([[knownUserInstance.elemID], [unKnownUserInstance.elemID]])
          const changes = [
            toChange({ before: knownUserInstance, after: knownUserInstance }),
            toChange({ before: unKnownUserInstance, after: unKnownUserInstance }),
          ]
          await updateChangedByIndex(changes, changedByIndex, mapVersions, elementsSource, true)
        })
        it('should update both', () => {
          expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one', 'Unknown'])
          expect(changedByIndex.setAll).toHaveBeenCalledWith(
            expect.arrayContaining([{ key: 'test@@user one', value: [knownUserInstance.elemID] }]),
          )
          expect(changedByIndex.setAll).toHaveBeenCalledWith(
            expect.arrayContaining([{ key: 'Unknown', value: [unKnownUserInstance.elemID] }]),
          )
          expect(changedByIndex.deleteAll).toHaveBeenCalledWith([])
        })
      })
      describe('field added in object', () => {
        beforeEach(async () => {
          changedByIndex.getMany.mockResolvedValue([[object.fields.unknown.elemID], [emptyObject.elemID], undefined])
          const changes = [toChange({ before: emptyObject, after: object })]
          await updateChangedByIndex(changes, changedByIndex, mapVersions, elementsSource, true)
        })
        it('should update fields author', () => {
          expect(changedByIndex.getMany).toHaveBeenCalledWith(['Unknown', 'test@@user two', 'test@@user three'])
          expect(changedByIndex.setAll).toHaveBeenCalledWith(
            expect.arrayContaining([{ key: 'test@@user two', value: [object.elemID] }]),
          )
          expect(changedByIndex.setAll).toHaveBeenCalledWith(
            expect.arrayContaining([{ key: 'test@@user three', value: [object.fields.known.elemID] }]),
          )
          expect(changedByIndex.setAll).toHaveBeenCalledWith(
            expect.arrayContaining([{ key: 'Unknown', value: [object.fields.unknown.elemID] }]),
          )
          expect(changedByIndex.deleteAll).toHaveBeenCalledWith([])
        })
      })
      describe('field removed in object', () => {
        beforeEach(async () => {
          changedByIndex.getMany.mockResolvedValue([
            [object.fields.known.elemID],
            [object.fields.unknown.elemID],
            [object.elemID],
          ])
          const changes = [toChange({ before: object, after: emptyObject })]
          await updateChangedByIndex(changes, changedByIndex, mapVersions, elementsSource, true)
        })
        it('should remove fields author', () => {
          expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user three', 'Unknown', 'test@@user two'])
          expect(changedByIndex.setAll).toHaveBeenCalledWith(
            expect.arrayContaining([{ key: 'test@@user two', value: [object.elemID] }]),
          )
          expect(changedByIndex.setAll).toHaveBeenCalledWith(
            expect.arrayContaining([{ key: 'Unknown', value: [object.fields.unknown.elemID] }]),
          )
          expect(changedByIndex.deleteAll).toHaveBeenCalledWith(['test@@user three'])
        })
      })
    })
  })
  describe('when elements were deleted', () => {
    describe('without pre existing values', () => {
      beforeEach(async () => {
        changedByIndex.getMany.mockResolvedValue([undefined])
        const changes = [toChange({ before: knownUserInstance })]
        await updateChangedByIndex(changes, changedByIndex, mapVersions, elementsSource, true)
      })
      it('should do nothing', () => {
        expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one'])
        expect(changedByIndex.setAll).toHaveBeenCalledWith([])
        expect(changedByIndex.deleteAll).toHaveBeenCalledWith([])
      })
    })
    describe('with pre existing values', () => {
      describe('delete key', () => {
        beforeEach(async () => {
          changedByIndex.getMany.mockResolvedValue([[knownUserInstance.elemID]])
          const changes = [toChange({ before: knownUserInstance })]
          await updateChangedByIndex(changes, changedByIndex, mapVersions, elementsSource, true)
        })
        it('should delete empty key', () => {
          expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one'])
          expect(changedByIndex.setAll).toHaveBeenCalledWith([])
          expect(changedByIndex.deleteAll).toHaveBeenCalledWith(['test@@user one'])
        })
      })
      describe('set key', () => {
        beforeEach(async () => {
          changedByIndex.getMany.mockResolvedValue([[unKnownUserInstance.elemID]])
          const changes = [toChange({ before: knownUserInstance })]
          await updateChangedByIndex(changes, changedByIndex, mapVersions, elementsSource, true)
        })
        it('should try to remove old values', () => {
          expect(changedByIndex.getMany).toHaveBeenCalledWith(['test@@user one'])
          expect(changedByIndex.setAll).toHaveBeenCalledWith([
            { key: 'test@@user one', value: [unKnownUserInstance.elemID] },
          ])
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
          [
            toChange({ after: knownUserInstance }),
            toChange({ after: unKnownUserInstance }),
            toChange({ after: object }),
          ],
          changedByIndex,
          mapVersions,
          elementsSource,
          false,
        )
      })
      it('should update changed by index with all additions', () => {
        expect(changedByIndex.clear).toHaveBeenCalled()
        expect(changedByIndex.getMany).toHaveBeenCalledWith([
          'test@@user one',
          'Unknown',
          'test@@user three',
          'test@@user two',
        ])
        expect(changedByIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([{ key: 'test@@user one', value: [knownUserInstance.elemID] }]),
        )
        expect(changedByIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([
            { key: 'Unknown', value: [unKnownUserInstance.elemID, objectUnknownFieldElementId] },
          ]),
        )
        expect(changedByIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([{ key: 'test@@user two', value: [object.elemID] }]),
        )
        expect(changedByIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([{ key: 'test@@user three', value: [objectKnownFieldElementId] }]),
        )
      })
    })

    describe('When indexes are out of date', () => {
      beforeEach(async () => {
        await elementsSource.set(knownUserInstance)
        await elementsSource.set(unKnownUserInstance)
        await elementsSource.set(object)
        mapVersions.get.mockResolvedValue(0)
        await updateChangedByIndex([], changedByIndex, mapVersions, elementsSource, true)
      })
      it('should update changed by index using the element source', () => {
        expect(changedByIndex.clear).toHaveBeenCalled()
        expect(changedByIndex.getMany).toHaveBeenCalledWith([
          'test@@user three',
          'Unknown',
          'test@@user two',
          'test@@user one',
        ])
        expect(changedByIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([{ key: 'test@@user one', value: [knownUserInstance.elemID] }]),
        )
        expect(changedByIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([
            { key: 'Unknown', value: [objectUnknownFieldElementId, unKnownUserInstance.elemID] },
          ]),
        )
        expect(changedByIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([{ key: 'test@@user two', value: [object.elemID] }]),
        )
        expect(changedByIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([{ key: 'test@@user three', value: [objectKnownFieldElementId] }]),
        )
      })
    })
  })
})
