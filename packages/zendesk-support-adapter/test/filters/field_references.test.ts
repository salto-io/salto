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
import filterCreator from '../../src/filters/field_references'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
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
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
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
  const ticketFieldType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'ticket_field'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const ticketFieldOptionType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'ticket_field__custom_field_options'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      name: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
  })
  const userFieldOptionType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'user_field__custom_field_options'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      name: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
  })
  const orgFieldOptionType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'organization_field__custom_field_options'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      name: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
  })
  const userFieldType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'user_field'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      key: { refType: BuiltinTypes.STRING },
    },
  })
  const orgFieldType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'organization_field'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      key: { refType: BuiltinTypes.STRING },
    },
  })
  const triggerType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'trigger'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      // eslint-disable-next-line camelcase
      category_id: { refType: new ListType(BuiltinTypes.NUMBER) },
      conditions: {
        refType: new ObjectType({
          elemID: new ElemID(ZENDESK_SUPPORT, 'trigger__conditions'),
          fields: {
            all: { refType: new ListType(new ObjectType({
              elemID: new ElemID(ZENDESK_SUPPORT, 'trigger__conditions__all'),
              fields: {
                field: { refType: BuiltinTypes.STRING },
                operator: { refType: BuiltinTypes.STRING },
                value: { refType: BuiltinTypes.STRING },
              },
            })) },
          },
        }),
      },
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
    ticketFieldType,
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
    new InstanceElement(
      'option1',
      ticketFieldOptionType,
      { id: 9001, name: 'option1', value: 'v11' },
    ),
    new InstanceElement(
      'option2',
      userFieldOptionType,
      { id: 9002, name: 'option2', value: 'v12' },
    ),
    new InstanceElement(
      'option3',
      orgFieldOptionType,
      { id: 9003, name: 'option3', value: 'v13' },
    ),
    new InstanceElement(
      'option4',
      orgFieldOptionType,
      { id: 9004, name: 'option4', value: 'v14' },
    ),
    new InstanceElement(
      'customField1',
      ticketFieldType,
      {
        id: 6001,
        type: 'tagger',
        custom_field_options: [{ name: 'option1', value: 'v11' }],
      }
    ),
    new InstanceElement('customField2', ticketFieldType, { id: 6005, type: 'text' }),
    new InstanceElement('userField1', userFieldType, { id: 6002, key: 'key_uf1', type: 'dropdown' }),
    new InstanceElement('orgField1', orgFieldType, { id: 6003, key: 'key_of1', type: 'dropdown' }),
    new InstanceElement('orgField2', orgFieldType, { id: 6003, key: 'key_of2', type: 'text' }),
    new InstanceElement(
      'trigger1',
      triggerType,
      {
        id: 7001,
        conditions: {
          all: [
            { field: 'custom_fields_6001', operator: 'is', value: 'v11' },
            { field: 'requester.custom_fields.key_uf1', value: 9002 },
            { field: 'organization.custom_fields.key_of1', value: '9003' },
            { field: 'organization.custom_fields.key_of2', value: '9004' },
            { field: 'custom_fields_6005', operator: 'is', value: 'v11' },
          ],
        },
      },
    ),
    new InstanceElement(
      'trigger2',
      triggerType,
      {
        id: 7002,
        conditions: {
          all: [
            { field: 'custom_fields_6001', operator: 'is', value: 'v15' },
            { field: 'requester.custom_fields.key_uf1', value: 9002 },
          ],
        },
      },
    ),
  ])

  describe('on fetch', () => {
    let originalElements: Element[]
    let elements: Element[]

    beforeAll(async () => {
      elements = generateElements()
      originalElements = elements.map(element => element.clone())
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
    it('should resolve custom field references', () => {
      const trigger = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'trigger1'
      )[0] as InstanceElement
      expect(trigger.value.conditions.all[0].field).toBeInstanceOf(ReferenceExpression)
      expect(trigger.value.conditions.all[0].field.elemID.getFullName())
        .toEqual('zendesk_support.ticket_field.instance.customField1')
      expect(trigger.value.conditions.all[0].value).toBeInstanceOf(ReferenceExpression)
      expect(trigger.value.conditions.all[0].value.elemID.getFullName())
        .toEqual('zendesk_support.ticket_field__custom_field_options.instance.option1')
      expect(trigger.value.conditions.all[1].field).toBeInstanceOf(ReferenceExpression)
      expect(trigger.value.conditions.all[1].field.elemID.getFullName())
        .toEqual('zendesk_support.user_field.instance.userField1')
      expect(trigger.value.conditions.all[1].value).toBeInstanceOf(ReferenceExpression)
      expect(trigger.value.conditions.all[1].value.elemID.getFullName())
        .toEqual('zendesk_support.user_field__custom_field_options.instance.option2')
      expect(trigger.value.conditions.all[2].field).toBeInstanceOf(ReferenceExpression)
      expect(trigger.value.conditions.all[2].field.elemID.getFullName())
        .toEqual('zendesk_support.organization_field.instance.orgField1')
      expect(trigger.value.conditions.all[2].value).toBeInstanceOf(ReferenceExpression)
      expect(trigger.value.conditions.all[2].value.elemID.getFullName())
        .toEqual('zendesk_support.organization_field__custom_field_options.instance.option3')
      expect(trigger.value.conditions.all[3].field).toBeInstanceOf(ReferenceExpression)
      expect(trigger.value.conditions.all[3].field.elemID.getFullName())
        .toEqual('zendesk_support.organization_field.instance.orgField2')
      expect(trigger.value.conditions.all[3].value).not.toBeInstanceOf(ReferenceExpression)
      expect(trigger.value.conditions.all[4].field).toBeInstanceOf(ReferenceExpression)
      expect(trigger.value.conditions.all[4].field.elemID.getFullName())
        .toEqual('zendesk_support.ticket_field.instance.customField2')
      expect(trigger.value.conditions.all[4].value).not.toBeInstanceOf(ReferenceExpression)
    })
    describe('missing references', () => {
      it('should create missing references', () => {
        const brokenTrigger = elements.filter(
          e => isInstanceElement(e) && e.elemID.name === 'trigger2'
        )[0] as InstanceElement
        expect(brokenTrigger.value.conditions.all[0].value).toBeInstanceOf(ReferenceExpression)
        expect(brokenTrigger.value.conditions.all[0].value.elemID.name)
          .toEqual('missing_v15')
        // missing references are not resolved references
        expect(brokenTrigger.value.conditions.all[0].value.value).toEqual(undefined)
        expect(brokenTrigger.value.conditions.all[1].value).toBeInstanceOf(ReferenceExpression)
        expect(brokenTrigger.value.conditions.all[1].value.value).toBeInstanceOf(InstanceElement)
      })
      it('should not create missing references if enable missing references is false', async () => {
        const newFilter = filterCreator({
          client,
          paginator: clientUtils.createPaginator({
            client,
            paginationFuncCreator: paginate,
          }),
          config: {
            ...DEFAULT_CONFIG,
            fetch: {
              ...DEFAULT_CONFIG[FETCH_CONFIG],
              enableMissingReferences: false,
            },
          },
          fetchQuery: elementUtils.query.createMockQuery(),
        }) as FilterType
        const clonedElements = originalElements.map(element => element.clone())
        await newFilter.onFetch(clonedElements)
        const brokenTrigger = clonedElements.filter(
          e => isInstanceElement(e) && e.elemID.name === 'trigger2'
        )[0] as InstanceElement
        expect(brokenTrigger.value.conditions.all[0].value).not.toBeInstanceOf(ReferenceExpression)
        expect(brokenTrigger.value.conditions.all[0].value).toEqual('v15')
        expect(brokenTrigger.value.conditions.all[1].value).toBeInstanceOf(ReferenceExpression)
        expect(brokenTrigger.value.conditions.all[1].value.value).toBeInstanceOf(InstanceElement)
      })
    })
  })
})
