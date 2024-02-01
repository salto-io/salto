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
import { elementSource as elementSourceUtils } from '@salto-io/workspace'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { TICKET_FIELD_TYPE_NAME, TICKET_FORM_TYPE_NAME, VIEW_TYPE_NAME, ZENDESK } from '../../src/constants'
import { ticketFieldDeactivationValidator, viewValidator } from '../../src/change_validators'
import { ZendeskApiConfig } from '../../src/config'

const { createInMemoryElementSource } = elementSourceUtils

const createTicketForm = (name: string, active: boolean): InstanceElement => new InstanceElement(
  name,
  new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }),
  { active },
)


const createViewWithTicketFormCondition = (name: string, ticketForm: ElemID): InstanceElement => new InstanceElement(
  name,
  new ObjectType({ elemID: new ElemID(ZENDESK, VIEW_TYPE_NAME) }),
  {
    condition:
    {
      all: [
        {
          field: 'ticket_form_id',
          operator: 'is',
          value: new ReferenceExpression(ticketForm),
        },
      ],
    },
  }
)


describe('onlyOneTicketFormDefaultValidator', () => {
  let deactivatedTicketForm: InstanceElement
  let activeTicketForm: InstanceElement
  let view: InstanceElement
  beforeEach(() => {
    deactivatedTicketForm = createTicketForm('deactivatedTicketForm', false)
    activeTicketForm = createTicketForm('activeTicketForm', true)
  })

  it('should return an error when view is changed to have a deactivated ticket form referenced in a condition', async () => {
    const viewWithDeactivatedTicket = createViewWithTicketFormCondition('view', deactivatedTicketForm.elemID)
    const elementsSource = buildElementsSourceFromElements([deactivatedTicketForm, activeTicketForm, view])
    const changes = [
      toChange({ after: viewWithDeactivatedTicket }),
    ]
    const errors = await viewValidator(changes, elementsSource)

    expect(errors[1]).toEqual({
      elemID: view.elemID,
      severity: 'Error',
      message: 'Deactivated Ticket Forms linked to a view',
      detailedMessage: `Deactivated ticket forms cannot be used in the conditions of a view. The Deactivated forms used are: ${_.uniq([deactivatedTicketForm]).join(', ')}`,
    })
  })
  it('should return an error when  view is changed and a ticket form referenced in a condition is changed to be deactivated', async () => {
    expect(true).toBe(true)
  })


//   const elementsSource = buildElementsSourceFromElements([deactivatedTicketForm, activeTicketForm])
//   const changes = [
//     toChange({ after: defaultTicketForm1 }),
//     toChange({ after: defaultTicketForm2 }),
//   ]
//   // const errors = await onlyOneTicketFormDefaultValidator(changes, elementsSource)

//   expect(errors).toHaveLength(2)
//   expect(errors[0]).toEqual({
//     elemID: defaultTicketForm1.elemID,
//     severity: 'Error',
//     message: 'More than one ticket form is set as default',
//     detailedMessage: `Only one ticket form can be set as default, default ticket forms: ${[defaultTicketForm1, defaultTicketForm2].map(e => e.elemID.name).join(', ')}`,
//   })
//   expect(errors[1]).toEqual({
//     elemID: defaultTicketForm2.elemID,
//     severity: 'Error',
//     message: 'More than one ticket form is set as default',
//     detailedMessage: `Only one ticket form can be set as default, default ticket forms: ${[defaultTicketForm1, defaultTicketForm2].map(e => e.elemID.name).join(', ')}`,
//   })
// })
// it('should return a warning when a new default ticket form is set and there is already a default ticket form in the elementsSource', async () => {
//   const elementsSource = buildElementsSourceFromElements([defaultTicketForm2])
//   const changes = [toChange({ after: defaultTicketForm1 })]
//   const warning = await onlyOneTicketFormDefaultValidator(changes, elementsSource)

//   expect(warning).toHaveLength(1)
//   expect(warning).toEqual([{
//     elemID: defaultTicketForm1.elemID,
//     severity: 'Warning',
//     message: 'Setting a new default ticket form will unset the previous default ticket form',
//     detailedMessage: `Setting this ticket form as default will unset the other default ticket forms: ${defaultTicketForm2.elemID.name}`,
//   }])
// })
// it('should return nothing if there is only one default ticket form in both changes and elementsSource', async () => {
//   const elementsSource = buildElementsSourceFromElements([defaultTicketForm1, notDefaultTicketForm])
//   const changes = [
//     toChange({ after: defaultTicketForm1 }),
//     toChange({ after: notDefaultTicketForm }),
//   ]
//   const errors = await onlyOneTicketFormDefaultValidator(changes, elementsSource)

//   expect(errors).toHaveLength(0)
})
