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
import { InstanceElement, ObjectType, ElemID, toChange, ReferenceExpression } from '@salto-io/adapter-api'
import { TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME, ZENDESK } from '../../src/constants'
import { conditionalTicketFieldsValidator } from '../../src/change_validators'

const createTicketFieldInstance = (name: string, id: number): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) }), { id })

const createTicketFormInstance = (
  name: string,
  shouldPutIds: boolean,
  ticketFields?: (number | ReferenceExpression)[],
  childTicketFields?: (number | ReferenceExpression)[],
): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }), {
    ticket_field_ids: shouldPutIds ? [...(ticketFields ?? []), ...(childTicketFields ?? [])] : [],
    agent_conditions: ticketFields?.map(id => ({
      parent_field_id: id,
      child_fields: childTicketFields?.map(childId => ({ id: childId })),
    })),
  })

describe('conditionalTicketFieldsValidator', () => {
  let ticketField1: InstanceElement
  let ticketField2: InstanceElement
  let ticketForm: InstanceElement
  beforeEach(() => {
    ticketField1 = createTicketFieldInstance('ticketField1', 1)
    ticketField2 = createTicketFieldInstance('ticketField2', 2)
    ticketForm = createTicketFormInstance(
      'ticketForm',
      false,
      [1, 2],
      [
        new ReferenceExpression(ticketField1.elemID, ticketField1),
        new ReferenceExpression(ticketField2.elemID, ticketField2),
      ],
    )
  })
  it('should prevent deployment of ticket form with conditional fields that are not in the ticket fields list', async () => {
    const changes = [toChange({ before: ticketForm, after: ticketForm }), toChange({ after: ticketForm })]
    const errors = await conditionalTicketFieldsValidator(changes)
    expect(errors).toMatchObject([
      {
        elemID: ticketForm.elemID,
        severity: 'Error',
        message: "The conditional ticket field is not present in the form's ticket_field_ids",
        detailedMessage:
          "To utilize a ticket field as a conditional ticket field, it must be included in the 'ticket_field_ids' list. Invalid fields include: 1, ticketField1, ticketField2, 2",
      },
      {
        elemID: ticketForm.elemID,
        severity: 'Error',
        message: "The conditional ticket field is not present in the form's ticket_field_ids",
        detailedMessage:
          "To utilize a ticket field as a conditional ticket field, it must be included in the 'ticket_field_ids' list. Invalid fields include: 1, ticketField1, ticketField2, 2",
      },
    ])
  })
  it('should ignore fields with invalid type', async () => {
    const ticketForm1 = ticketForm.clone()
    const ticketForm2 = ticketForm.clone()
    ticketForm1.value.agent_conditions = { parent_field_id: 1, child_fields: [{ id: 2 }] }
    ticketForm1.value.end_user_conditions = [{ parent_field_id: new ReferenceExpression(ticketField1.elemID) }]
    ticketForm2.value.ticket_field_ids = 1

    const changes = [toChange({ after: ticketForm1 }), toChange({ after: ticketForm2 })]
    const errors = await conditionalTicketFieldsValidator(changes)
    expect(errors.length).toBe(0)
  })
  it('should return nothing when all conditional ticket fields exists', async () => {
    ticketForm.value.ticket_field_ids = [ticketField1.value.id, ticketField2.value.id]
    const errors = await conditionalTicketFieldsValidator([toChange({ after: ticketForm })])
    expect(errors.length).toBe(0)
  })
})
