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
  AdditionChange,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { elementSource } from '@salto-io/workspace'
import { ZENDESK, CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../src/constants'
import {
  createParentReferencesError,
  missingFromParentValidatorCreator,
} from '../../src/change_validators/child_parent/missing_from_parent'
import { API_DEFINITIONS_CONFIG, DEFAULT_CONFIG } from '../../src/config'

describe('missingFromParentValidatorCreator', () => {
  const ticketFieldType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field'),
  })
  const ticketFieldOptionType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'ticket_field__custom_field_options'),
  })
  const option1 = new InstanceElement('option1', ticketFieldOptionType, { name: 'test1', value: 'v1' })
  const option2 = new InstanceElement('option2', ticketFieldOptionType, { name: 'test2', value: 'v2' })
  const option3 = new InstanceElement('option3', ticketFieldOptionType, { name: 'test3', value: 'v3' })
  const ticketField = new InstanceElement('field', ticketFieldType, {
    name: 'test1',
    [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [new ReferenceExpression(option1.elemID, option1)],
  })
  option1.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(ticketField.elemID, ticketField)]
  option2.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(ticketField.elemID, ticketField)]
  option3.annotations[CORE_ANNOTATIONS.PARENT] = [new ReferenceExpression(ticketField.elemID, ticketField)]
  it('should return an error when we add an option instance but it does not exist in the parent - parent modified', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(option1.elemID, option1),
      new ReferenceExpression(option2.elemID, option2),
    ]
    const addOption3 = toChange({ after: option3 }) as AdditionChange<InstanceElement>
    const errors = await missingFromParentValidatorCreator(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])(
      [toChange({ after: option2 }), addOption3, toChange({ before: ticketField, after: clonedTicketField })],
      elementSource.createInMemoryElementSource([clonedTicketField, ticketFieldType]),
    )
    expect(errors).toEqual([createParentReferencesError(addOption3, ticketField.elemID.getFullName())])
  })
  it('should return an error when we add an option instance but it does not exist in the parent - parent is not modified', async () => {
    const addOption2 = toChange({ after: option2 }) as AdditionChange<InstanceElement>
    const errors = await missingFromParentValidatorCreator(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])(
      [toChange({ after: option2 })],
      elementSource.createInMemoryElementSource([ticketField, ticketFieldType]),
    )
    expect(errors).toEqual([createParentReferencesError(addOption2, ticketField.elemID.getFullName())])
  })
  it('should not return an error when we add an option and add it to the parent as well', async () => {
    const clonedTicketField = ticketField.clone()
    clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME] = [
      new ReferenceExpression(option1.elemID, option1),
      new ReferenceExpression(option2.elemID, option2),
    ]
    const errors = await missingFromParentValidatorCreator(DEFAULT_CONFIG[API_DEFINITIONS_CONFIG])(
      [toChange({ after: option2 }), toChange({ before: ticketField, after: clonedTicketField })],
      elementSource.createInMemoryElementSource([clonedTicketField, ticketFieldType]),
    )
    expect(errors).toEqual([])
  })
})
