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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression,
  BuiltinTypes, TemplateExpression, MapType, toChange, isInstanceElement } from '@salto-io/adapter-api'
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

  const placeholderType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'ticket_field'),
  })

  const placeholder1 = new InstanceElement('placeholder1', placeholderType, { id: 1452 })
  const placeholder2 = new InstanceElement('placeholder2', placeholderType, { id: 1453 })
  const macro1 = new InstanceElement('macro1', testType, { id: 1001, actions: [{ value: 'non template', field: 'comment_value_html' }] })
  const macro2 = new InstanceElement('macro2', testType, { id: 1002, actions: [{ value: '{{ticket.ticket_field_1452}}', field: 'comment_value_html' }] })
  const macro3 = new InstanceElement('macro3', testType, { id: 1003, actions: [{ value: 'multiple refs {{ticket.ticket_field_1452}} and {{ticket.ticket_field_option_title_1453}}', field: 'comment_value_html' }] })
  const macroAlmostTemplate = new InstanceElement('macroAlmost', testType, { id: 1001, actions: [{ value: 'almost template {{ticket.not_an_actual_field_1452}} and {{ticket.ticket_field_1454}}', field: 'comment_value_html' }] })

  const generateElements = (): (InstanceElement | ObjectType)[] => ([
    testType,
    placeholderType,
    placeholder1.clone(),
    placeholder2.clone(),
    macro1.clone(),
    macro2.clone(),
    macro3.clone(),
    macroAlmostTemplate.clone(),
  ])

  describe('on fetch', () => {
    let fetchedMacro1: InstanceElement | undefined
    let fetchedMacro2: InstanceElement | undefined
    let fetchedMacro3: InstanceElement | undefined
    let fetchedMacroAlmostTemplate: InstanceElement | undefined

    beforeAll(async () => {
      const elements = generateElements()
      await filter.onFetch(elements)
      fetchedMacro1 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro1')
      fetchedMacro2 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro2')
      fetchedMacro3 = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macro3')
      fetchedMacroAlmostTemplate = elements.filter(isInstanceElement).find(i => i.elemID.name === 'macroAlmost')
    })

    it('should resolve non-template normally', () => {
      expect(fetchedMacro1?.value.actions[0].value).toEqual('non template')
    })

    it('should resolve almost-template normally', () => {
      expect(fetchedMacroAlmostTemplate?.value.actions[0].value).toEqual('almost template {{ticket.not_an_actual_field_1452}} and {{ticket.ticket_field_1454}}')
    })

    it('should resolve one template correctly', () => {
      expect(fetchedMacro2?.value.actions[0].value).toEqual(new TemplateExpression({ parts: [
        '{{',
        'ticket.ticket_field_',
        new ReferenceExpression(placeholder1.elemID, placeholder1), '}}'] }))
    })

    it('should resolve multiple templates correctly', () => {
      expect(fetchedMacro3?.value.actions[0].value).toEqual(new TemplateExpression({
        parts: [
          'multiple refs {{',
          'ticket.ticket_field_',
          new ReferenceExpression(placeholder1.elemID, placeholder1),
          '}} and {{',
          'ticket.ticket_field_option_title_',
          new ReferenceExpression(placeholder2.elemID, placeholder2),
          '}}',
        ],
      }))
    })
  })
  describe('on deploy', () => {
    let elementsBeforeFetch: (InstanceElement | ObjectType)[]
    let elementsAfterFetch: (InstanceElement | ObjectType)[]
    let elementsAfterPreDeploy: (InstanceElement | ObjectType)[]
    let elementsAfterOnDeploy: (InstanceElement | ObjectType)[]

    beforeAll(async () => {
      elementsBeforeFetch = generateElements()
      elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
      await filter.onFetch(elementsAfterFetch)
      elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
      await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
      elementsAfterOnDeploy = elementsAfterPreDeploy.map(e => e.clone())
      await filter.onDeploy(elementsAfterOnDeploy.map(e => toChange({ before: e, after: e })))
    })

    it('Returns elements to origin after predeploy', () => {
      expect(elementsAfterPreDeploy).toEqual(elementsBeforeFetch)
    })

    it('Returns elements to after fetch state after onDeploy', () => {
      expect(elementsAfterOnDeploy).toEqual(elementsAfterFetch)
    })
  })
})
