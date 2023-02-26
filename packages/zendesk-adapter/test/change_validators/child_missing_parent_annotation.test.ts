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
import { AdditionChange, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange, ModificationChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import {
  childMissingParentAnnotationValidatorCreator,
} from '../../src/change_validators/child_parent/child_missing_parent_annotation'
import { CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../src/filters/custom_field_options/creator'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../../src/config'

describe('childMissingParentAnnotationValidatorCreator', () => {
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
  const option3 = new InstanceElement(
    'option3', ticketFieldOptionType, { name: 'test3', value: 'v3' },
  )
  const optionWithoutAParent = new InstanceElement(
    'optionWithoutAParent', ticketFieldOptionType, { name: 'test4', value: 'v4' },
  )
  const ticketField = new InstanceElement(
    'ticketFieldInstance1',
    ticketFieldType,
    {
      name: 'test1',
      [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
        new ReferenceExpression(option1.elemID, option1),
        new ReferenceExpression(option3.elemID, option3),
      ],
    },
  )
  const anotherTicketField = new InstanceElement(
    'ticketFieldInstance2',
    ticketFieldType,
    {
      name: 'test2',
      [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
        new ReferenceExpression(option2.elemID, option2),
      ],
    },
  )
  option1.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(ticketField.elemID, ticketField),
  ]
  option2.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(anotherTicketField.elemID, anotherTicketField),
  ]
  option3.annotations[CORE_ANNOTATIONS.PARENT] = [
    new ReferenceExpression(ticketField.elemID, ticketField),
  ]
  it('should return an error when we add a ticket_field instance but child _parent is not modified to it', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(option1.elemID, option1),
      new ReferenceExpression(option2.elemID, option2),
    ]

    const addTicketField = toChange({ after: clonedTicketField }) as AdditionChange<InstanceElement>
    const errors = await childMissingParentAnnotationValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      addTicketField,
      toChange({ after: anotherTicketField }),
      toChange({ after: option2 }),
    ])
    expect(errors)
      .toEqual([{
        elemID: clonedTicketField.elemID,
        severity: 'Error',
        message: 'Cannot add or modify elements without updating references to them from their children',
        detailedMessage: `This element must be referenced by its child ‘${option2.elemID.getFullName()}‘`,
      }])
  })
  it('should return an error when we modify a ticket_field instance but child _parent is not modified', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(option1.elemID, option1),
      new ReferenceExpression(option2.elemID, option2),
    ]

    const modifyTicketField = toChange({
      before: ticketField,
      after: clonedTicketField,
    }) as ModificationChange<InstanceElement>
    const errors = await childMissingParentAnnotationValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      modifyTicketField,
      toChange({ after: anotherTicketField }),
      toChange({ after: option2 }),
    ])
    expect(errors)
      .toEqual([{
        elemID: clonedTicketField.elemID,
        severity: 'Error',
        message: 'Cannot add or modify elements without updating references to them from their children',
        detailedMessage: `This element must be referenced by its child ‘${option2.elemID.getFullName()}‘`,
      }])
  })
  it('should not return an error when we add a ticket_field instance and child _parent is modified', async () => {
    const clonedTicketField = ticketField.clone()

    const addTicketField = toChange({ after: clonedTicketField }) as AdditionChange<InstanceElement>
    const errors = await childMissingParentAnnotationValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      addTicketField,
      toChange({ after: anotherTicketField }),
    ])
    expect(errors)
      .toEqual([])
  })
  it('should not return an error when we modify a ticket_field instance and child _parent is modified', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(option2.elemID, option2),
    ]

    const modifyTicketField = toChange({
      before: clonedTicketField,
      after: ticketField,
    }) as ModificationChange<InstanceElement>
    const errors = await childMissingParentAnnotationValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      modifyTicketField,
      toChange({ after: anotherTicketField }),
    ])
    expect(errors)
      .toEqual([])
  })
  it('should ignore unrelevant changes', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value.name = 'newName'

    const modifyTicketField = toChange({
      before: clonedTicketField,
      after: ticketField,
    }) as ModificationChange<InstanceElement>
    const errors = await childMissingParentAnnotationValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      modifyTicketField,
    ])
    expect(errors)
      .toEqual([])
  })
  it('should return an error when we add a ticket_field instance but the child instance has no _parent annotation', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(optionWithoutAParent.elemID, optionWithoutAParent),
    ]

    const addTicketField = toChange({ after: clonedTicketField }) as AdditionChange<InstanceElement>
    const errors = await childMissingParentAnnotationValidatorCreator(
      DEFAULT_CONFIG[API_DEFINITIONS_CONFIG]
    )([
      addTicketField,
    ])
    expect(errors)
      .toEqual([{
        elemID: clonedTicketField.elemID,
        severity: 'Error',
        message: 'Cannot add or modify elements without updating references to them from their children',
        detailedMessage: `This element must be referenced by its child ‘${optionWithoutAParent.elemID.getFullName()}‘`,
      }])
  })
})
