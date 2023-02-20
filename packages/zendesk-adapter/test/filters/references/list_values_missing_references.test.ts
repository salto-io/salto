/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../../src/filters/references/list_values_missing_references'
import { ZENDESK } from '../../../src/constants'
import { createFilterCreatorParams } from '../../utils'

describe('list values missing references filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  beforeAll(() => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
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
          { field: 'notification_sms_grouwp', value: ['group_id', '+123456678', 'sms message'] },
          { field: 'notification_webhook', value: ['01GB7WWYD3QM8G7BWTR7A28XWR', ['one', 'two']] },
          { field: 'notification_webhook', value: "['01GB7WWYD3QM8G7BWTR7A28XWR', ['one', 'two']]" },
          { field: 'notification_target', value: ['01GB7WWYD3QM8G7BWTR7A28XWR', 'target'] },
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
        expect(brokenTrigger.value.actions).toHaveLength(5)
        const triggerFirstAction = brokenTrigger.value.actions[0].value
        expect(triggerFirstAction[0]).toBeInstanceOf(ReferenceExpression)
        expect(triggerFirstAction[0].value.elemID.name)
          .toEqual('missing_123456789')
        expect(triggerFirstAction[1]).not.toBeInstanceOf(ReferenceExpression)
        expect(triggerFirstAction[2]).not.toBeInstanceOf(ReferenceExpression)
      })
      it('should create missing references for a non-numeric webhook first element in a list', () => {
        const brokenTrigger = elements.filter(
          e => isInstanceElement(e) && e.elemID.name === 'trigger1'
        )[0] as InstanceElement
        expect(brokenTrigger.value.actions[2].field).toBe('notification_webhook')
        const webhookAction = brokenTrigger.value.actions[2].value
        expect(webhookAction[0]).toBeInstanceOf(ReferenceExpression)
        expect(webhookAction[0].value.elemID.name)
          .toEqual('missing_01GB7WWYD3QM8G7BWTR7A28XWR')
        expect(webhookAction[1]).not.toBeInstanceOf(ReferenceExpression)
      })
      it('should not create missing references for skip_list values in the first element in a list', () => {
        const brokenTrigger = elements.filter(
          e => isInstanceElement(e) && e.elemID.name === 'trigger1'
        )[0] as InstanceElement
        expect(brokenTrigger.value.actions[4].field).toBe('notification_target')
        const targetAction = brokenTrigger.value.actions[4].value
        expect(targetAction[0]).not.toBeInstanceOf(ReferenceExpression)
        expect(targetAction[0]).toEqual('01GB7WWYD3QM8G7BWTR7A28XWR')
        expect(targetAction[1]).not.toBeInstanceOf(ReferenceExpression)
        expect(targetAction[2]).not.toBeInstanceOf(ReferenceExpression)
      })
      it('should not create missing references for non-numeric first element in a list', () => {
        const brokenTrigger = elements.filter(
          e => isInstanceElement(e) && e.elemID.name === 'trigger1'
        )[0] as InstanceElement
        const triggerSecondAction = brokenTrigger.value.actions[1].value
        expect(triggerSecondAction[0]).not.toBeInstanceOf(ReferenceExpression)
        expect(triggerSecondAction[0]).toEqual('group_id')
        expect(triggerSecondAction[1]).not.toBeInstanceOf(ReferenceExpression)
      })
    })
  })
})
