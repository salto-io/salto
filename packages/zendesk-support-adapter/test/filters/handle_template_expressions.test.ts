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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element,
  BuiltinTypes, TemplateExpression, MapType } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/handle_template_expressions'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_CONFIG } from '../../src/config'
import { ZENDESK_SUPPORT } from '../../src/constants'

describe('handle templates filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  let filter: FilterType

  beforeAll(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'c' },
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

  const testType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'macro'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      actions: { refType: new MapType(BuiltinTypes.STRING) },
    },
  })

  const placeholder1 = new InstanceElement('placeholder1', testType, { id: 1452 })
  const placeholder2 = new InstanceElement('placeholder2', testType, { id: 1453 })
  const macro1 = new InstanceElement('macro1', testType, { id: 1001, actions: { value: 'non template' } })
  const macro2 = new InstanceElement('macro2', testType, { id: 1002, actions: { value: '{{exactly one template_1452}}' } })
  const macro3 = new InstanceElement('macro3', testType, { id: 1003, actions: { value: 'multiple refs {{plus template_1452}} and {{template_1453}}' } })

  const generateElements = (
  ): Element[] => ([
    testType,
    placeholder1,
    placeholder2,
    macro1,
    macro2,
    macro3,
  ])

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve non-template normally', () => {
      expect(macro1.value.actions.value).toEqual('non template')
    })

    it('should resolve one template correctly', () => {
      expect(macro2.value.actions.value).toEqual(new TemplateExpression({ parts: ['{{exactly one template', '_',
        new ReferenceExpression(placeholder1.elemID), '}}'] }))
    })

    it('should resolve multiple templates correctly', () => {
      expect(macro3.value.actions.value).toEqual(new TemplateExpression({
        parts: [
          'multiple refs ',
          '{{plus template',
          '_',
          new ReferenceExpression(placeholder1.elemID),
          '}}',
          ' and ',
          '{{template',
          '_',
          new ReferenceExpression(placeholder2.elemID),
          '}}',
        ],
      }))
    })
  })
})
