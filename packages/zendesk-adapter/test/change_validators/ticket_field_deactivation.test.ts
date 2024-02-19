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
import { elementSource as elementSourceUtils } from '@salto-io/workspace'
import { TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME, ZENDESK } from '../../src/constants'
import { ticketFieldDeactivationValidator } from '../../src/change_validators'

const { createInMemoryElementSource } = elementSourceUtils

const createTicketFieldInstance = (name: string, id: number): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) }), {
    id,
    active: true,
  })

const createTicketFormInstance = (
  name: string,
  ticketFields?: (number | ReferenceExpression)[],
  childTicketFields?: (number | ReferenceExpression)[],
): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }), {
    agent_conditions: ticketFields?.map(id => ({
      parent_field_id: id,
      child_fields: childTicketFields?.map(childId => ({ id: childId })),
    })),
  })

describe('ticketFieldDeactivationValidator', () => {
  it('should not return an error when no ticket fields are deactivated', async () => {
    const ticketField = createTicketFieldInstance('ticketField', 1)
    const ticketForm = createTicketFormInstance('ticketForm', [1])
    const changes = [toChange({ before: ticketField, after: ticketField })]

    const elementSource = createInMemoryElementSource([ticketField, ticketForm])
    const errors = await ticketFieldDeactivationValidator(changes, elementSource)
    expect(errors).toEqual([])
  })

  it('should not an error when a ticket field is deactivated and is not used as a condition', async () => {
    const ticketField1 = createTicketFieldInstance('ticketField1', 1)
    const ticketField2 = createTicketFieldInstance('ticketField2', 2)
    ticketField1.value.active = false
    const ticketForm = createTicketFormInstance('ticketForm')
    const changes = [toChange({ before: ticketField1, after: ticketField1 }), toChange({ before: ticketField2 })]

    const elementSource = createInMemoryElementSource([ticketField1, ticketField2, ticketForm])
    const errors = await ticketFieldDeactivationValidator(changes, elementSource)
    expect(errors).toEqual([])
  })

  it('should return an error when a ticket field is deactivated and is used as a condition', async () => {
    const ticketField1 = createTicketFieldInstance('ticketField1', 1)
    const ticketField2 = createTicketFieldInstance('ticketField2', 2)
    const ticketField1Deactivated = ticketField1.clone()
    ticketField1Deactivated.value.active = false
    const ticketForm1 = createTicketFormInstance('ticketForm1', [1], [2])
    const ticketForm2 = createTicketFormInstance(
      'ticketForm2',
      [new ReferenceExpression(ticketField1.elemID)],
      [new ReferenceExpression(ticketField2.elemID)],
    )
    const changes = [
      toChange({ before: ticketField1, after: ticketField1Deactivated }),
      toChange({ before: ticketField2 }),
    ]

    const elementSource = createInMemoryElementSource([ticketField1, ticketField2, ticketForm1, ticketForm2])
    const errors = await ticketFieldDeactivationValidator(changes, elementSource)
    expect(errors).toMatchObject([
      {
        elemID: ticketField1.elemID,
        severity: 'Error',
        message: 'Deactivation of a conditional ticket field',
        detailedMessage:
          'Cannot remove this ticket field because it is configured as a conditional field in the following ticket forms: ticketForm1, ticketForm2',
      },
      {
        elemID: ticketField2.elemID,
        severity: 'Error',
        message: 'Deactivation of a conditional ticket field',
        detailedMessage:
          'Cannot remove this ticket field because it is configured as a conditional field in the following ticket forms: ticketForm1, ticketForm2',
      },
    ])
  })
})
