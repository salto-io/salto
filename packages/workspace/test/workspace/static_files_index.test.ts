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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, StaticFile, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { updateReferencedStaticFilesIndex, STATIC_FILES_INDEX_VERSION } from '../../src/workspace/static_files_index'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { RemoteMap } from '../../src/workspace/remote_map'
import { createMockRemoteMap } from '../utils'

describe('static files index', () => {
  let staticFilesIndex: MockInterface<RemoteMap<string[]>>
  let mapVersions: MockInterface<RemoteMap<number>>
  let elementsSource: ElementsSource
  let object: ObjectType
  let knownUserInstance: InstanceElement
  let unKnownUserInstance: InstanceElement
  let knownUserSecondInstance: InstanceElement

  beforeEach(() => {
    jest.resetAllMocks()
    staticFilesIndex = createMockRemoteMap<string[]>()
    mapVersions = createMockRemoteMap<number>()
    mapVersions.get.mockResolvedValue(STATIC_FILES_INDEX_VERSION)
    elementsSource = createInMemoryElementSource()
    const firstStaticFile = new StaticFile({
      content: Buffer.from('I am a little static file'),
      filepath: 'static1.nacl',
      hash: 'FFFF',
    })

    const secondStaticFile = new StaticFile({
      content: Buffer.from('I am a little static file'),
      filepath: 'static2.nacl',
      hash: 'FFFF',
    })

    object = new ObjectType({
      elemID: new ElemID('test', 'object'),
      annotations: {},
      fields: {
        field: {
          annotations: {},
          refType: BuiltinTypes.STRING,
        },
      },
    })
    knownUserInstance = new InstanceElement(
      'instance1',
      object,
      {
        field: firstStaticFile,
      },
      undefined,
      {},
    )
    knownUserSecondInstance = new InstanceElement(
      'instance3',
      object,
      {
        field: secondStaticFile,
      },
      undefined,
      {},
    )
    unKnownUserInstance = new InstanceElement('instance2', object, {}, undefined, {})
  })
  describe('mixed changes', () => {
    beforeEach(async () => {
      const changes = [
        toChange({ after: knownUserInstance }),
        toChange({ before: knownUserSecondInstance, after: knownUserSecondInstance }),
        toChange({ before: unKnownUserInstance }),
        toChange({ after: object }),
      ]
      await updateReferencedStaticFilesIndex(changes, staticFilesIndex, mapVersions, elementsSource, true)
    })
    it('should add the new instances changed by values to index', () => {
      expect(staticFilesIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([
          { key: knownUserInstance.elemID.getFullName(), value: expect.arrayContaining(['static1.nacl']) },
        ]),
      )
      expect(staticFilesIndex.setAll).toHaveBeenCalledWith(
        expect.arrayContaining([
          { key: knownUserSecondInstance.elemID.getFullName(), value: expect.arrayContaining(['static2.nacl']) },
        ]),
      )
      expect(staticFilesIndex.deleteAll).toHaveBeenCalledWith([
        object.elemID.getFullName(),
        unKnownUserInstance.elemID.getFullName(),
      ])
    })
  })

  describe('invalid indexes', () => {
    describe('When cache is invalid', () => {
      beforeEach(async () => {
        await updateReferencedStaticFilesIndex(
          // all elements will be considered as new when cache is invalid
          [
            toChange({ after: knownUserInstance }),
            toChange({ after: unKnownUserInstance }),
            toChange({ after: object }),
          ],
          staticFilesIndex,
          mapVersions,
          elementsSource,
          false,
        )
      })
      it('should update changed by index with all additions', () => {
        expect(staticFilesIndex.clear).toHaveBeenCalled()
        expect(staticFilesIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([
            { key: knownUserInstance.elemID.getFullName(), value: expect.arrayContaining(['static1.nacl']) },
          ]),
        )
        expect(staticFilesIndex.deleteAll).toHaveBeenCalledWith([
          unKnownUserInstance.elemID.getFullName(),
          object.elemID.getFullName(),
        ])
      })
    })

    describe('When indexes are out of date', () => {
      beforeEach(async () => {
        await elementsSource.set(knownUserInstance)
        await elementsSource.set(unKnownUserInstance)
        await elementsSource.set(object)
        mapVersions.get.mockResolvedValue(0)
        await updateReferencedStaticFilesIndex([], staticFilesIndex, mapVersions, elementsSource, true)
      })
      it('should update changed by index using the element source', () => {
        expect(staticFilesIndex.clear).toHaveBeenCalled()
        expect(staticFilesIndex.setAll).toHaveBeenCalledWith(
          expect.arrayContaining([
            { key: knownUserInstance.elemID.getFullName(), value: expect.arrayContaining(['static1.nacl']) },
          ]),
        )
        expect(staticFilesIndex.deleteAll).toHaveBeenCalledWith([
          object.elemID.getFullName(),
          unKnownUserInstance.elemID.getFullName(),
        ])
      })
    })
  })
})
