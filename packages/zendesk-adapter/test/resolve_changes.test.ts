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
  getChangeData,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { references as referencesUtils, resolveChangeElement } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { fieldNameToTypeMappingDefs, ZendeskFieldReferenceResolver } from '../src/filters/field_references'
import { ZENDESK } from '../src/constants'

const { awu } = collections.asynciterable

describe('resolveChanges', () => {
  let lookupFunc: GetLookupNameFunc
  beforeEach(() => {
    lookupFunc = referencesUtils.generateLookupFunc(
      fieldNameToTypeMappingDefs,
      defs => new ZendeskFieldReferenceResolver(defs),
    )
  })
  it('should resolve changes correctly for dynamic content item', async () => {
    const localeType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'locale'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        locale: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        default: { refType: BuiltinTypes.BOOLEAN },
      },
    })
    const variantType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'dynamic_content_item__variants'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        content: { refType: BuiltinTypes.STRING },
        locale_id: { refType: BuiltinTypes.NUMBER },
        default: { refType: BuiltinTypes.BOOLEAN },
      },
    })
    const dynamicContentItemType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'dynamic_content_item'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        name: { refType: BuiltinTypes.STRING },
        default_locale_id: { refType: BuiltinTypes.NUMBER },
        variants: { refType: new ListType(variantType) },
      },
    })
    const english = new InstanceElement('En', localeType, { id: 1 })
    const variant1 = new InstanceElement('variant1', variantType, {
      id: 2001,
      content: 'abc',
      locale_id: new ReferenceExpression(english.elemID, english),
      default: true,
    })
    const item1 = new InstanceElement('item1', dynamicContentItemType, {
      id: 1001,
      name: 'item1',
      default_locale_id: new ReferenceExpression(english.elemID, english),
      variants: [new ReferenceExpression(variant1.elemID, variant1)],
    })
    const resolvedChanges = await awu([toChange({ after: item1 })])
      .map(change => resolveChangeElement(change, lookupFunc))
      .toArray()
    expect(resolvedChanges).toHaveLength(1)
    expect(getChangeData(resolvedChanges[0]).value).toEqual({
      id: 1001,
      name: 'item1',
      default_locale_id: 1,
      variants: [1],
    })
  })
  it('should resolve changes correctly for automation', async () => {
    const ticketFieldOptionType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        name: { refType: BuiltinTypes.STRING },
        value: { refType: BuiltinTypes.STRING },
      },
    })
    const ticketFieldType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'ticket_field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        title: { refType: BuiltinTypes.STRING },
        default_custom_field_option: { refType: BuiltinTypes.STRING },
        custom_field_options: { refType: new ListType(ticketFieldOptionType) },
      },
    })
    const userFieldOptionType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'user_field__custom_field_options'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        name: { refType: BuiltinTypes.STRING },
        value: { refType: BuiltinTypes.STRING },
      },
    })
    const userFieldType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'user_field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        key: { refType: BuiltinTypes.STRING },
        title: { refType: BuiltinTypes.STRING },
        custom_field_options: { refType: new ListType(userFieldOptionType) },
      },
    })
    const orgFieldOptionType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'organization_field__custom_field_options'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        name: { refType: BuiltinTypes.STRING },
        value: { refType: BuiltinTypes.STRING },
      },
    })
    const orgFieldType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'organization_field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        key: { refType: BuiltinTypes.STRING },
        title: { refType: BuiltinTypes.STRING },
        custom_field_options: { refType: new ListType(orgFieldOptionType) },
      },
    })
    const automationType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'automation'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        title: { refType: BuiltinTypes.STRING },
        active: { refType: BuiltinTypes.BOOLEAN },
        actions: {
          refType: new ListType(
            new ObjectType({
              elemID: new ElemID(ZENDESK, 'automation__actions'),
              fields: {
                field: { refType: BuiltinTypes.STRING },
                value: { refType: BuiltinTypes.STRING },
              },
            }),
          ),
        },
        conditions: {
          refType: new ObjectType({
            elemID: new ElemID(ZENDESK, 'automation__conditions'),
            fields: {
              all: {
                refType: new ListType(
                  new ObjectType({
                    elemID: new ElemID(ZENDESK, 'automation__conditions__all'),
                    fields: {
                      field: { refType: BuiltinTypes.STRING },
                      operator: { refType: BuiltinTypes.STRING },
                      value: { refType: BuiltinTypes.STRING },
                    },
                  }),
                ),
              },
              any: {
                refType: new ListType(
                  new ObjectType({
                    elemID: new ElemID(ZENDESK, 'automation__conditions__any'),
                    fields: {
                      field: { refType: BuiltinTypes.STRING },
                      operator: { refType: BuiltinTypes.STRING },
                      value: { refType: BuiltinTypes.STRING },
                    },
                  }),
                ),
              },
            },
          }),
        },
      },
    })
    const ticketFieldOption1Instance = new InstanceElement('tfo1', ticketFieldOptionType, {
      id: 1001,
      name: 'option1',
      value: 'v1',
    })
    const ticketFieldOption2Instance = new InstanceElement('tfo2', ticketFieldOptionType, {
      id: 1002,
      name: 'option2',
      value: 'v2',
    })
    const ticketFieldInstance = new InstanceElement('tf1', ticketFieldType, {
      id: 100,
      title: 'tf1',
      type: 'tagger',
      default_custom_field_option: new ReferenceExpression(
        ticketFieldOption1Instance.elemID,
        ticketFieldOption1Instance,
      ),
      custom_field_options: [new ReferenceExpression(ticketFieldOption1Instance.elemID, ticketFieldOption1Instance)],
    })
    const userFieldOption1Instance = new InstanceElement('ufo1', userFieldOptionType, {
      id: 1011,
      name: 'option1',
      value: 'v3',
    })
    const userFieldInstance = new InstanceElement('uf1', userFieldType, {
      id: 101,
      title: 'uf1',
      key: 'key_uf1',
      type: 'dropdown',
      custom_field_options: [new ReferenceExpression(userFieldOption1Instance.elemID, userFieldOption1Instance)],
    })
    const orgFieldOption1Instance = new InstanceElement('ofo1', orgFieldOptionType, {
      id: 1021,
      name: 'option1',
      value: 'v4',
    })
    const orgFieldInstance = new InstanceElement('of1', orgFieldType, {
      id: 102,
      title: 'of1',
      key: 'key_of1',
      type: 'dropdown',
      custom_field_options: [new ReferenceExpression(orgFieldOption1Instance.elemID, orgFieldOption1Instance)],
    })
    const automationInstance = new InstanceElement('Test', automationType, {
      id: 2,
      title: 'Test',
      active: true,
      actions: [
        {
          field: new ReferenceExpression(ticketFieldInstance.elemID, ticketFieldInstance),
          value: new ReferenceExpression(ticketFieldOption1Instance.elemID, ticketFieldOption1Instance),
        },
      ],
      conditions: {
        all: [
          {
            field: new ReferenceExpression(ticketFieldInstance.elemID, ticketFieldInstance),
            operator: 'is',
            value: new ReferenceExpression(ticketFieldOption2Instance.elemID, ticketFieldOption2Instance),
          },
          {
            field: new ReferenceExpression(userFieldInstance.elemID, userFieldInstance),
            operator: 'is',
            value: new ReferenceExpression(userFieldOption1Instance.elemID, userFieldOption1Instance),
          },
          {
            field: new ReferenceExpression(orgFieldInstance.elemID, orgFieldInstance),
            operator: 'is',
            value: new ReferenceExpression(orgFieldOption1Instance.elemID, orgFieldOption1Instance),
          },
          {
            field: new ReferenceExpression(ticketFieldInstance.elemID, ticketFieldInstance),
            operator: 'is',
            value: 'v123',
          },
        ],
      },
    })
    const resolvedChanges = await awu([automationInstance, ticketFieldInstance].map(inst => toChange({ after: inst })))
      .map(change => resolveChangeElement(change, lookupFunc))
      .toArray()
    expect(resolvedChanges).toHaveLength(2)
    expect(getChangeData(resolvedChanges[0]).value).toEqual({
      id: 2,
      title: 'Test',
      active: true,
      actions: [{ field: 'custom_fields_100', value: 'v1' }],
      conditions: {
        all: [
          { field: 'custom_fields_100', operator: 'is', value: 'v2' },
          { field: 'requester.custom_fields.key_uf1', operator: 'is', value: '1011' },
          { field: 'organization.custom_fields.key_of1', operator: 'is', value: '1021' },
          { field: 'custom_fields_100', operator: 'is', value: 'v123' },
        ],
      },
    })
    expect(getChangeData(resolvedChanges[1]).value).toEqual({
      id: 100,
      title: 'tf1',
      type: 'tagger',
      default_custom_field_option: 'v1',
      custom_field_options: [{ id: 1001, name: 'option1', value: 'v1' }],
    })
  })
  it('should resolve to string when using idString serialization', async () => {
    const workspaceType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'workspace'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        conditions: {
          refType: new ObjectType({
            elemID: new ElemID(ZENDESK, 'workspace__conditions'),
            fields: {
              all: {
                refType: new ListType(
                  new ObjectType({
                    elemID: new ElemID(ZENDESK, 'workspace__conditions__all'),
                    fields: {
                      field: { refType: BuiltinTypes.STRING },
                      operator: { refType: BuiltinTypes.STRING },
                      value: { refType: BuiltinTypes.STRING },
                    },
                  }),
                ),
              },
            },
          }),
        },
      },
    })
    const groupType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'group'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
      },
    })
    const group = new InstanceElement('group3', groupType, { id: 2003 })
    const workspace = new InstanceElement('workspace1', workspaceType, {
      id: 7001,
      conditions: {
        all: [{ field: 'group_id', operator: 'is', value: new ReferenceExpression(group.elemID, group) }],
      },
    })
    expect(
      getChangeData(await resolveChangeElement(toChange({ after: workspace }), lookupFunc)).value.conditions.all[0]
        .value,
    ).toEqual('2003')
  })
})
