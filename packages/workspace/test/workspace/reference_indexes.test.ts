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
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  TemplateExpression,
  toChange,
} from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { collections } from '@salto-io/lowerdash'
import { parserUtils } from '@salto-io/parser'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import {
  REFERENCE_INDEXES_VERSION,
  ReferenceTargetIndexValue,
  updateReferenceIndexes,
} from '../../src/workspace/reference_indexes'
import { createInMemoryElementSource, ElementsSource } from '../../src/workspace/elements_source'
import { RemoteMap } from '../../src/workspace/remote_map'
import { createMockRemoteMap } from '../utils'

describe('updateReferenceIndexes', () => {
  let referenceTargetsIndex: MockInterface<RemoteMap<ReferenceTargetIndexValue>>
  let referenceSourcesIndex: MockInterface<RemoteMap<ElemID[]>>
  let mapVersions: MockInterface<RemoteMap<number>>
  let elementsSource: ElementsSource
  let object: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    referenceTargetsIndex = createMockRemoteMap<ReferenceTargetIndexValue>()

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
        someTemplateField: {
          refType: BuiltinTypes.STRING,
          annotations: { fieldRef: new ReferenceExpression(new ElemID('test', 'target2')) },
        },
        anotherTemplateField: {
          refType: BuiltinTypes.STRING,
          annotations: { fieldRef: new ReferenceExpression(new ElemID('test', 'target2')) },
        },
        fieldWithRefToType: {
          refType: BuiltinTypes.STRING,
          annotations: { fieldRef: new ReferenceExpression(new ElemID('test', 'object')) },
        },
      },
    })

    const article = new InstanceElement('article', new ObjectType({ elemID: new ElemID('test', 'article') }), {})
    const macro1 = new InstanceElement('macro1', new ObjectType({ elemID: new ElemID('test', 'macro') }), {})

    instance = new InstanceElement(
      'instance',
      object,
      {
        someValue: new ReferenceExpression(new ElemID('test', 'target2', 'instance', 'someInstance')),
        templateValue: new TemplateExpression({
          parts: [
            'Template is:',
            new ReferenceExpression(new ElemID('test', 'target2', 'field', 'someTemplateField', 'value')),
            'here',
            new ReferenceExpression(new ElemID('test', 'target2', 'field', 'anotherTemplateField', 'value')),
          ],
        }),
        templateStaticFile: parserUtils.templateExpressionToStaticFile(
          createTemplateExpression({
            parts: [
              '"/hc/test/test/articles/',
              new ReferenceExpression(article.elemID, article),
              '\n/test "hc/test/test/articles/',
              new ReferenceExpression(macro1.elemID, macro1),
              '/test',
            ],
          }),
          'test',
        ),
      },
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
        true,
        async () => [],
      )
    })
    it('should add the new references to the referenceTargets index', () => {
      expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([
        {
          key: 'test.object.instance.instance',
          value: new collections.treeMap.TreeMap([
            ['someAnnotation', [{ id: new ElemID('test', 'target2', 'field', 'someField', 'value'), type: 'strong' }]],
            ['someValue', [{ id: new ElemID('test', 'target2', 'instance', 'someInstance'), type: 'strong' }]],
            [
              'templateValue',
              [
                { id: new ElemID('test', 'target2', 'field', 'someTemplateField', 'value'), type: 'strong' },
                { id: new ElemID('test', 'target2', 'field', 'anotherTemplateField', 'value'), type: 'strong' },
              ],
            ],
            [
              'templateStaticFile',
              [
                { id: new ElemID('test', 'article', 'instance', 'article'), type: 'strong' },
                { id: new ElemID('test', 'macro', 'instance', 'macro1'), type: 'strong' },
              ],
            ],
          ]),
        },
        {
          key: 'test.object.field.someField',
          value: new collections.treeMap.TreeMap([
            ['fieldRef', [{ id: new ElemID('test', 'target2'), type: 'strong' }]],
          ]),
        },
        {
          key: 'test.object.field.someTemplateField',
          value: new collections.treeMap.TreeMap([
            ['fieldRef', [{ id: new ElemID('test', 'target2'), type: 'strong' }]],
          ]),
        },
        {
          key: 'test.object.field.anotherTemplateField',
          value: new collections.treeMap.TreeMap([
            ['fieldRef', [{ id: new ElemID('test', 'target2'), type: 'strong' }]],
          ]),
        },
        {
          key: 'test.object.field.fieldWithRefToType',
          value: new collections.treeMap.TreeMap([
            ['fieldRef', [{ id: new ElemID('test', 'object'), type: 'strong' }]],
          ]),
        },
        {
          key: 'test.object',
          value: new collections.treeMap.TreeMap([
            ['typeRef', [{ id: new ElemID('test', 'target1'), type: 'strong' }]],
            ['inner.innerTypeRef', [{ id: new ElemID('test', 'target1', 'attr', 'someAttr'), type: 'strong' }]],
            ['', [{ id: new ElemID('test', 'target2'), type: 'strong' }]],
            ['', [{ id: new ElemID('test', 'target2'), type: 'strong' }]],
            ['', [{ id: new ElemID('test', 'target2'), type: 'strong' }]],
            ['', [{ id: new ElemID('test', 'object'), type: 'strong' }]],
          ]),
        },
      ])
    })

    it('should add the new references to the referenceSources index', () => {
      expect(referenceSourcesIndex.setAll).toHaveBeenCalledWith([
        {
          key: 'test.target2.field.someField',
          value: [new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation')],
        },
        {
          key: 'test.target2.instance.someInstance',
          value: [new ElemID('test', 'object', 'instance', 'instance', 'someValue')],
        },
        {
          key: 'test.target2.field.someTemplateField',
          value: [new ElemID('test', 'object', 'instance', 'instance', 'templateValue')],
        },
        {
          key: 'test.target2.field.anotherTemplateField',
          value: [new ElemID('test', 'object', 'instance', 'instance', 'templateValue')],
        },
        {
          key: 'test.article.instance.article',
          value: [new ElemID('test', 'object', 'instance', 'instance', 'templateStaticFile')],
        },
        {
          key: 'test.macro.instance.macro1',
          value: [new ElemID('test', 'object', 'instance', 'instance', 'templateStaticFile')],
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
            new ElemID('test', 'object', 'field', 'someTemplateField', 'fieldRef'),
            new ElemID('test', 'object', 'field', 'anotherTemplateField', 'fieldRef'),
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
            new ElemID('test', 'object', 'instance', 'instance', 'templateValue'),
          ],
        },
        {
          key: 'test.object',
          value: [new ElemID('test', 'object', 'field', 'fieldWithRefToType', 'fieldRef')],
        },
      ])
    })
  })

  describe('when elements were modified', () => {
    beforeEach(async () => {
      const instanceAfter = instance.clone()
      delete instanceAfter.annotations.someAnnotation
      delete instanceAfter.value.templateValue
      delete instanceAfter.value.templateStaticFile

      instanceAfter.annotations.someAnnotation2 = new ReferenceExpression(
        new ElemID('test', 'target2', 'instance', 'someInstance', 'value'),
      )
      const changes = [toChange({ before: instance, after: instanceAfter })]

      referenceSourcesIndex.getMany.mockImplementation(async ids =>
        ids.map(id => {
          if (id === 'test.target2.field.someField') {
            return [new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation')]
          }

          if (id === 'test.target2.instance.someInstance') {
            return [new ElemID('test', 'object', 'instance', 'instance', 'someValue')]
          }
          if (id === 'test.target2.field.someTemplateField') {
            return [new ElemID('test', 'object', 'instance', 'instance', 'templateValue')]
          }
          if (id === 'test.target2.field.anotherTemplateField') {
            return [new ElemID('test', 'object', 'instance', 'instance', 'templateValue')]
          }
          return undefined
        }),
      )

      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true,
        async () => [],
      )
    })
    it('old values should be removed and new values should be added from referenceTargets index', () => {
      expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([
        {
          key: 'test.object.instance.instance',
          value: new collections.treeMap.TreeMap([
            [
              'someAnnotation2',
              [{ id: new ElemID('test', 'target2', 'instance', 'someInstance', 'value'), type: 'strong' }],
            ],
            ['someValue', [{ id: new ElemID('test', 'target2', 'instance', 'someInstance'), type: 'strong' }]],
          ]),
        },
      ])
    })

    it('should add the new references to referenceSources index', () => {
      expect(referenceSourcesIndex.setAll).toHaveBeenCalledWith([
        {
          key: 'test.target2.instance.someInstance',
          value: [
            new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation2'),
            new ElemID('test', 'object', 'instance', 'instance', 'someValue'),
          ],
        },
      ])
    })

    it('should remove old references from referenceSources index', () => {
      expect(referenceSourcesIndex.deleteAll).toHaveBeenCalledWith([
        'test.target2.field.someField',
        'test.target2.field.someTemplateField',
        'test.target2.field.anotherTemplateField',
        'test.article.instance.article',
        'test.macro.instance.macro1',
        'test.target2',
      ])
    })
  })

  describe('when a field was deleted', () => {
    beforeEach(async () => {
      const objectAfter = object.clone()
      delete objectAfter.fields.someField
      delete objectAfter.fields.someTemplateField
      delete objectAfter.fields.anotherTemplateField

      const changes = [toChange({ before: object, after: objectAfter })]

      referenceSourcesIndex.getMany.mockImplementation(async ids =>
        ids.map(id => {
          if (id === 'test.target2') {
            return [new ElemID('test', 'object', 'field', 'someField', 'fieldRef')]
          }

          return undefined
        }),
      )

      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true,
        async () => [],
      )
    })
    it('should set the new tree in the referenceTargets index', () => {
      expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([
        {
          key: 'test.object.field.fieldWithRefToType',
          value: new collections.treeMap.TreeMap([
            ['fieldRef', [{ id: new ElemID('test', 'object'), type: 'strong' }]],
          ]),
        },
        {
          key: 'test.object',
          value: new collections.treeMap.TreeMap([
            ['typeRef', [{ id: new ElemID('test', 'target1'), type: 'strong' }]],
            ['inner.innerTypeRef', [{ id: new ElemID('test', 'target1', 'attr', 'someAttr'), type: 'strong' }]],
            ['', [{ id: new ElemID('test', 'object'), type: 'strong' }]],
          ]),
        },
      ])
      expect(referenceTargetsIndex.deleteAll).toHaveBeenCalledWith([
        'test.object.field.someField',
        'test.object.field.someTemplateField',
        'test.object.field.anotherTemplateField',
      ])
    })

    it('should remove the references from the referenceSources index', () => {
      expect(referenceSourcesIndex.deleteAll).toHaveBeenCalledWith(['test.target2'])
    })
  })

  describe('when elements were removed', () => {
    beforeEach(async () => {
      const changes = [toChange({ before: instance }), toChange({ before: object })]

      referenceSourcesIndex.getMany.mockImplementation(async ids =>
        ids.map(id => {
          if (id === 'test.target2.field.someField') {
            return [new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation')]
          }

          if (id === 'test.target2.instance.someInstance') {
            return [new ElemID('test', 'object', 'instance', 'instance', 'someValue')]
          }
          return undefined
        }),
      )

      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true,
        async () => [],
      )
    })

    it('should remove the references from the referenceTargets index', () => {
      expect(referenceTargetsIndex.deleteAll).toHaveBeenCalledWith([
        'test.object.instance.instance',
        'test.object.field.someField',
        'test.object.field.someTemplateField',
        'test.object.field.anotherTemplateField',
        'test.object.field.fieldWithRefToType',
        'test.object',
      ])
    })

    it('should remove the references from the referenceSources index', () => {
      expect(referenceSourcesIndex.deleteAll).toHaveBeenCalledWith([
        'test.target2.field.someField',
        'test.target2.instance.someInstance',
        'test.target2.field.someTemplateField',
        'test.target2.field.anotherTemplateField',
        'test.article.instance.article',
        'test.macro.instance.macro1',
        'test.target1',
        'test.target2',
        'test.object',
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
          false,
          async () => [],
        )
      })
      it('should update referenceTargets index using the element source', () => {
        expect(referenceTargetsIndex.clear).toHaveBeenCalled()
        expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([
          {
            key: 'test.object.instance.instance',
            value: new collections.treeMap.TreeMap([
              [
                'someAnnotation',
                [{ id: new ElemID('test', 'target2', 'field', 'someField', 'value'), type: 'strong' }],
              ],
              ['someValue', [{ id: new ElemID('test', 'target2', 'instance', 'someInstance'), type: 'strong' }]],
              [
                'templateValue',
                [
                  { id: new ElemID('test', 'target2', 'field', 'someTemplateField', 'value'), type: 'strong' },
                  { id: new ElemID('test', 'target2', 'field', 'anotherTemplateField', 'value'), type: 'strong' },
                ],
              ],
              [
                'templateStaticFile',
                [
                  { id: new ElemID('test', 'article', 'instance', 'article'), type: 'strong' },
                  { id: new ElemID('test', 'macro', 'instance', 'macro1'), type: 'strong' },
                ],
              ],
            ]),
          },
        ])
      })

      it('should update referenceSources index using the element source', () => {
        expect(referenceSourcesIndex.clear).toHaveBeenCalled()
        expect(referenceSourcesIndex.setAll).toHaveBeenCalledWith([
          {
            key: 'test.target2.field.someField',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation')],
          },
          {
            key: 'test.target2.instance.someInstance',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'someValue')],
          },
          {
            key: 'test.target2.field.someTemplateField',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'templateValue')],
          },
          {
            key: 'test.target2.field.anotherTemplateField',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'templateValue')],
          },
          {
            key: 'test.article.instance.article',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'templateStaticFile')],
          },
          {
            key: 'test.macro.instance.macro1',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'templateStaticFile')],
          },
          {
            key: 'test.target2',
            value: [
              new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
              new ElemID('test', 'object', 'instance', 'instance', 'templateValue'),
            ],
          },
        ])
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
          true,
          async () => [],
        )
      })
      it('should update referenceTargets index using the element source', () => {
        expect(referenceTargetsIndex.clear).toHaveBeenCalled()
        expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([
          {
            key: 'test.object.instance.instance',
            value: new collections.treeMap.TreeMap([
              [
                'someAnnotation',
                [{ id: new ElemID('test', 'target2', 'field', 'someField', 'value'), type: 'strong' }],
              ],
              ['someValue', [{ id: new ElemID('test', 'target2', 'instance', 'someInstance'), type: 'strong' }]],
              [
                'templateValue',
                [
                  { id: new ElemID('test', 'target2', 'field', 'someTemplateField', 'value'), type: 'strong' },
                  { id: new ElemID('test', 'target2', 'field', 'anotherTemplateField', 'value'), type: 'strong' },
                ],
              ],
              [
                'templateStaticFile',
                [
                  { id: new ElemID('test', 'article', 'instance', 'article'), type: 'strong' },
                  { id: new ElemID('test', 'macro', 'instance', 'macro1'), type: 'strong' },
                ],
              ],
            ]),
          },
        ])
      })

      it('should update referenceSources index using the element source', () => {
        expect(referenceSourcesIndex.clear).toHaveBeenCalled()
        expect(referenceSourcesIndex.setAll).toHaveBeenCalledWith([
          {
            key: 'test.target2.field.someField',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation')],
          },
          {
            key: 'test.target2.instance.someInstance',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'someValue')],
          },
          {
            key: 'test.target2.field.someTemplateField',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'templateValue')],
          },
          {
            key: 'test.target2.field.anotherTemplateField',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'templateValue')],
          },
          {
            key: 'test.article.instance.article',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'templateStaticFile')],
          },
          {
            key: 'test.macro.instance.macro1',
            value: [new ElemID('test', 'object', 'instance', 'instance', 'templateStaticFile')],
          },
          {
            key: 'test.target2',
            value: [
              new ElemID('test', 'object', 'instance', 'instance', 'someAnnotation'),
              new ElemID('test', 'object', 'instance', 'instance', 'templateValue'),
            ],
          },
        ])
      })
    })
  })

  describe('getCustomReferences additions', () => {
    beforeEach(async () => {
      const inst = new InstanceElement('instance', object, {
        val1: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'someInstance1')),
        val2: new ReferenceExpression(new ElemID('test', 'type', 'instance', 'someInstance2')),
        val3: 'string',
      })
      const changes = [toChange({ after: inst })]
      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true,
        async elements =>
          elements.length !== 0
            ? [
                {
                  source: inst.elemID.createNestedID('val2'),
                  target: new ElemID('test', 'type', 'instance', 'someInstance2'),
                  type: 'weak',
                },
                {
                  source: inst.elemID.createNestedID('val3'),
                  target: new ElemID('test', 'type', 'instance', 'someInstance3'),
                  type: 'weak',
                },
              ]
            : [],
      )
    })
    it('should override the default references with the custom references', () => {
      expect(referenceTargetsIndex.setAll).toHaveBeenCalledWith([
        {
          key: 'test.object.instance.instance',
          value: new collections.treeMap.TreeMap([
            ['val1', [{ id: new ElemID('test', 'type', 'instance', 'someInstance1'), type: 'strong' }]],
            ['val2', [{ id: new ElemID('test', 'type', 'instance', 'someInstance2'), type: 'weak' }]],
            ['val3', [{ id: new ElemID('test', 'type', 'instance', 'someInstance3'), type: 'weak' }]],
          ]),
        },
      ])
    })
  })

  describe('getCustomReferences removals', () => {
    beforeEach(async () => {
      const inst = new InstanceElement('instance', object, {
        val1: 'string',
      })
      const changes = [toChange({ before: inst })]
      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true,
        async () => [
          {
            source: inst.elemID.createNestedID('val1'),
            target: new ElemID('test', 'type', 'instance', 'someInstance1'),
            type: 'weak',
          },
        ],
      )
    })
    it('should override the default references with the custom references', () => {
      expect(referenceTargetsIndex.deleteAll).toHaveBeenCalledWith(['test.object.instance.instance'])
    })
  })

  describe('getCustomReferences modifications', () => {
    beforeEach(async () => {
      const instBefore = new InstanceElement('instance', object, {
        val1: 'string',
      })

      const instAfter = new InstanceElement('instance', object)
      const changes = [toChange({ before: instBefore, after: instAfter })]

      await updateReferenceIndexes(
        changes,
        referenceTargetsIndex,
        referenceSourcesIndex,
        mapVersions,
        elementsSource,
        true,
        async elements =>
          (elements[0] as InstanceElement).value.val1 !== undefined
            ? [
                {
                  source: instBefore.elemID.createNestedID('val1'),
                  target: new ElemID('test', 'type', 'instance', 'someInstance1'),
                  type: 'weak',
                },
              ]
            : [],
      )
    })
    it('should remove the removed custom references', () => {
      expect(referenceTargetsIndex.deleteAll).toHaveBeenCalledWith(['test.object.instance.instance'])
    })
  })
})
