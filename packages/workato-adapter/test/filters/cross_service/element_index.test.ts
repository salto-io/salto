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
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Element,
  BuiltinTypes,
  ListType,
} from '@salto-io/adapter-api'
import { ZendeskIndex, indexZendesk } from '../../../src/filters/cross_service/zendesk/element_index'

const generateZendeskElements = (): Record<string, Element[]> => {
  const ticketOptionType = new ObjectType({
    elemID: new ElemID('zendesk', 'ticket_field__custom_field_options'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      value: { refType: BuiltinTypes.STRING },
    },
  })

  const ticketFieldType = new ObjectType({
    elemID: new ElemID('zendesk', 'ticket_field'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      type: { refType: BuiltinTypes.STRING },
      key: { refType: BuiltinTypes.STRING },
      raw_title: { refType: BuiltinTypes.STRING },
      custom_field_options: { refType: new ListType(BuiltinTypes.NUMBER) },
    },
  })

  const organizationOptionType = new ObjectType({
    elemID: new ElemID('zendesk', 'organization_field__custom_field_options'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      value: { refType: BuiltinTypes.STRING },
    },
  })

  const organizationFieldType = new ObjectType({
    elemID: new ElemID('zendesk', 'organization_field'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      key: { refType: BuiltinTypes.STRING },
      custom_field_options: { refType: new ListType(BuiltinTypes.NUMBER) },
    },
  })

  const userOptionType = new ObjectType({
    elemID: new ElemID('zendesk', 'user_field__custom_field_options'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      value: { refType: BuiltinTypes.STRING },
    },
  })

  const userFieldType = new ObjectType({
    elemID: new ElemID('zendesk', 'user_field'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      key: { refType: BuiltinTypes.STRING },
      custom_field_options: { refType: new ListType(BuiltinTypes.NUMBER) },
    },
  })

  const macroType = new ObjectType({
    elemID: new ElemID('zendesk', 'macro'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })

  const groupType = new ObjectType({
    elemID: new ElemID('zendesk', 'group'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })

  const brandType = new ObjectType({
    elemID: new ElemID('zendesk', 'brand'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })

  const ticketFormType = new ObjectType({
    elemID: new ElemID('zendesk', 'ticket_form'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      default: { refType: BuiltinTypes.BOOLEAN },
      ticket_field_ids: { refType: new ListType(BuiltinTypes.NUMBER) },
    },
  })

  const macroInst = new InstanceElement('macroInstName', macroType, { id: 10 })

  const groupInst = new InstanceElement('groupInstName', groupType, { id: 11 })

  const brandInst = new InstanceElement('brandInstName', brandType, { id: 15 })

  const ticketFormInst = new InstanceElement('ticketFormInstName', ticketFormType, { id: 16, default: false })

  const ticketFieldPriority = new InstanceElement('priority', ticketFieldType, {
    id: 1,
    type: 'priority',
    raw_title: 'Priority',
  })

  const ticketFieldStatus = new InstanceElement('status', ticketFieldType, {
    id: 2,
    type: 'status',
    raw_title: 'Status',
  })

  const defaultTicketFormInst = new InstanceElement('defaultTicketFormInstName', ticketFormType, {
    id: 17,
    default: true,
    ticket_field_ids: [
      new ReferenceExpression(ticketFieldStatus.elemID, ticketFieldStatus),
      new ReferenceExpression(ticketFieldPriority.elemID, ticketFieldPriority),
    ],
  })

  const ticketField12Option1 = new InstanceElement('ticketField12Option1Name', ticketOptionType, {
    id: 121,
    value: 'field 12 value 1',
  })

  const ticketField12Option2 = new InstanceElement('ticketField12Option2Name', ticketOptionType, {
    id: 122,
    value: 'field 12 value 2',
  })

  const ticketField12 = new InstanceElement('ticketField12Name', ticketFieldType, {
    id: 12,
    custom_field_options: [
      new ReferenceExpression(ticketField12Option1.elemID, ticketField12Option1),
      new ReferenceExpression(ticketField12Option2.elemID, ticketField12Option2),
    ],
  })

  const ticketField13 = new InstanceElement('ticketField13Name', ticketFieldType, {
    id: 13,
  })

  const ticketField14Option = new InstanceElement('ticketField14OptionName', ticketOptionType, {
    id: 141,
    value: 'same value name',
  })

  const ticketField14 = new InstanceElement('ticketField14Name', ticketFieldType, {
    id: 14,
    custom_field_options: [new ReferenceExpression(ticketField14Option.elemID, ticketField14Option)],
  })

  const ticketFieldSame = new InstanceElement('ticketFieldSameName', ticketFieldType, {
    id: 0,
    key: 'same',
  })

  const organizationField1Option = new InstanceElement('organizationField1OptionName', organizationOptionType, {
    id: 311,
    value: 'org field 1 value 1',
  })

  const organizationField1 = new InstanceElement('organizationField1Name', organizationFieldType, {
    id: 31,
    key: 'organization_field_1',
    custom_field_options: [new ReferenceExpression(organizationField1Option.elemID, organizationField1Option)],
  })

  const organizationField2Option = new InstanceElement('organizationField2OptionName', organizationOptionType, {
    id: 321,
    value: 'same value name',
  })

  const organizationField2 = new InstanceElement('organizationField2Name', organizationFieldType, {
    id: 32,
    key: 'organization_field_2',
    custom_field_options: [new ReferenceExpression(organizationField2Option.elemID, organizationField2Option)],
  })

  const organizationField3 = new InstanceElement('organizationField3Name', organizationFieldType, {
    id: 33,
    key: 'organization_field_3',
  })

  const organizationFieldSameOption = new InstanceElement('organizationFieldSameOptionName', organizationOptionType, {
    id: 341,
    value: 'same',
  })

  const organizationFieldSame = new InstanceElement('organizationFieldSameName', organizationFieldType, {
    id: 34,
    key: 'same',
    custom_field_options: [new ReferenceExpression(organizationFieldSameOption.elemID, organizationFieldSameOption)],
  })

  const userField1Option = new InstanceElement('userField1OptionName', userOptionType, {
    id: 411,
    value: 'user field 1 value 1',
  })

  const userField1 = new InstanceElement('userField1Name', userFieldType, {
    id: 41,
    key: 'user_field_1',
    custom_field_options: [new ReferenceExpression(userField1Option.elemID, userField1Option)],
  })

  const userField2Option = new InstanceElement('userField2OptionName', userOptionType, {
    id: 421,
    value: 'same value name',
  })

  const userField2 = new InstanceElement('userField2Name', userFieldType, {
    id: 42,
    key: 'user_field_2',
    custom_field_options: [new ReferenceExpression(userField2Option.elemID, userField2Option)],
  })

  const userField3 = new InstanceElement('userField3Name', userFieldType, {
    id: 43,
    key: 'user_field_3',
  })

  const userFieldSameOption = new InstanceElement('userFieldSameOptionName', userOptionType, {
    id: 441,
    value: 'same',
  })

  const userFieldSame = new InstanceElement('userFieldSameName', userFieldType, {
    id: 44,
    key: 'same',
    custom_field_options: [new ReferenceExpression(userFieldSameOption.elemID, userFieldSameOption)],
  })

  return {
    types: [
      ticketOptionType,
      ticketFieldType,
      organizationOptionType,
      organizationFieldType,
      userOptionType,
      userFieldType,
      macroType,
      groupType,
      brandType,
      ticketFormType,
    ],
    macros: [macroInst],
    groups: [groupInst],
    brands: [brandInst],
    ticketForms: [ticketFormInst, defaultTicketFormInst],
    ticketFields: [
      ticketFieldPriority,
      ticketFieldStatus,
      ticketField12,
      ticketField13,
      ticketField14,
      ticketFieldSame,
    ],
    ticketFieldOptions: [ticketField12Option1, ticketField12Option2, ticketField14Option],
    organizationFields: [organizationField1, organizationField2, organizationField3, organizationFieldSame],
    organizationFieldOptions: [organizationField1Option, organizationField2Option, organizationFieldSameOption],
    userFields: [userField1, userField2, userField3, userFieldSame],
    userFieldOptions: [userField1Option, userField2Option, userFieldSameOption],
  }
}

describe('indexZendesk', () => {
  let elements: Record<string, Element[]>
  let indexed: ZendeskIndex

  beforeEach(() => {
    elements = generateZendeskElements()
    indexed = indexZendesk(Object.values(elements).flat())
  })

  it('should index ticket fields by id', () => {
    expect(indexed.elementsByInternalID.ticketFields).toBeDefined()
    expect(indexed.elementsByInternalID.ticketFields[1]).toBe(elements.ticketFields[0])
    expect(indexed.elementsByInternalID.ticketFields[2]).toBe(elements.ticketFields[1])
    expect(indexed.elementsByInternalID.ticketFields[12]).toBe(elements.ticketFields[2])
    expect(indexed.elementsByInternalID.ticketFields[13]).toBe(elements.ticketFields[3])
    expect(indexed.elementsByInternalID.ticketFields[14]).toBe(elements.ticketFields[4])
    expect(indexed.elementsByInternalID.ticketFields[0]).toBe(elements.ticketFields[5])
  })
  it('should index basic elements by id', () => {
    expect(indexed.elementsByInternalID.macros).toBeDefined()
    expect(indexed.elementsByInternalID.macros[10]).toBe(elements.macros[0])
    expect(indexed.elementsByInternalID.groups).toBeDefined()
    expect(indexed.elementsByInternalID.groups[11]).toBe(elements.groups[0])
    expect(indexed.elementsByInternalID.brands).toBeDefined()
    expect(indexed.elementsByInternalID.brands[15]).toBe(elements.brands[0])
    expect(indexed.elementsByInternalID.ticketForms).toBeDefined()
    expect(indexed.elementsByInternalID.ticketForms[16]).toBe(elements.ticketForms[0])
    expect(indexed.elementsByInternalID.ticketForms[17]).toBe(elements.ticketForms[1])
  })
  it('should index custom fields by key', () => {
    expect(indexed.customFieldsByKey.user).toBeDefined()
    expect(indexed.customFieldsByKey.user.user_field_1).toBe(elements.userFields[0])
    expect(indexed.customFieldsByKey.user.user_field_2).toBe(elements.userFields[1])
    expect(indexed.customFieldsByKey.user.user_field_3).toBe(elements.userFields[2])
    expect(indexed.customFieldsByKey.user.same).toBe(elements.userFields[3])

    expect(indexed.customFieldsByKey.organization).toBeDefined()
    expect(indexed.customFieldsByKey.organization.organization_field_1).toBe(elements.organizationFields[0])
    expect(indexed.customFieldsByKey.organization.organization_field_2).toBe(elements.organizationFields[1])
    expect(indexed.customFieldsByKey.organization.organization_field_3).toBe(elements.organizationFields[2])
    expect(indexed.customFieldsByKey.organization.same).toBe(elements.organizationFields[3])
  })
  it('should index ticket custom options by field id and value', () => {
    expect(indexed.ticketCustomOptionByFieldIdAndValue[12]).toBeDefined()
    expect(indexed.ticketCustomOptionByFieldIdAndValue[12]['field 12 value 1']).toBe(elements.ticketFieldOptions[0])
    expect(indexed.ticketCustomOptionByFieldIdAndValue[12]['field 12 value 2']).toBe(elements.ticketFieldOptions[1])
    expect(indexed.ticketCustomOptionByFieldIdAndValue[14]).toBeDefined()
    expect(indexed.ticketCustomOptionByFieldIdAndValue[14]['same value name']).toBe(elements.ticketFieldOptions[2])
  })
  it('should index custom options by field key and value', () => {
    expect(indexed.customOptionsByFieldKeyAndValue.user).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.user.user_field_1).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.user.user_field_1['user field 1 value 1']).toBe(
      elements.userFieldOptions[0],
    )
    expect(indexed.customOptionsByFieldKeyAndValue.user.user_field_2).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.user.user_field_2['same value name']).toBe(
      elements.userFieldOptions[1],
    )
    expect(indexed.customOptionsByFieldKeyAndValue.user.user_field_3).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.user.user_field_3).toEqual({})
    expect(indexed.customOptionsByFieldKeyAndValue.user.same).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.user.same.same).toBe(elements.userFieldOptions[2])

    expect(indexed.customOptionsByFieldKeyAndValue.organization).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.organization.organization_field_1).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.organization.organization_field_1['org field 1 value 1']).toBe(
      elements.organizationFieldOptions[0],
    )
    expect(indexed.customOptionsByFieldKeyAndValue.organization.organization_field_2).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.organization.organization_field_2['same value name']).toBe(
      elements.organizationFieldOptions[1],
    )
    expect(indexed.customOptionsByFieldKeyAndValue.organization.organization_field_3).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.organization.organization_field_3).toEqual({})
    expect(indexed.customOptionsByFieldKeyAndValue.organization.same).toBeDefined()
    expect(indexed.customOptionsByFieldKeyAndValue.organization.same.same).toBe(elements.organizationFieldOptions[2])
  })
})
