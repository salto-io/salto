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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, isInstanceElement, ListType } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/field_references'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_TYPES, DEFAULT_ID_FIELDS } from '../../src/config'
import { ZENDESK_SUPPORT } from '../../src/constants'

describe('References by id filter', () => {
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
      config: {
        fetch: {
          includeTypes: ['connection', 'recipe'],
        },
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: DEFAULT_ID_FIELDS,
            },
          },
          types: DEFAULT_TYPES,
        },
      },
    }) as FilterType
  })

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'brand'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const groupType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'group'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const triggerCategoryType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'trigger_category'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      // eslint-disable-next-line camelcase
      api_client_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const ticketFormType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'ticket_form'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      // eslint-disable-next-line camelcase
      parent_id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const triggerType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'api_access_profile'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      // eslint-disable-next-line camelcase
      category_id: { refType: new ListType(BuiltinTypes.NUMBER) },
    },
  })
  const someTypeWithValue = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'typeWithValue'),
    fields: {
      // eslint-disable-next-line camelcase
      value: { refType: BuiltinTypes.UNKNOWN },
      bla: { refType: BuiltinTypes.STRING },
    },
  })
  const someTypeWithNestedValuesAndSubject = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'typeWithValueAndSubject'),
    fields: {
      // eslint-disable-next-line camelcase
      valueList: { refType: new ListType(someTypeWithValue) },
      subject: { refType: BuiltinTypes.STRING },
    },
  })
  const someTypeWithNestedValueList = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'typeWithValueList'),
    fields: {
      // eslint-disable-next-line camelcase
      list: { refType: new ListType(someTypeWithValue) },
      type: { refType: BuiltinTypes.STRING },
    },
  })
  const someTypeWithNestedListOfValuesAndValue = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'typeWithNestedValues'),
    fields: {
      value: { refType: BuiltinTypes.STRING },
      values: { refType: new ListType(someTypeWithNestedValueList) },
    },
  })
  const type1 = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'type1'),
    fields: {
      nestedValues: { refType: new ListType(someTypeWithNestedListOfValuesAndValue) },
      subjectAndValues: { refType: new ListType(someTypeWithNestedValuesAndSubject) },
    },
  })

  const generateElements = (
  ): Element[] => ([
    brandType,
    groupType,
    triggerCategoryType,
    ticketFormType,
    triggerType,
    someTypeWithValue,
    someTypeWithNestedValuesAndSubject,
    someTypeWithNestedValueList,
    someTypeWithNestedListOfValuesAndValue,
    type1,
    new InstanceElement('brand1', brandType, { id: 1001 }),
    new InstanceElement('brand2', brandType, { id: 1002 }),
    new InstanceElement('group3', groupType, { id: 2003 }),
    new InstanceElement('group4', groupType, { id: 2004 }),
    new InstanceElement('triggerCategory5', triggerCategoryType, { id: 3005 }),
    new InstanceElement('triggerCategory6', triggerCategoryType, { id: 3006 }),
    new InstanceElement('ticketForm7', ticketFormType, { id: 4007 }),
    new InstanceElement('ticketForm8', ticketFormType, { id: 4008 }),
    new InstanceElement('trigger9', triggerType, { id: 5009, category_id: 2323 }),
    new InstanceElement('trigger10', triggerType, { id: 5010, category_id: 3005 }),
    new InstanceElement('inst1', type1, {
      subjectAndValues: [
        {
          valueList: [{ value: 4007, bla: 'ignore' }],
          subject: 'ticket_form_id',
        },
        {
          valueList: [{ value: 4007, bla: 'ignore' }],
          subject: 'unrelated',
        },
      ],
      nestedValues: [
        {
          value: 'brand_id',
          values: [
            { list: [{ value: 1001 }, { value: 123 }], type: 'ignore' },
            { list: [{ value: 123 }, { value: 1002 }], type: 'ignore' },
          ],
        },
        {
          value: 'group_id',
          values: [
            { list: [{ value: '2003' }], type: 'ignore' },
          ],
        },
      ],
    }),
  ])

  describe('on fetch', () => {
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      await filter.onFetch(elements)
    })

    it('should resolve field values when referenced element exists', () => {
      const trigger10 = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'trigger10'
      )[0] as InstanceElement
      expect(trigger10.value.category_id).toBeInstanceOf(ReferenceExpression)
      expect(trigger10.value.category_id.elemID.getFullName()).toEqual('zendesk_support.trigger_category.instance.triggerCategory5')

      const inst = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'inst1'
      )[0] as InstanceElement
      expect(inst.value.nestedValues[0].values[0].list[0].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[0].values[0].list[0].value.elemID.getFullName()).toEqual('zendesk_support.brand.instance.brand1')
      expect(inst.value.nestedValues[0].values[1].list[1].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[0].values[1].list[1].value.elemID.getFullName()).toEqual('zendesk_support.brand.instance.brand2')
      expect(inst.value.nestedValues[1].values[0].list[0].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[1].values[0].list[0].value.elemID.getFullName()).toEqual('zendesk_support.group.instance.group3')
      expect(inst.value.subjectAndValues[0].valueList[0].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.subjectAndValues[0].valueList[0].value.elemID.getFullName()).toEqual('zendesk_support.ticket_form.instance.ticketForm7')
    })
    it('should not resolve if referenced element does not exist', () => {
      const trigger9 = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'trigger9'
      )[0] as InstanceElement
      expect(trigger9.value.category_id).not.toBeInstanceOf(ReferenceExpression)
      expect(trigger9.value.category_id).toEqual(2323)

      const inst = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'inst1'
      )[0] as InstanceElement
      expect(
        inst.value.nestedValues[0].values[0].list[1].value
      ).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[0].values[0].list[1].value).toEqual(123)
      expect(
        inst.value.subjectAndValues[1].valueList[0].value
      ).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.subjectAndValues[1].valueList[0].value).toEqual(4007)
    })
  })
})
