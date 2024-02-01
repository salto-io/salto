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
  InstanceElement,
  ObjectType,
  ElemID,
  toChange, ReferenceExpression,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { TICKET_FORM_TYPE_NAME, VIEW_TYPE_NAME, ZENDESK } from '../../src/constants'
import { viewWithNoInactiveTicketsValidator } from '../../src/change_validators'

const createTicketForm = (name: string, active: boolean): InstanceElement => new InstanceElement(
  name,
  new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }),
  { active },
)

const createViewWithTicketFormCondition = (name: string, ticketForms: ElemID[]): InstanceElement => new InstanceElement(
  name,
  new ObjectType({ elemID: new ElemID(ZENDESK, VIEW_TYPE_NAME) }),
  {
    conditions:
    {
      all: ticketForms
        .map(form =>
          ({
            field: 'ticket_form_id',
            operator: 'is',
            value: new ReferenceExpression(form),
          })),
    },
  }
)

describe('viewWithNoInactiveTicketsValidator', () => {
  let deactivatedTicketForm: InstanceElement
  let activeTicketForm: InstanceElement
  let viewWithDeactivatedTicket: InstanceElement
  beforeEach(() => {
    deactivatedTicketForm = createTicketForm('deactivatedTicketForm', false)
    activeTicketForm = createTicketForm('activeTicketForm', true)
    viewWithDeactivatedTicket = createViewWithTicketFormCondition('view', [deactivatedTicketForm.elemID, activeTicketForm.elemID])
  })

  it('should return an error when view is changed to have a deactivated ticket form referenced in a condition', async () => {
    const elementsSource = buildElementsSourceFromElements([deactivatedTicketForm, activeTicketForm])
    const changes = [
      toChange({ after: viewWithDeactivatedTicket }),
    ]
    const errors = await viewWithNoInactiveTicketsValidator(changes, elementsSource)

    expect(errors[0]).toEqual({
      elemID: viewWithDeactivatedTicket.elemID,
      severity: 'Error',
      message: 'Deactivated Ticket Forms linked to a view',
      detailedMessage: `Deactivated ticket forms cannot be used in the conditions of a view. The Deactivated forms used are: ${deactivatedTicketForm.elemID.name}`,
    })
  })
  it('should return an error when  view is changed and a ticket form referenced in a condition is changed to be deactivated', async () => {
    const activeTicketFormDeactivated = activeTicketForm.clone()
    activeTicketFormDeactivated.value.active = false

    const elementsSource = buildElementsSourceFromElements([deactivatedTicketForm, activeTicketFormDeactivated])

    const changes = [
      toChange({ after: viewWithDeactivatedTicket }),
      toChange({ before: activeTicketForm, after: activeTicketFormDeactivated }),
    ]
    const errors = await viewWithNoInactiveTicketsValidator(changes, elementsSource)

    expect(errors[0]).toEqual({
      elemID: viewWithDeactivatedTicket.elemID,
      severity: 'Error',
      message: 'Deactivated Ticket Forms linked to a view',
      detailedMessage: `Deactivated ticket forms cannot be used in the conditions of a view. The Deactivated forms used are: ${[deactivatedTicketForm.elemID.name, activeTicketFormDeactivated.elemID.name].join(', ')}`,
    })
  })
})
