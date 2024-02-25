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
  ObjectType,
  ElemID,
  InstanceElement,
  ReferenceExpression,
  TemplateExpression,
  BuiltinTypes,
  toChange,
  ListType,
} from '@salto-io/adapter-api'
import { filterUtils, references as referencesUtils } from '@salto-io/adapter-components'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/dynamic_content_references'
import { createFilterCreatorParams } from '../utils'

const { createMissingInstance } = referencesUtils

describe('dynamic content references filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  let dynamicContentType: ObjectType
  let type: ObjectType

  beforeEach(async () => {
    dynamicContentType = new ObjectType({
      elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME),
      fields: {
        placeholder: { refType: BuiltinTypes.STRING },
      },
    })
    type = new ObjectType({
      elemID: new ElemID(ZENDESK, 'someType'),
      fields: {
        raw_value: { refType: BuiltinTypes.STRING },
        empty_value: { refType: new ListType(BuiltinTypes.NUMBER) },
      },
    })

    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  const createInstances = (): {
    dynamicContentInstance: InstanceElement
    instance: InstanceElement
    secondInstance: InstanceElement
    noDCInstance: InstanceElement
  } => {
    const dynamicContentInstance = new InstanceElement('dynamicContentInstance', dynamicContentType, {
      placeholder: '{{dc.somePlaceholder}}',
    })

    const instance = new InstanceElement('instance', type, {
      raw_value:
        '{{dc.somePlaceholder}} {{notExistsPlaceholder}} {{dc.somePlaceholder}} {{somethingElse.someOtherPlaceholder}}',
      empty_value: [],
    })
    const secondInstance = new InstanceElement('instance', type, {
      raw_value: '{{dc.somePlaceholder}} {{notExistsPlaceholder}} bb{{dc.somePlaceholder}}cc',
    })
    const noDCInstance = new InstanceElement('instance', type, {
      raw_value: '{{dc.somePlaceholder}} {{dc.notExistsPlaceholder}} {{dc.somePlaceholder}}',
    })
    return {
      dynamicContentInstance,
      instance,
      secondInstance,
      noDCInstance,
    }
  }

  describe('onFetch', () => {
    it('should replace dynamic content placeholders with templates', async () => {
      const { dynamicContentInstance, instance, secondInstance } = createInstances()
      await filter.onFetch([dynamicContentInstance, instance, secondInstance])
      expect(instance.value.raw_value).toEqual(
        new TemplateExpression({
          parts: [
            '{{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}} {{notExistsPlaceholder}} {{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}} {{somethingElse.someOtherPlaceholder}}',
          ],
        }),
      )
      expect(instance.value.empty_value).toEqual([])
      expect(secondInstance.value.raw_value).toEqual(
        new TemplateExpression({
          parts: [
            '{{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}} {{notExistsPlaceholder}} bb{{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}}cc',
          ],
        }),
      )
    })
    it('should handel broken dynamic reference', async () => {
      const { dynamicContentInstance, noDCInstance } = createInstances()
      await filter.onFetch([noDCInstance, dynamicContentInstance])
      const missingInstance = createMissingInstance(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME, 'notExistsPlaceholder')
      missingInstance.value.placeholder = '{{dc.notExistsPlaceholder}}'
      expect(noDCInstance.value.raw_value).toEqual(
        new TemplateExpression({
          parts: [
            '{{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}} {{',
            new ReferenceExpression(missingInstance.elemID, missingInstance),
            '}} {{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}}',
          ],
        }),
      )
    })
  })

  describe('preDeploy', () => {
    it('should switch instance back to original value before deploy', async () => {
      const { dynamicContentInstance, instance, secondInstance } = createInstances()
      const instanceCopy = instance.clone()
      await filter.onFetch([dynamicContentInstance, instanceCopy])
      expect(instanceCopy).not.toEqual(instance)
      await filter.preDeploy([toChange({ after: instanceCopy })])
      expect(instanceCopy).toEqual(instance)
      const secondInstanceCopy = secondInstance.clone()
      await filter.onFetch([dynamicContentInstance, secondInstanceCopy])
      expect(secondInstanceCopy).not.toEqual(secondInstance)
      await filter.preDeploy([toChange({ after: secondInstanceCopy })])
      expect(secondInstanceCopy).toEqual(secondInstance)
    })
    it('should bring broken reference back to original value before deploy', async () => {
      const { dynamicContentInstance, noDCInstance } = createInstances()
      const noDCInstanceCopy = noDCInstance.clone()
      await filter.onFetch([noDCInstanceCopy, dynamicContentInstance])
      expect(noDCInstanceCopy).not.toEqual(noDCInstance)
      await filter.preDeploy([toChange({ after: noDCInstanceCopy })])
      expect(noDCInstanceCopy).toEqual(noDCInstance)
    })
  })

  describe('onDeploy', () => {
    it('should switch instance back to template value after deploy', async () => {
      const { dynamicContentInstance, instance, secondInstance } = createInstances()
      const instanceCopy = instance.clone()
      await filter.onFetch([dynamicContentInstance, instanceCopy])
      await filter.preDeploy([toChange({ after: instanceCopy })])
      expect(instanceCopy).toEqual(instance)
      await filter.onDeploy([toChange({ after: instanceCopy })])
      expect(instanceCopy.value.raw_value).toEqual(
        new TemplateExpression({
          parts: [
            '{{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}} {{notExistsPlaceholder}} {{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}} {{somethingElse.someOtherPlaceholder}}',
          ],
        }),
      )
      expect(instanceCopy.value.empty_value).toEqual([])

      const secondInstanceCopy = secondInstance.clone()
      await filter.onFetch([dynamicContentInstance, secondInstanceCopy])
      await filter.preDeploy([toChange({ after: secondInstanceCopy })])
      expect(secondInstanceCopy).toEqual(secondInstance)
      await filter.onDeploy([toChange({ after: secondInstanceCopy })])
      expect(secondInstanceCopy.value.raw_value).toEqual(
        new TemplateExpression({
          parts: [
            '{{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}} {{notExistsPlaceholder}} bb{{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}}cc',
          ],
        }),
      )
    })
    it('should switch broken reference back to template value after deploy', async () => {
      const { dynamicContentInstance, noDCInstance } = createInstances()
      const noDCInstanceCopy = noDCInstance.clone()
      await filter.onFetch([noDCInstanceCopy, dynamicContentInstance])
      await filter.preDeploy([toChange({ after: noDCInstanceCopy })])
      expect(noDCInstanceCopy).toEqual(noDCInstance)
      await filter.onDeploy([toChange({ after: noDCInstanceCopy })])
      const missingInstance = createMissingInstance(ZENDESK, DYNAMIC_CONTENT_ITEM_TYPE_NAME, 'notExistsPlaceholder')
      missingInstance.value.placeholder = '{{dc.notExistsPlaceholder}}'
      expect(noDCInstanceCopy.value.raw_value).toEqual(
        new TemplateExpression({
          parts: [
            '{{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}} {{',
            new ReferenceExpression(missingInstance.elemID, missingInstance),
            '}} {{',
            new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
            '}}',
          ],
        }),
      )
    })
  })
})
