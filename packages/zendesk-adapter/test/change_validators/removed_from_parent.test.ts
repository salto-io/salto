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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import {
  removedFromParentValidatorCreator,
} from '../../src/change_validators/child_parent/removed_from_parent'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../src/filters/custom_field_options/creator'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../../src/config'

describe('removedFromParentValidatorCreator', () => {
  describe('ticket/user/organization field', () => {
    const ticketFieldType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'ticket_field'),
    })
    const ticketFieldOptionType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options'),
    })
    const option1 = new InstanceElement(
      'option1', ticketFieldOptionType, { name: 'test1', value: 'v1' },
    )
    const option2 = new InstanceElement(
      'option2', ticketFieldOptionType, { name: 'test2', value: 'v2' },
    )
    const ticketField = new InstanceElement(
      'field',
      ticketFieldType,
      {
        name: 'test1',
        [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
          new ReferenceExpression(option1.elemID, option1),
          new ReferenceExpression(option2.elemID, option2),
        ],
      },
    )
    option1.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(ticketField.elemID, ticketField),
    ]
    option2.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(ticketField.elemID, ticketField),
    ]
    it('should return a warning when removing an option from the parent but keeping the instance', async () => {
      const clonedTicketField = ticketField.clone()
      clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
        new ReferenceExpression(option1.elemID, option1),
      ]
      const errors = await removedFromParentValidatorCreator(
        DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
      )([
        toChange({ before: ticketField, after: clonedTicketField }),
      ])
      expect(errors).toEqual([{
        elemID: clonedTicketField.elemID,
        severity: 'Warning',
        message: `Removing ${CUSTOM_FIELD_OPTIONS_FIELD_NAME} from ${clonedTicketField.elemID.typeName} will also remove related instances`,
        detailedMessage: `The following ${CUSTOM_FIELD_OPTIONS_FIELD_NAME} are no longer referenced from ${clonedTicketField.elemID.typeName} "${clonedTicketField.elemID.name}", but the instances still exist:
- ${option2.elemID.name}

If you continue with the deploy they will be removed from the service, and any references to them will break. It is recommended to remove these options in Salto first and deploy again.`,
      }])
    })
    it('should not return an error when remove an option from the parent and remove the instance as well', async () => {
      const clonedTicketField = ticketField.clone()
      clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
        new ReferenceExpression(option1.elemID, option1),
      ]
      const errors = await removedFromParentValidatorCreator(
        DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
      )([
        toChange({ before: option2 }),
        toChange({ before: ticketField, after: clonedTicketField }),
      ])
      expect(errors).toEqual([])
    })
  })
  describe('other types', () => {
    const dynamicContentItemType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'dynamic_content_item'),
    })
    const dynamicContentItemVariantsType = new ObjectType({
      elemID: new ElemID(ZENDESK, 'dynamic_content_item__variants'),
    })
    const variant1 = new InstanceElement(
      'variant1', dynamicContentItemVariantsType, { name: 'test1' },
    )
    const variant2 = new InstanceElement(
      'variant2', dynamicContentItemVariantsType, { name: 'test2' },
    )
    const dynamicContentItem = new InstanceElement(
      'content',
      dynamicContentItemType,
      {
        name: 'bla',
        variants: [
          new ReferenceExpression(variant1.elemID, variant1),
          new ReferenceExpression(variant2.elemID, variant2),
        ],
      },
    )
    variant1.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(dynamicContentItem.elemID, dynamicContentItem),
    ]
    variant1.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(dynamicContentItem.elemID, dynamicContentItem),
    ]
    it('should return a warning when removing an option from the parent but keeping the instance', async () => {
      const clonedDynamicContentItem = dynamicContentItem.clone()
      clonedDynamicContentItem.value.variants = [
        new ReferenceExpression(variant1.elemID, variant2),
      ]
      const errors = await removedFromParentValidatorCreator(
        DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
      )([
        toChange({ before: dynamicContentItem, after: clonedDynamicContentItem }),
      ])
      expect(errors).toEqual([{
        elemID: clonedDynamicContentItem.elemID,
        severity: 'Error',
        message: 'Cannot remove this element since it is referenced by its children',
        detailedMessage: `Cannot remove this element since it is referred to by the following children: ${variant2.elemID.getFullName()}
Please make sure to remove these references in order to remove the element`,
      }])
    })
    it('should not return an error when remove an option from the parent and remove the instance as well', async () => {
      const clonedDynamicContentItem = dynamicContentItem.clone()
      clonedDynamicContentItem.value.variants = [
        new ReferenceExpression(variant1.elemID, variant1),
      ]
      const errors = await removedFromParentValidatorCreator(
        DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
      )([
        toChange({ before: variant2 }),
        toChange({ before: dynamicContentItem, after: clonedDynamicContentItem }),
      ])
      expect(errors).toEqual([])
    })
  })
})
