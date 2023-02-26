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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ZENDESK } from '../../src/constants'
import { duplicateCustomFieldOptionValuesValidator } from '../../src/change_validators/duplicate_option_values'

describe('duplicateCustomFieldOptionValuesValidator', () => {
  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field') })
  const ticketFieldOptionType = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options') })
  const checkboxTicketField = new InstanceElement(
    'checkbox',
    ticketFieldType,
    { type: 'checkbox', title: 'myCheckbox', tag: 'cTag' },
  )
  const checkboxWithNullTagTicketField = new InstanceElement(
    'emptyCheckbox1',
    ticketFieldType,
    { type: 'checkbox', title: 'emptyCheckbox1', tag: null },
  )
  const checkboxWithEmptyTagAsStringTicketField = new InstanceElement(
    'emptyCheckbox2',
    ticketFieldType,
    { type: 'checkbox', title: 'emptyCheckbox2', tag: '' },
  )
  const ticketFieldOption1 = new InstanceElement(
    'option1',
    ticketFieldOptionType,
    { name: 'v1', value: 'v1' },
  )
  const ticketFieldOption2 = new InstanceElement(
    'option2',
    ticketFieldOptionType,
    { name: 'v2', value: 'v2' },
  )
  const taggerTicketField = new InstanceElement(
    'tagger',
    ticketFieldType,
    {
      type: 'tagger',
      title: 'myTagger',
      custom_field_options: [
        new ReferenceExpression(ticketFieldOption1.elemID, ticketFieldOption1),
        new ReferenceExpression(ticketFieldOption2.elemID, ticketFieldOption2),
      ],
    },
  )
  it('should return an error when we add an existing value', async () => {
    const optionToAdd = new InstanceElement(
      'option3', ticketFieldOptionType, { name: 'v3', value: 'cTag' }
    )
    const checkboxToAdd = new InstanceElement(
      'checkbox2', ticketFieldType, { type: 'checkbox', title: 'myCheckbox2', tag: 'cTag' }
    )
    const elementsSource = buildElementsSourceFromElements([
      ticketFieldType, ticketFieldOptionType, checkboxTicketField, ticketFieldOption1,
      ticketFieldOption2, taggerTicketField, optionToAdd, checkboxToAdd,
      checkboxWithNullTagTicketField, checkboxWithEmptyTagAsStringTicketField,
    ].map(e => e.clone()))
    const elementsToAdd = [optionToAdd, checkboxToAdd]
    const errors = await duplicateCustomFieldOptionValuesValidator(
      elementsToAdd.map(e => toChange({ after: e })),
      elementsSource,
    )
    expect(errors).toHaveLength(2)
    expect(errors).toEqual([
      {
        elemID: optionToAdd.elemID,
        severity: 'Error',
        message: 'Cannot do this change since this tag value is already in use',
        detailedMessage: `The tag ‘cTag’ is already used by the following elements:
${[checkboxTicketField.elemID.getFullName(), checkboxToAdd.elemID.getFullName()].join(', ')}`,
      },
      {
        elemID: checkboxToAdd.elemID,
        severity: 'Error',
        message: 'Cannot do this change since this tag value is already in use',
        detailedMessage: `The tag ‘cTag’ is already used by the following elements:
${[optionToAdd.elemID.getFullName(), checkboxTicketField.elemID.getFullName()].join(', ')}`,
      },
    ])
  })
  it('should return no error if there are no conflicts', async () => {
    const checkboxToAdd = new InstanceElement(
      'checkbox2', ticketFieldType, { type: 'checkbox', title: 'myCheckbox2', tag: 'newValue' }
    )
    const elementsSource = buildElementsSourceFromElements([
      ticketFieldType, ticketFieldOptionType, checkboxTicketField, ticketFieldOption1,
      ticketFieldOption2, taggerTicketField, checkboxToAdd,
      checkboxWithNullTagTicketField, checkboxWithEmptyTagAsStringTicketField,
    ].map(e => e.clone()))
    const errors = await duplicateCustomFieldOptionValuesValidator(
      [toChange({ after: checkboxToAdd })],
      elementsSource,
    )
    expect(errors).toHaveLength(0)
  })
  it('should return no errors if the changes are irrelevant', async () => {
    const checkboxToRemove = new InstanceElement(
      'checkbox2', ticketFieldType, { type: 'checkbox', title: 'myCheckbox2', tag: 'newValue' }
    )
    const textToAdd = new InstanceElement(
      'text', ticketFieldType, { type: 'text', title: 'text' }
    )
    const optionToChangeBefore = new InstanceElement(
      'option3', ticketFieldOptionType, { name: 'v3', value: 'cTag' }
    )
    const optionToChangeAfter = new InstanceElement(
      'option3', ticketFieldOptionType, { name: 'v4', value: 'cTag' }
    )
    const checkboxToChangeBefore = new InstanceElement(
      'checkbox3', ticketFieldType, { type: 'checkbox', title: 'myCheckbox3', tag: 'newValue2' }
    )
    const checkboxToChangeAfter = new InstanceElement(
      'checkbox3', ticketFieldType, { type: 'checkbox', title: 'myCheckbox4', tag: 'newValue2' }
    )
    const instanceOfIrrelevantType = new InstanceElement(
      'inst', new ObjectType({ elemID: new ElemID(ZENDESK, 'test') }), { name: 'v3', value: 'cTag' }
    )
    const elementsSource = buildElementsSourceFromElements([
      ticketFieldType, ticketFieldOptionType, checkboxTicketField, ticketFieldOption1,
      ticketFieldOption2, taggerTicketField, optionToChangeAfter, checkboxToChangeAfter,
      instanceOfIrrelevantType, textToAdd,
      checkboxWithNullTagTicketField, checkboxWithEmptyTagAsStringTicketField,
    ].map(e => e.clone()))
    const errors = await duplicateCustomFieldOptionValuesValidator(
      [
        toChange({ after: textToAdd }),
        toChange({ before: checkboxToRemove }),
        toChange({ before: optionToChangeBefore, after: optionToChangeAfter }),
        toChange({ before: checkboxToChangeBefore, after: checkboxToChangeAfter }),
        toChange({ after: instanceOfIrrelevantType }),
      ],
      elementsSource,
    )
    expect(errors).toHaveLength(0)
  })
  it('should return no error if we add another checkbox with empty tag', async () => {
    const checkboxToAddNullTag = new InstanceElement(
      'checkbox2', ticketFieldType, { type: 'checkbox', title: 'myCheckbox2', tag: null }
    )
    const checkboxToAddEmptyStrTag = new InstanceElement(
      'checkbox3', ticketFieldType, { type: 'checkbox', title: 'myCheckbox3', tag: '' }
    )
    const elementsSource = buildElementsSourceFromElements([
      ticketFieldType, ticketFieldOptionType, checkboxTicketField, ticketFieldOption1,
      ticketFieldOption2, taggerTicketField, checkboxToAddNullTag, checkboxToAddEmptyStrTag,
      checkboxWithNullTagTicketField, checkboxWithEmptyTagAsStringTicketField,
    ].map(e => e.clone()))
    const errors = await duplicateCustomFieldOptionValuesValidator(
      [toChange({ after: checkboxToAddNullTag }), toChange({ after: checkboxToAddEmptyStrTag })],
      elementsSource,
    )
    expect(errors).toHaveLength(0)
  })
})
