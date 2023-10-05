
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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, TemplateExpression } from '@salto-io/adapter-api'
import { filterUtils, references as referenceUtils } from '@salto-io/adapter-components'
import {
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  TICKET_FIELD_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  ZENDESK,
} from '../../../src/constants'
import filterCreator from '../../../src/filters/custom_objects/custom_object_fields'
import { createFilterCreatorParams } from '../../utils'

const USER_ID = 'userId'
jest.mock('../../../src/user_utils', () => ({
  ...jest.requireActual<{}>('../../../src/user_utils'),
  getIdByEmail: () => ({ [USER_ID]: 'User' }),
}))

type FilterType = filterUtils.FilterWith<'onFetch'>
const customObjectFieldsFilter = filterCreator(createFilterCreatorParams({})) as FilterType

const missingRef = (type: string, id: string): ReferenceExpression =>
  new ReferenceExpression(referenceUtils.createMissingInstance(ZENDESK, type, id).elemID)

describe('customObjectFieldsFilter', () => {
  describe('onFetch', () => {
    let customObjectField: InstanceElement
    let customObject: InstanceElement
    let ticketField: InstanceElement
    let valueInstance: InstanceElement
    let lookUpTemplate: TemplateExpression
    beforeEach(() => {
      customObjectField = new InstanceElement(
        'customObjectField',
        new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_TYPE_NAME) }),
        {
          key: 'customObjectFieldKey',
          type: 'lookup',
        }
      )
      customObject = new InstanceElement(
        'customObject',
        new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_TYPE_NAME) }),
        {
          key: 'customObjectKey',
          custom_object_fields: [new ReferenceExpression(customObjectField.elemID, customObjectField)],
        }
      )
      ticketField = new InstanceElement(
        'ticketField',
        new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) }),
        {
          id: 123,
          relationship_target_type: `zen:custom_object:${customObject.value.key}`,
        }
      )
      valueInstance = new InstanceElement(
        'instance',
        new ObjectType({ elemID: new ElemID(ZENDESK, 'instance') }),
        { id: 123123 }
      )
      lookUpTemplate = new TemplateExpression({
        parts: [
          'lookup:ticket.ticket_field_',
          new ReferenceExpression(ticketField.elemID, ticketField),
          '.custom_fields.',
          new ReferenceExpression(customObjectField.elemID, customObjectField),
        ],
      })
    })
    describe('trigger', () => {
      const createTrigger = ({ actions = {}, conditions = {} }): InstanceElement => new InstanceElement(
        'trigger',
        new ObjectType({ elemID: new ElemID(ZENDESK, TRIGGER_TYPE_NAME) }),
        {
          actions,
          conditions,
        }
      )
      it('should create reference expressions in actions and conditions', async () => {
        const trigger = createTrigger({
          actions: [
            {
              field: 'follower',
              value: `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.${customObjectField.value.key}`,
            },
            {
              field: 'notification_user',
              value: [
                `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.${customObjectField.value.key}`,
                'title',
                'body',
              ],
            },
          ],
        })
        await customObjectFieldsFilter.onFetch([ticketField, customObjectField, customObject, trigger])
        expect(trigger.value.actions[0].value).toMatchObject(lookUpTemplate)
        expect(trigger.value.actions[1].value[0]).toMatchObject(lookUpTemplate)
      })
      it('should create reference expressions in condition\'s value', async () => {
        const trigger = createTrigger({
          conditions: {
            all: [{
              field: `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.${customObjectField.value.key}`,
              operator: 'present',
            }],
            any: [
              {
                field: `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.${customObjectField.value.key}`,
                operator: 'is',
                value: valueInstance.value.id,
              },
              {
                field: `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.${customObjectField.value.key}`,
                operator: 'is_not',
                value: USER_ID,
              },
            ],
          },
        })
        await customObjectFieldsFilter.onFetch([ticketField, customObjectField, customObject, trigger, valueInstance])
        expect(trigger.value.conditions.all[0].field).toMatchObject(lookUpTemplate)
        expect(trigger.value.conditions.any[0].value)
          .toMatchObject(new ReferenceExpression(valueInstance.elemID, valueInstance))
        expect(trigger.value.conditions.any[1].value).toBe('User')
      })
      it('should create missing reference', async () => {
        const MISSING_ID = '999'
        const ticketFieldWithoutObject = ticketField.clone()
        ticketFieldWithoutObject.value.relationship_target_type = 'zen:custom_object:missing_obj'
        ticketFieldWithoutObject.value.id = 124
        const userCustomObjectField = customObjectField.clone()
        const organizationCustomObjectField = customObjectField.clone()
        const ticketFieldCustomObjectField = customObjectField.clone()
        const unknownCustomObjectField = customObjectField.clone()

        userCustomObjectField.value.relationship_target_type = 'zen:user'
        userCustomObjectField.value.key = 'user'
        organizationCustomObjectField.value.relationship_target_type = 'zen:organization'
        organizationCustomObjectField.value.key = 'organization'
        ticketFieldCustomObjectField.value.relationship_target_type = 'zen:ticket'
        ticketFieldCustomObjectField.value.key = 'ticket'
        unknownCustomObjectField.value.relationship_target_type = 'zen:bad_type'
        unknownCustomObjectField.value.key = 'bad_type'
        customObject.value.custom_object_fields.push(
          new ReferenceExpression(userCustomObjectField.elemID, userCustomObjectField),
          new ReferenceExpression(organizationCustomObjectField.elemID, organizationCustomObjectField),
          new ReferenceExpression(ticketFieldCustomObjectField.elemID, ticketFieldCustomObjectField),
          new ReferenceExpression(unknownCustomObjectField.elemID, unknownCustomObjectField),
        )

        const trigger = createTrigger({
          actions: [
            {
              field: 'follower',
              value: `lookup:ticket.ticket_field_${MISSING_ID}.custom_fields.key`,
            },
            {
              field: 'follower',
              value: `lookup:ticket.ticket_field_${ticketFieldWithoutObject.value.id}.custom_fields.key`,
            },
            {
              field: 'follower',
              value: `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.nonExistingKey`,
            },
          ],
          conditions: {
            all: [
              {
                field: `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.${userCustomObjectField.value.key}`,
                operator: 'is',
                value: 'non',
              },
              {
                field: `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.${organizationCustomObjectField.value.key}`,
                operator: 'is',
                value: 'non',
              },
              {
                field: `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.${ticketFieldCustomObjectField.value.key}`,
                operator: 'is',
                value: 'non',
              },
              {
                field: `lookup:ticket.ticket_field_${ticketField.value.id}.custom_fields.${unknownCustomObjectField.value.key}`,
                operator: 'is',
                value: 'non',
              },
            ],
          },
        })
        await customObjectFieldsFilter.onFetch([
          trigger,
          ticketField, ticketFieldWithoutObject,
          customObject, customObjectField,
          userCustomObjectField, organizationCustomObjectField, ticketFieldCustomObjectField, unknownCustomObjectField,
        ])
        expect(trigger.value.actions[0].value).toMatchObject(new TemplateExpression({ parts: [
          'lookup:ticket.ticket_field_',
          missingRef(TICKET_FIELD_TYPE_NAME, MISSING_ID),
          '.custom_fields.',
          'key',
        ] }))
        expect(trigger.value.actions[1].value).toMatchObject(new TemplateExpression({ parts: [
          'lookup:ticket.ticket_field_',
          new ReferenceExpression(ticketFieldWithoutObject.elemID, ticketFieldWithoutObject),
          '.custom_fields.',
          missingRef(CUSTOM_OBJECT_TYPE_NAME, 'missing_obj'),
        ] }))
        expect(trigger.value.actions[2].value).toMatchObject(new TemplateExpression({ parts: [
          'lookup:ticket.ticket_field_',
          new ReferenceExpression(ticketField.elemID, ticketField),
          '.custom_fields.',
          missingRef(CUSTOM_OBJECT_FIELD_TYPE_NAME, `${customObject.value.key}__nonExistingKey`),
        ] }))
        expect(trigger.value.conditions.all[0].value).toMatchObject(missingRef('user', 'non'))
        expect(trigger.value.conditions.all[1].value).toMatchObject(missingRef('organization', 'non'))
        expect(trigger.value.conditions.all[2].value).toMatchObject(missingRef(TICKET_FIELD_TYPE_NAME, 'non'))
        expect(trigger.value.conditions.all[3].value).toMatchObject(missingRef('unknown', 'non'))
      })
    })
    describe('ticket_field and custom_object_field', () => {
      let customObjectFieldOptions: InstanceElement
      beforeEach(() => {
        customObjectField.value.type = 'dropdown'
        customObjectFieldOptions = new InstanceElement(
          'options',
          new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME) }),
          { id: 123123 }
        )
      })
      const createInstance = ({ type = TICKET_FIELD_TYPE_NAME, relationshipFilter = {} }): InstanceElement =>
        new InstanceElement(
          type,
          new ObjectType({ elemID: new ElemID(ZENDESK, type) }),
          {
            relationship_filter: { all: relationshipFilter },
          }
        )
      it('should create reference expressions in ticket_field and custom_object_field relationships', async () => {
        const relationshipFilter = [{
          field: `custom_object.${customObject.value.key}.custom_fields.${customObjectField.value.key}`,
          operator: 'is',
          value: '123123',
        }]
        const ticketFieldInstance = createInstance({ relationshipFilter })
        const customObjectFieldInstance = createInstance({ type: CUSTOM_OBJECT_FIELD_TYPE_NAME, relationshipFilter })
        await customObjectFieldsFilter.onFetch([
          customObject, customObjectField, customObjectFieldOptions,
          ticketFieldInstance, customObjectFieldInstance,
        ])
        const templateExpression = new TemplateExpression({ parts: [
          'custom_object.',
          new ReferenceExpression(customObject.elemID, customObject),
          '.custom_fields.',
          new ReferenceExpression(customObjectField.elemID, customObjectField),
        ] })

        expect(ticketFieldInstance.value.relationship_filter.all[0].field).toMatchObject(templateExpression)
        expect(customObjectFieldInstance.value.relationship_filter.all[0].field).toMatchObject(templateExpression)
        const optionsRef = new ReferenceExpression(customObjectFieldOptions.elemID, customObjectFieldOptions)
        expect(ticketFieldInstance.value.relationship_filter.all[0].value).toMatchObject(optionsRef)
        expect(customObjectFieldInstance.value.relationship_filter.all[0].value).toMatchObject(optionsRef)
      })
      it('should create missing reference', async () => {
        const MISSING_ID = '999'
        const relationshipFilter = [
          {
            field: `custom_object.missing_object.custom_fields.${customObjectField.value.key}`,
            operator: 'is',
            value: '123123',
          },
          {
            field: `custom_object.${customObject.value.key}.custom_fields.missing_object_field`,
            operator: 'is',
            value: '123123',
          },
          {
            field: `custom_object.${customObject.value.key}.custom_fields.${customObjectField.value.key}`,
            operator: 'is',
            value: MISSING_ID,
          },
        ]
        const ticketFieldInstance = createInstance({ relationshipFilter })
        const customObjectFieldInstance = createInstance({ type: CUSTOM_OBJECT_FIELD_TYPE_NAME, relationshipFilter })
        await customObjectFieldsFilter.onFetch([
          customObject, customObjectField, customObjectFieldOptions,
          ticketFieldInstance, customObjectFieldInstance,
        ])
        expect(ticketFieldInstance.value.relationship_filter.all[0].field)
          .toMatchObject(new TemplateExpression({ parts: [
            'custom_object.',
            missingRef(CUSTOM_OBJECT_TYPE_NAME, 'missing_object'),
            '.custom_fields.',
            customObjectField.value.key,
          ] }))
        expect(customObjectFieldInstance.value.relationship_filter.all[1].field)
          .toMatchObject(new TemplateExpression({ parts: [
            'custom_object.',
            new ReferenceExpression(customObject.elemID, customObject),
            '.custom_fields.',
            missingRef(CUSTOM_OBJECT_FIELD_TYPE_NAME, 'missing_object_field'),
          ] }))
        const missingOptionsRef = missingRef(CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME, MISSING_ID)
        expect(customObjectFieldInstance.value.relationship_filter.all[2].value).toMatchObject(missingOptionsRef)
      })
    })
  })
})
