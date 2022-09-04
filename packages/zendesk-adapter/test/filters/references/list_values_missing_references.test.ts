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
  BuiltinTypes, isInstanceElement, ListType } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import filterCreator from '../../../src/filters/references/list_values_missing_references'
import ZendeskClient from '../../../src/client/client'
import { paginate } from '../../../src/client/pagination'
import { DEFAULT_CONFIG } from '../../../src/config'
import { ZENDESK } from '../../../src/constants'

describe('list values missing references filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
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

  const triggerType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'trigger'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      // eslint-disable-next-line camelcase
      category_id: { refType: new ListType(BuiltinTypes.NUMBER) },
      actions: {
        refType: new ListType(new ObjectType({
          elemID: new ElemID(ZENDESK, 'trigger__actions'),
          fields: {
            field: { refType: BuiltinTypes.STRING },
            value: { refType: BuiltinTypes.STRING },
          },
        })),
      },
    },
  })

  const generateElements = (
  ): Element[] => ([
    triggerType,
    new InstanceElement(
      'trigger1',
      triggerType,
      {
        id: 7001,
        actions: [
          { field: 'notification_sms_group', value: ['123456789', '+123456678', 'sms message'] },
          { field: 'notification_sms_group', value: ['group_id', '+123456678', 'sms message'] },
        ],
      },
    ),
  ])

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    describe('missing references', () => {
      it('should create missing references for a numeric first element in a list', () => {
        const brokenTrigger = elements.filter(
          e => isInstanceElement(e) && e.elemID.name === 'trigger1'
        )[0] as InstanceElement
        expect(brokenTrigger.value.actions).toHaveLength(2)
        const triggerFirstAction = brokenTrigger.value.actions[0].value
        expect(triggerFirstAction[0]).toBeInstanceOf(ReferenceExpression)
        expect(triggerFirstAction[0].value.elemID.name)
          .toEqual('missing_123456789')
        expect(triggerFirstAction[1]).not.toBeInstanceOf(ReferenceExpression)
        expect(triggerFirstAction[2]).not.toBeInstanceOf(ReferenceExpression)
      })
      it('should not create missing references for non-numeric first element in a list', () => {
        const brokenTrigger = elements.filter(
          e => isInstanceElement(e) && e.elemID.name === 'trigger1'
        )[0] as InstanceElement
        expect(brokenTrigger.value.actions).toHaveLength(2)
        const triggerSecondAction = brokenTrigger.value.actions[1].value
        expect(triggerSecondAction[0]).not.toBeInstanceOf(ReferenceExpression)
        expect(triggerSecondAction[0]).toEqual('group_id')
        expect(triggerSecondAction[1]).not.toBeInstanceOf(ReferenceExpression)
        expect(triggerSecondAction[2]).not.toBeInstanceOf(ReferenceExpression)
      })
    })
  })
})
