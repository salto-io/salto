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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ZENDESK } from '../../src/constants'
import { onlyOneTicketFormDefaultValidator, TICKET_FORM_TYPE_NAME } from '../../src/change_validators/ticket_form_default'

describe('onlyOneTicketFormDefaultValidator', () => {
  const ticketFormType = new ObjectType({
    elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME),
  })
  const defaultTicketForm = new InstanceElement(
    'ticketForm1',
    ticketFormType,
    { name: 'test1', default: true },
  )
  const anotherDefaultTicketForm = new InstanceElement(
    'ticketForm2',
    ticketFormType,
    { name: 'test2', default: true },
  )
  const nonDefaultTicketForm = new InstanceElement(
    'ticketForm3',
    ticketFormType,
    { name: 'test3', default: false },
  )
  it('should return an error when we add another default ticket form', async () => {
    const errors = await onlyOneTicketFormDefaultValidator(
      [toChange({ after: anotherDefaultTicketForm })],
      buildElementsSourceFromElements([ticketFormType, defaultTicketForm, anotherDefaultTicketForm])
    )
    expect(errors).toEqual([{
      elemID: anotherDefaultTicketForm.elemID,
      severity: 'Error',
      message: 'Cannot set this as the default ticket form since another one is already defined as the default',
      detailedMessage: `The following ticket forms are also marked as default: ${defaultTicketForm.elemID.getFullName()}`,
    }])
  })
  it('should not return an error when we remove an item', async () => {
    const errors = await onlyOneTicketFormDefaultValidator(
      [toChange({ before: anotherDefaultTicketForm })],
      buildElementsSourceFromElements([ticketFormType, defaultTicketForm])
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if the default value was not changed', async () => {
    const afterAnotherDefaultTicketForm = anotherDefaultTicketForm.clone()
    afterAnotherDefaultTicketForm.value.name = 'test3'
    const errors = await onlyOneTicketFormDefaultValidator(
      [toChange({ before: anotherDefaultTicketForm, after: afterAnotherDefaultTicketForm })],
      buildElementsSourceFromElements([
        ticketFormType, defaultTicketForm, afterAnotherDefaultTicketForm,
      ])
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when we add a non default variant', async () => {
    const errors = await onlyOneTicketFormDefaultValidator(
      [toChange({ after: nonDefaultTicketForm })],
      buildElementsSourceFromElements([ticketFormType, defaultTicketForm, nonDefaultTicketForm])
    )
    expect(errors).toEqual([])
  })
  it('should not return an error when there is no element source', async () => {
    const errors = await onlyOneTicketFormDefaultValidator(
      [toChange({ after: anotherDefaultTicketForm })],
    )
    expect(errors).toEqual([])
  })
  it('should not return an error when we add the first default', async () => {
    const errors = await onlyOneTicketFormDefaultValidator(
      [toChange({ after: defaultTicketForm })],
      buildElementsSourceFromElements([ticketFormType, nonDefaultTicketForm])
    )
    expect(errors).toEqual([])
  })
})
