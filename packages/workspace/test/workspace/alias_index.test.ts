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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { RemoteMap } from '../../src/workspace/remote_map'
import { createMockRemoteMap } from '../utils'
import { ALIAS_INDEX_VERSION, updateAliasIndex } from '../../src/workspace/alias_index'

describe('alias index', () => {
  let aliasIndex: MockInterface<RemoteMap<string>>
  let mapVersions: MockInterface<RemoteMap<number>>
  let elementsSource: ElementsSource

  const objectToDelete = new ObjectType({
    elemID: new ElemID('test', 'object3'),
    annotations: {
      _alias: 'object alias',
    },
    fields: {
      fieldWithAnnotation: {
        annotations: {
          _alias: 'field alias',
        },
        refType: BuiltinTypes.STRING,
      },
      fieldNoAlias: {
        annotations: {},
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const objectWithAnnotation = new ObjectType({
    elemID: new ElemID('test', 'object'),
    annotations: {
      _alias: 'object alias',
    },
    fields: {
      fieldWithAlias: {
        annotations: {
          _alias: 'field alias',
        },
        refType: BuiltinTypes.STRING,
      },
      fieldNoAlias: {
        annotations: {},
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const objectWithAnnotationBefore = new ObjectType({
    elemID: new ElemID('test', 'object2'),
    annotations: {
      _alias: 'object alias',
    },
    fields: {
      fieldWithAnnotation: {
        annotations: {
          _alias: 'field alias',
        },
        refType: BuiltinTypes.STRING,
      },
      fieldNoAlias: {
        annotations: {},
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const objectWithAnnotationAfter = new ObjectType({
    elemID: new ElemID('test', 'object2'),
    annotations: {
      _alias: 'object2 alias',
    },
    fields: {
      fieldWithAnnotation: {
        annotations: {
          _alias: 'field2 alias',
        },
        refType: BuiltinTypes.STRING,
      },
      fieldNoAliasNew: {
        annotations: {},
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const settingInstanceNoAlias = new InstanceElement(ElemID.CONFIG_NAME, objectWithAnnotation, {})
  const firstInstanceWithAlias = new InstanceElement('instance1', objectWithAnnotation, {}, undefined, {
    _alias: 'instance alias',
  })
  const secondInstanceNoAlias = new InstanceElement('instance2', objectWithAnnotation, {}, undefined, {})
  const thirdInstance = new InstanceElement('instance3', objectWithAnnotation, {}, undefined, {})
  const fourthInstanceBefore = new InstanceElement('instance4', objectWithAnnotation, {}, undefined, {})
  const fourthInstanceAfter = new InstanceElement('instance4', objectWithAnnotation, {}, undefined, {
    _alias: 'new alias',
  })
  const fifthInstanceBefore = new InstanceElement('instance5', objectWithAnnotation, {}, undefined, {
    _alias: 'alias before',
  })
  const fifthInstanceAfter = new InstanceElement('instance5', objectWithAnnotation, {}, undefined, {
    _alias: 'alias after',
  })
  const sixthInstanceBefore = new InstanceElement('instance6', objectWithAnnotation, {}, undefined, {
    _alias: 'alias before',
  })
  const sixthInstanceAfter = new InstanceElement('instance6', objectWithAnnotation, {}, undefined, {})

  beforeEach(() => {
    jest.resetAllMocks()
    aliasIndex = createMockRemoteMap<string>()
    mapVersions = createMockRemoteMap<number>()
    mapVersions.get.mockResolvedValue(ALIAS_INDEX_VERSION)
    elementsSource = createInMemoryElementSource()
  })
  describe('mixed changes', () => {
    beforeEach(async () => {
      const changes = [
        toChange({ after: firstInstanceWithAlias }), // inst addition with alias
        toChange({ after: settingInstanceNoAlias }), // setting instance no alias
        toChange({ after: secondInstanceNoAlias }), // inst addition no alias
        toChange({ before: thirdInstance, after: thirdInstance }), // no change in alias
        toChange({ after: objectWithAnnotation }), // add obj with alias and alias on some fields
        // obj with modification of alias
        toChange({ before: objectWithAnnotationBefore, after: objectWithAnnotationAfter }),
        toChange({ before: objectToDelete }), // removal of obj
        toChange({ before: fifthInstanceBefore, after: fifthInstanceAfter }), // modification change of alias
        toChange({ before: fourthInstanceBefore, after: fourthInstanceAfter }), // modification to add alias
        toChange({ before: sixthInstanceBefore, after: sixthInstanceAfter }), // modification to remove alias
      ]
      await updateAliasIndex(changes, aliasIndex, mapVersions, elementsSource, true)
    })
    it('should add all addition and alias modification elements to index', () => {
      expect(aliasIndex.setAll).toHaveBeenCalledWith([
        { key: firstInstanceWithAlias.elemID.getFullName(), value: 'instance alias' },
        { key: objectWithAnnotation.fields.fieldWithAlias.elemID.getFullName(), value: 'field alias' },
        { key: objectWithAnnotation.elemID.getFullName(), value: 'object alias' },
        { key: objectWithAnnotationAfter.fields.fieldWithAnnotation.elemID.getFullName(), value: 'field2 alias' },
        { key: objectWithAnnotationAfter.elemID.getFullName(), value: 'object2 alias' },
        { key: fifthInstanceAfter.elemID.getFullName(), value: 'alias after' },
        { key: fourthInstanceAfter.elemID.getFullName(), value: 'new alias' },
      ])
      expect(aliasIndex.deleteAll).toHaveBeenCalledWith([
        objectToDelete.elemID.getFullName(),
        ...Object.values(objectToDelete.fields).map(field => field.elemID.getFullName()),
        sixthInstanceAfter.elemID.getFullName(),
      ])
    })
  })

  describe('invalid indexes', () => {
    describe('When cache is invalid', () => {
      beforeEach(async () => {
        await updateAliasIndex(
          // all elements will be considered as new when cache is invalid
          [
            toChange({ after: firstInstanceWithAlias }),
            toChange({ after: secondInstanceNoAlias }),
            toChange({ after: objectWithAnnotation }),
          ],
          aliasIndex,
          mapVersions,
          elementsSource,
          false,
        )
      })
      it('should update alias index with all additions', () => {
        expect(aliasIndex.clear).toHaveBeenCalled()
        expect(aliasIndex.setAll).toHaveBeenCalledWith([
          { key: firstInstanceWithAlias.elemID.getFullName(), value: 'instance alias' },
          { key: objectWithAnnotation.fields.fieldWithAlias.elemID.getFullName(), value: 'field alias' },
          { key: objectWithAnnotation.elemID.getFullName(), value: 'object alias' },
        ])
        expect(aliasIndex.deleteAll).toHaveBeenCalledWith([])
      })
    })

    describe('When indexes are out of date', () => {
      beforeEach(async () => {
        await elementsSource.set(firstInstanceWithAlias)
        await elementsSource.set(secondInstanceNoAlias)
        await elementsSource.set(objectWithAnnotation)
        mapVersions.get.mockResolvedValue(0)
        await updateAliasIndex([], aliasIndex, mapVersions, elementsSource, true)
      })
      it('should update alias index using the element source', () => {
        expect(aliasIndex.clear).toHaveBeenCalled()
        expect(aliasIndex.setAll).toHaveBeenCalledWith([
          { key: objectWithAnnotation.fields.fieldWithAlias.elemID.getFullName(), value: 'field alias' },
          { key: objectWithAnnotation.elemID.getFullName(), value: 'object alias' },
          { key: firstInstanceWithAlias.elemID.getFullName(), value: 'instance alias' },
        ])
      })
    })
  })
})
