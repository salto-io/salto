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
  let referencesIndex: MockInterface<RemoteMap<ElemID[]>>
  let referencedByIndex: MockInterface<RemoteMap<ElemID[]>>
  let mapsVersions: MockInterface<RemoteMap<number>>
  let elementsSource: ElementsSource
  let object: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    referencesIndex = createMockRemoteMap<ElemID[]>()

    referencedByIndex = createMockRemoteMap<ElemID[]>()
    referencedByIndex.get.mockResolvedValue([])

    mapsVersions = createMockRemoteMap<number>()
    mapsVersions.get.mockResolvedValue(REFERENCE_INDEXES_VERSION)

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
        referencesIndex,
        referencedByIndex,
        mapsVersions,
        elementsSource,
        true
      )
    })
    it('should update references index correctly', () => {
      expect(referencesIndex.set).toHaveBeenCalledWith(
        'test.object.instance.instance',
        [
          new ElemID('test', 'target2', 'field', 'someField', 'value'),
          new ElemID('test', 'target2', 'instance', 'someInstance'),
        ]
      )

      expect(referencesIndex.set).toHaveBeenCalledWith(
        'test.object',
        [
          new ElemID('test', 'target1'),
          new ElemID('test', 'target1', 'attr', 'someAttr'),
          new ElemID('test', 'target2'),
        ]
      )

      expect(referencesIndex.set).toHaveBeenCalledWith(
        'test.object.field.someField',
        [
          new ElemID('test', 'target2'),
        ]
      )
    })

    it('should update referencedBy index correctly', () => {
      expect(referencedByIndex.set).toHaveBeenCalledWith(
        'test.target1',
        [
          new ElemID('test', 'object', 'attr', 'typeRef'),
          new ElemID('test', 'object', 'attr', 'inner', 'innerTypeRef'),
        ]
      )

      expect(referencedByIndex.set).toHaveBeenCalledWith(
        'test.target2',
        [
          new ElemID('test', 'object', 'field', 'someField', 'fieldRef'),
          new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
        ]
      )

      expect(referencedByIndex.set).toHaveBeenCalledWith(
        'test.target2.instance.someInstance',
        [
          new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
        ]
      )

      expect(referencedByIndex.set).toHaveBeenCalledWith(
        'test.target2.field.someField',
        [
          new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
        ]
      )
    })
  })

  describe('when elements were modified', () => {
    beforeEach(async () => {
      const instanceAfter = instance.clone()
      delete instanceAfter.annotations.someAnnotation
      instanceAfter.annotations.someAnnotation2 = new ReferenceExpression(new ElemID('test', 'target2', 'instance', 'someInstance', 'value'))
      const changes = [toChange({ before: instance, after: instanceAfter })]
      referencesIndex.get.mockImplementation(async id => (
        instanceAfter.elemID.getFullName() === id
          ? [
            new ElemID('test', 'target2', 'instance', 'someInstance'),
            new ElemID('test', 'target2', 'field', 'someField', 'value'),
          ]
          : undefined
      ))

      referencedByIndex.get.mockImplementation(async id => {
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
      })

      await updateReferenceIndexes(
        changes,
        referencesIndex,
        referencedByIndex,
        mapsVersions,
        elementsSource,
        true
      )
    })

    it('should update references index correctly', () => {
      expect(referencesIndex.set).toHaveBeenCalledWith(
        'test.object.instance.instance',
        [
          new ElemID('test', 'target2', 'instance', 'someInstance', 'value'),
          new ElemID('test', 'target2', 'instance', 'someInstance'),
        ]
      )
    })

    it('should update referencedBy index correctly', () => {
      expect(referencedByIndex.set).toHaveBeenCalledWith(
        'test.target2.instance.someInstance',
        [
          new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation2'),
          new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
        ]
      )

      expect(referencedByIndex.delete).toHaveBeenCalledWith(
        'test.target2.field.someField',
      )

      expect(referencedByIndex.delete).toHaveBeenCalledWith(
        'test.target2',
      )
    })
  })

  describe('when elements were removed', () => {
    beforeEach(async () => {
      const changes = [toChange({ before: instance })]
      referencesIndex.get.mockImplementation(async id => (
        instance.elemID.getFullName() === id
          ? [
            new ElemID('test', 'target2', 'instance', 'someInstance'),
            new ElemID('test', 'target2', 'field', 'someField', 'value'),
          ]
          : undefined
      ))

      referencedByIndex.get.mockImplementation(async id => {
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
      })

      await updateReferenceIndexes(
        changes,
        referencesIndex,
        referencedByIndex,
        mapsVersions,
        elementsSource,
        true
      )
    })

    it('should update references index correctly', () => {
      expect(referencesIndex.delete).toHaveBeenCalledWith(
        'test.object.instance.instance',
      )
    })

    it('should update referencedBy index correctly', () => {
      expect(referencedByIndex.delete).toHaveBeenCalledWith(
        'test.target2.instance.someInstance',
      )

      expect(referencedByIndex.delete).toHaveBeenCalledWith(
        'test.target2.field.someField',
      )

      expect(referencedByIndex.delete).toHaveBeenCalledWith(
        'test.target2',
      )
    })
  })

  describe('invalid indexes', () => {
    describe('When cache is invalid', () => {
      beforeEach(async () => {
        await elementsSource.set(instance)
        await updateReferenceIndexes(
          [],
          referencesIndex,
          referencedByIndex,
          mapsVersions,
          elementsSource,
          false
        )
      })
      it('should update references index correctly', () => {
        expect(referencesIndex.set).toHaveBeenCalledWith(
          'test.object.instance.instance',
          [
            new ElemID('test', 'target2', 'field', 'someField', 'value'),
            new ElemID('test', 'target2', 'instance', 'someInstance'),
          ]
        )
      })

      it('should update referencedBy index correctly', () => {
        expect(referencedByIndex.set).toHaveBeenCalledWith(
          'test.target2.instance.someInstance',
          [
            new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
          ]
        )

        expect(referencedByIndex.set).toHaveBeenCalledWith(
          'test.target2.field.someField',
          [
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
          ]
        )
      })
    })

    describe('When indexes are out of date', () => {
      beforeEach(async () => {
        await elementsSource.set(instance)
        mapsVersions.get.mockResolvedValue(0)
        await updateReferenceIndexes(
          [],
          referencesIndex,
          referencedByIndex,
          mapsVersions,
          elementsSource,
          true
        )
      })
      it('should update references index correctly', () => {
        expect(referencesIndex.set).toHaveBeenCalledWith(
          'test.object.instance.instance',
          [
            new ElemID('test', 'target2', 'field', 'someField', 'value'),
            new ElemID('test', 'target2', 'instance', 'someInstance'),
          ]
        )
      })

      it('should update referencedBy index correctly', () => {
        expect(referencedByIndex.set).toHaveBeenCalledWith(
          'test.target2.instance.someInstance',
          [
            new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
          ]
        )

        expect(referencedByIndex.set).toHaveBeenCalledWith(
          'test.target2.field.someField',
          [
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
          ]
        )
      })
    })
  })
})
