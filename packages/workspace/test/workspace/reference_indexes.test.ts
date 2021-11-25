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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { REFERENCE_INDEXES_VERSION, updateReferenceIndexes } from '../../src/workspace/reference_indexes'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { RemoteMap } from '../../src/workspace/remote_map'

const createMockRemoteMap = <T>(): MockInterface<RemoteMap<T>> => ({
  delete: mockFunction<RemoteMap<T>['delete']>(),
  get: mockFunction<RemoteMap<T>['get']>(),
  getMany: mockFunction<RemoteMap<T>['getMany']>(),
  has: mockFunction<RemoteMap<T>['has']>(),
  set: mockFunction<RemoteMap<T>['set']>(),
  setAll: mockFunction<RemoteMap<T>['setAll']>(),
  deleteAll: mockFunction<RemoteMap<T>['deleteAll']>(),
  entries: mockFunction<RemoteMap<T>['entries']>(),
  keys: mockFunction<RemoteMap<T>['keys']>(),
  values: mockFunction<RemoteMap<T>['values']>(),
  flush: mockFunction<RemoteMap<T>['flush']>(),
  revert: mockFunction<RemoteMap<T>['revert']>(),
  clear: mockFunction<RemoteMap<T>['clear']>(),
  close: mockFunction<RemoteMap<T>['close']>(),
  isEmpty: mockFunction<RemoteMap<T>['isEmpty']>(),
})

