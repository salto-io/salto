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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { ZENDESK_SUPPORT } from '../../src/constants'
import {
  removedFromParentValidatorCreator,
} from '../../src/change_validators/child_parent/removed_from_parent'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../src/filters/custom_field_options/creator'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../../src/config'

describe('removedFromParentValidatorCreator', () => {
  const ticketFieldType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'ticket_field'),
  })
  const ticketFieldOptionType = new ObjectType({
    elemID: new ElemID(ZENDESK_SUPPORT, 'ticket_field__custom_field_options'),
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
  it('should return an error when remove an option from the parent but keep the instance', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(option1.elemID, option1),
    ]
    const errors = await removedFromParentValidatorCreator(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])([
      toChange({ before: ticketField, after: clonedTicketField }),
    ])
    expect(errors).toEqual([{
      elemID: clonedTicketField.elemID,
      severity: 'Error',
      message: `Can not change ${clonedTicketField.elemID.typeName} because there are removed references to children instances while the children instances still exist`,
      detailedMessage: `Can not change ${clonedTicketField.elemID.getFullName()} because there are removed references in custom_field_options, but the instances still exist: ${option2.elemID.getFullName()}`,
    }])
  })
  it('should not return an error when remove an option from the parent and remove the instance as well', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(option1.elemID, option1),
    ]
    const errors = await removedFromParentValidatorCreator(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])([
      toChange({ before: option2 }),
      toChange({ before: ticketField, after: clonedTicketField }),
    ])
    expect(errors).toEqual([])
  })
})
