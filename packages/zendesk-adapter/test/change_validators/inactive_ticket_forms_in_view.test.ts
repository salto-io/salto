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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ConditionWithReferenceValue } from '../../src/change_validators/utils'
import { BRAND_TYPE_NAME, TICKET_FORM_TYPE_NAME, VIEW_TYPE_NAME, ZENDESK } from '../../src/constants'
import { inactiveTicketFormInViewValidator } from '../../src/change_validators'

const createTicketForm = (name: string, active: boolean): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }), { active })

const createViewWithConditions = (name: string, conditions: ConditionWithReferenceValue[]): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, VIEW_TYPE_NAME) }), {
    conditions: {
      all: conditions,
    },
  })

const createViewWithTicketFormCondition = (name: string, ticketForms: ElemID[]): InstanceElement => {
  const ticketConditions = ticketForms.map(form => ({
    field: 'ticket_form_id',
    operator: 'is',
    value: new ReferenceExpression(form),
  }))
  return createViewWithConditions(name, ticketConditions)
}

describe('viewWithNoInactiveTicketsValidator', () => {
  let deactivatedTicketForm: InstanceElement
  let activeTicketForm: InstanceElement
  let viewWithDeactivatedTicket: InstanceElement
  beforeEach(() => {
    deactivatedTicketForm = createTicketForm('deactivatedTicketForm', false)
    activeTicketForm = createTicketForm('activeTicketForm', true)
    viewWithDeactivatedTicket = createViewWithTicketFormCondition('view', [
      deactivatedTicketForm.elemID,
      activeTicketForm.elemID,
    ])
  })

  it('should return an error when view is changed to have a deactivated ticket form referenced in a condition', async () => {
    const elementsSource = buildElementsSourceFromElements([deactivatedTicketForm, activeTicketForm])
    const changes = [toChange({ after: viewWithDeactivatedTicket })]
    const errors = await inactiveTicketFormInViewValidator(changes, elementsSource)

    expect(errors).toEqual([
      {
        elemID: viewWithDeactivatedTicket.elemID,
        severity: 'Error',
        message: 'View uses deactivated ticket forms',
        detailedMessage: `Deactivated ticket forms cannot be used in the conditions of a view. The Deactivated forms used are: ${deactivatedTicketForm.elemID.name}`,
      },
    ])
  })

  it('should have no errors when all ticket forms are active', async () => {
    const deactivatedTicketFormActivated = deactivatedTicketForm.clone()
    deactivatedTicketFormActivated.value.active = true

    const elementsSource = buildElementsSourceFromElements([activeTicketForm, deactivatedTicketFormActivated])
    const changes = [toChange({ after: viewWithDeactivatedTicket })]
    const errors = await inactiveTicketFormInViewValidator(changes, elementsSource)

    expect(errors).toEqual([])
  })
  it('should have no errors when there are no ticket forms in the conditions field', async () => {
    const brandType = new ObjectType({
      elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
    })
    const brandInstance = new InstanceElement('testBrand', brandType, { name: 'test', subdomain: 'subdomain_test' })
    const brandRef = new ReferenceExpression(brandInstance.elemID, brandInstance)
    const dummyConditions = [
      {
        field: 'brand_id',
        operator: 'is',
        value: brandRef,
      },
      {
        field: 'brand_id',
        operator: 'is_not',
        value: brandRef,
      },
    ]
    const viewWithNonTicketConditions = createViewWithConditions('viewWithNoTickets', dummyConditions)

    const elementsSource = buildElementsSourceFromElements([
      deactivatedTicketForm,
      activeTicketForm,
      viewWithNonTicketConditions,
    ])

    const changes = [toChange({ after: viewWithNonTicketConditions })]
    const errors = await inactiveTicketFormInViewValidator(changes, elementsSource)

    expect(errors).toEqual([])
  })
})