describe('updateReferenceIndexes', () => {
  let referenceTargetsIndex: MockInterface<RemoteMap<ElemID[]>>
  let referenceSourcesIndex: MockInterface<RemoteMap<ElemID[]>>
  let mapVersions: MockInterface<RemoteMap<number>>
  let elementsSource: ElementsSource
  let object: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    referenceTargetsIndex = createMockRemoteMap<ElemID[]>()

    referenceSourcesIndex = createMockRemoteMap<ElemID[]>()
    referenceSourcesIndex.getMany.mockResolvedValue([])

    mapVersions = createMockRemoteMap<number>()
    mapVersions.get.mockResolvedValue(REFERENCE_INDEXES_VERSION)

    elementsSource = createInMemoryElementSource()

    object = new ObjectType({
      elemID: new ElemID('test', 'object'),
      annotations: {
        typeRef: new ReferenceExpression(new ElemID('test', 'target1')),
        inner: {
          innerTypeRef: new ReferenceExpression(new ElemID('test', 'target1', 'attr', 'someAttr')),
        },
      },
      fields: {
        someField: {
          refType: BuiltinTypes.STRING,
          annotations: { fieldRef: new ReferenceExpression(new ElemID('test', 'target2')) },
        },
        fieldWithRefToType: {
          refType: BuiltinTypes.STRING,
          annotations: { fieldRef: new ReferenceExpression(new ElemID('test', 'object')) },
        },
      },
    })

    instance = new InstanceElement(
      'instance',
      object,
      { someValue: new ReferenceExpression(new ElemID('test', 'target2', 'instance', 'someInstance')) },
      undefined,
      { someAnnotation: new ReferenceExpression(new ElemID('test', 'target2', 'field', 'someField', 'value')) },
    )
  })

  describe('when got new elements', () => {
    beforeEach(async () => {
      const changes = [toChange({ after: instance }), toChange({ after: object })]
      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true
      )
    })
    it('should add the new references to the referenceTargets index', () => {
      expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([{
        key: 'test.object.instance.instance',
        value: [
          new ElemID('test', 'target2', 'field', 'someField', 'value'),
          new ElemID('test', 'target2', 'instance', 'someInstance'),
        ],
      },
      {
        key: 'test.object.field.someField',
        value: [
          new ElemID('test', 'target2'),
        ],
      },
      {
        key: 'test.object.field.fieldWithRefToType',
        value: [
          new ElemID('test', 'object'),
        ],
      },
      {
        key: 'test.object',
        value: [
          new ElemID('test', 'target1'),
          new ElemID('test', 'target1', 'attr', 'someAttr'),
          new ElemID('test', 'target2'),
          new ElemID('test', 'object'),
        ],
      }])
    })

    it('should add the new references to the referenceSources index', () => {
      expect(referenceSourcesIndex.setAll).toHaveBeenCalledWith([
        {
          key: 'test.target2.field.someField',
          value: [
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
          ],
        },
        {
          key: 'test.target2.instance.someInstance',
          value: [
            new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
          ],
        },
        {
          key: 'test.target1',
          value: [
            new ElemID('test', 'object', 'attr', 'typeRef'),
            new ElemID('test', 'object', 'attr', 'inner', 'innerTypeRef'),
          ],
        },
        {
          key: 'test.target2',
          value: [
            new ElemID('test', 'object', 'field', 'someField', 'fieldRef'),
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
          ],
        },
        {
          key: 'test.object',
          value: [
            new ElemID('test', 'object', 'field', 'fieldWithRefToType', 'fieldRef'),
          ],
        },
      ])
    })
  })

  describe('when elements were modified', () => {
    beforeEach(async () => {
      const instanceAfter = instance.clone()
      delete instanceAfter.annotations.someAnnotation
      instanceAfter.annotations.someAnnotation2 = new ReferenceExpression(new ElemID('test', 'target2', 'instance', 'someInstance', 'value'))
      const changes = [toChange({ before: instance, after: instanceAfter })]
      referenceTargetsIndex.getMany.mockImplementation(async ids => ids.map(id => (
        instanceAfter.elemID.getFullName() === id
          ? [
            new ElemID('test', 'target2', 'instance', 'someInstance'),
            new ElemID('test', 'target2', 'field', 'someField', 'value'),
          ]
          : undefined
      )))

      referenceSourcesIndex.getMany.mockImplementation(async ids => ids.map(id => {
        if (id === 'test.target2.field.someField') {
          return [
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
          ]
        }

        if (id === 'test.target2.instance.someInstance') {
          return [
            new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
          ]
        }
        return undefined
      }))

      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true
      )
    })

    it('old values should be removed and new values should be added from referenceTargets index', () => {
      expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([{
        key: 'test.object.instance.instance',
        value: [
          new ElemID('test', 'target2', 'instance', 'someInstance', 'value'),
          new ElemID('test', 'target2', 'instance', 'someInstance'),
        ],
      }])
    })

    it('should add the new references to referenceSources index', () => {
      expect(referenceSourcesIndex.setAll).toHaveBeenCalledWith([{
        key: 'test.target2.instance.someInstance',
        value: [
          new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation2'),
          new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
        ],
      }])
    })

    it('should remove old references from referenceSources index', () => {
      expect(referenceSourcesIndex.deleteAll).toHaveBeenCalledWith([
        'test.target2.field.someField',
        'test.target2',
      ])
    })
  })

  describe('when a field was deleted', () => {
    beforeEach(async () => {
      const objectAfter = object.clone()
      delete objectAfter.fields.someField

      const changes = [toChange({ before: object, after: objectAfter })]

      referenceSourcesIndex.getMany.mockImplementation(async ids => ids.map(id => {
        if (id === 'test.target2') {
          return [
            new ElemID('test', 'object', 'field', 'someField', 'fieldRef'),
          ]
        }

        return undefined
      }))

      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true
      )
    })

    it('should remove the references from the referenceTargets index', () => {
      expect(referenceTargetsIndex.deleteAll).toHaveBeenCalledWith([
        'test.object.field.someField',
      ])
    })

    it('should remove the references from the referenceSources index', () => {
      expect(referenceSourcesIndex.deleteAll).toHaveBeenCalledWith([
        'test.target2',
      ])
    })
  })

  describe('when elements were removed', () => {
    beforeEach(async () => {
      const changes = [toChange({ before: instance })]
      referenceTargetsIndex.getMany.mockImplementation(async ids => ids.map(id => (
        instance.elemID.getFullName() === id
          ? [
            new ElemID('test', 'target2', 'instance', 'someInstance'),
            new ElemID('test', 'target2', 'field', 'someField', 'value'),
          ]
          : undefined
      )))

      referenceSourcesIndex.getMany.mockImplementation(async ids => ids.map(id => {
        if (id === 'test.target2.field.someField') {
          return [
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
          ]
        }

        if (id === 'test.target2.instance.someInstance') {
          return [
            new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
          ]
        }
        return undefined
      }))

      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true
      )
    })

    it('should remove the references from the referenceTargets index', () => {
      expect(referenceTargetsIndex.deleteAll).toHaveBeenCalledWith([
        'test.object.instance.instance',
      ])
    })

    it('should remove the references from the referenceSources index', () => {
      expect(referenceSourcesIndex.deleteAll).toHaveBeenCalledWith([
        'test.target2.field.someField',
        'test.target2.instance.someInstance',
        'test.target2',
      ])
    })
  })

  describe('invalid indexes', () => {
    describe('When cache is invalid', () => {
      beforeEach(async () => {
        await updateReferenceIndexes(
          [toChange({ after: instance })],
          referenceTargetsIndex,
          referenceSourcesIndex,
          mapVersions,
          elementsSource,
          false
        )
      })
      it('should update referenceTargets index using the element source', () => {
        expect(referenceTargetsIndex.clear).toHaveBeenCalled()
        expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([{
          key: 'test.object.instance.instance',
          value: [
            new ElemID('test', 'target2', 'field', 'someField', 'value'),
            new ElemID('test', 'target2', 'instance', 'someInstance'),
          ],
        }])
      })

      it('should update referenceSources index using the element source', () => {
        expect(referenceSourcesIndex.clear).toHaveBeenCalled()
        expect(referenceSourcesIndex.setAll).toHaveBeenCalledWith([
          {
            key: 'test.target2.field.someField',
            value: [
              new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
            ],
          }, {
            key: 'test.target2.instance.someInstance',
            value: [
              new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
            ],
          }, {
            key: 'test.target2',
            value: [
              new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
            ],
          }])
      })
    })

    describe('When indexes are out of date', () => {
      beforeEach(async () => {
        await elementsSource.set(instance)
        mapVersions.get.mockResolvedValue(0)
        await updateReferenceIndexes(
          [],
          referenceTargetsIndex,
          referenceSourcesIndex,
          mapVersions,
          elementsSource,
          true
        )
      })
      it('should update referenceTargets index using the element source', () => {
        expect(referenceTargetsIndex.clear).toHaveBeenCalled()
        expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([{
          key: 'test.object.instance.instance',
          value: [
            new ElemID('test', 'target2', 'field', 'someField', 'value'),
            new ElemID('test', 'target2', 'instance', 'someInstance'),
          ],
        }])
      })

      it('should update referenceSources index using the element source', () => {
        expect(referenceSourcesIndex.clear).toHaveBeenCalled()
        expect(referenceSourcesIndex.setAll).toHaveBeenCalledWith([{
          key: 'test.target2.field.someField',
          value: [
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
          ],
        }, {
          key: 'test.target2.instance.someInstance',
          value: [
            new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
          ],
        }, {
          key: 'test.target2',
          value: [
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
          ],
        }])
      })
    })
  })
})
