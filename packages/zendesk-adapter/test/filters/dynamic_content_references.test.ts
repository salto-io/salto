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
import {
  ObjectType, ElemID, InstanceElement, ReferenceExpression, TemplateExpression, BuiltinTypes,
  toChange,
  ListType,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator from '../../src/filters/dynamic_content_references'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../../src/filters/dynamic_content'

describe('dynamic content references filter', () => {
  let client: ZendeskClient
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

    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  const createInstances = (): {
    dynamicContentInstance: InstanceElement
    instance: InstanceElement
    secondInstance: InstanceElement
  } => {
    const dynamicContentInstance = new InstanceElement(
      'dynamicContentInstance',
      dynamicContentType,
      {
        placeholder: '{{somePlaceholder}}',
      },
    )

    const instance = new InstanceElement(
      'instance',
      type,
      {
        raw_value: '{{somePlaceholder}} {{notExistsPlaceholder}} {{somePlaceholder}}',
        empty_value: [],
      }
    )
    const secondInstance = new InstanceElement(
      'instance',
      type,
      {
        raw_value: '{{somePlaceholder}} {{notExistsPlaceholder}} bb{{somePlaceholder}}cc',
      }
    )
    return {
      dynamicContentInstance,
      instance,
      secondInstance,
    }
  }

  describe('onFetch', () => {
    it('should replace dynamic content placeholders with templates', async () => {
      const { dynamicContentInstance, instance, secondInstance } = createInstances()
      await filter.onFetch([dynamicContentInstance, instance, secondInstance])
      expect(instance.value.raw_value).toEqual(new TemplateExpression({
        parts: ['{{',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          '}}', ' ', '{{notExistsPlaceholder}}', ' ', '{{',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          '}}'],
      }))
      expect(instance.value.empty_value).toEqual([])
      expect(secondInstance.value.raw_value).toEqual(new TemplateExpression({
        parts: ['{{',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          '}}', ' ', '{{notExistsPlaceholder}}', ' bb', '{{',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          '}}', 'cc'],
      }))
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
  })

  describe('onDeploy', () => {
    it('should switch instance back to template value after deploy', async () => {
      const { dynamicContentInstance, instance, secondInstance } = createInstances()
      const instanceCopy = instance.clone()
      await filter.onFetch([dynamicContentInstance, instanceCopy])
      expect(instanceCopy).not.toEqual(instance)
      await filter.preDeploy([toChange({ after: instanceCopy })])
      expect(instanceCopy).toEqual(instance)
      await filter.onDeploy([toChange({ after: instanceCopy })])
      expect(instanceCopy.value.raw_value).toEqual(new TemplateExpression({
        parts: ['{{',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          '}}', ' ', '{{notExistsPlaceholder}}', ' ', '{{',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          '}}'],
      }))
      expect(instanceCopy.value.empty_value).toEqual([])

      const secondInstanceCopy = secondInstance.clone()
      await filter.onFetch([dynamicContentInstance, secondInstanceCopy])
      expect(secondInstanceCopy).not.toEqual(secondInstance)
      await filter.preDeploy([toChange({ after: secondInstanceCopy })])
      expect(secondInstanceCopy).toEqual(secondInstance)
      await filter.onDeploy([toChange({ after: secondInstanceCopy })])
      expect(secondInstanceCopy.value.raw_value).toEqual(new TemplateExpression({
        parts: ['{{',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          '}}', ' ', '{{notExistsPlaceholder}}', ' bb', '{{',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          '}}', 'cc'],
      }))
    })
  })
})
