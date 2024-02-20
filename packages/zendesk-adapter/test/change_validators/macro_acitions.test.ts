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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ZENDESK, MACRO_TYPE_NAME } from '../../src/constants'
import { macroActionsTicketFieldDeactivationValidator } from '../../src/change_validators'

describe('macro action ticket field test', () => {
  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) })
  const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, 'ticket_field') })

  const deactivatedTicketFieldInstance1 = new InstanceElement('ticket1', ticketFieldType, {
    active: false,
  })
  const deactivatedTicketFieldInstance2 = new InstanceElement('ticket2', ticketFieldType, {
    active: false,
  })
  const activatedTicketFieldInstance3 = new InstanceElement('ticket3', ticketFieldType, {
    active: true,
  })
  const activatedTicketFieldInstance4 = new InstanceElement('ticket4', ticketFieldType, {
    active: true,
  })
  it('should return an error when there are inactivated ticket_fields', async () => {
    const macro = new InstanceElement('test', macroType, {
      title: 'test',
      actions: [
        {
          field: 'comment_value_html',
          value: '<p>Test</p>',
        },
        {
          field: new ReferenceExpression(deactivatedTicketFieldInstance1.elemID, deactivatedTicketFieldInstance1),
          value: '<p>Test</p>',
        },
        {
          field: new ReferenceExpression(deactivatedTicketFieldInstance2.elemID, deactivatedTicketFieldInstance2),
          value: '<p>Test</p>',
        },
        {
          field: new ReferenceExpression(activatedTicketFieldInstance3.elemID, activatedTicketFieldInstance3),
          value: '<p>Test</p>',
        },
        {
          field: new ReferenceExpression(activatedTicketFieldInstance4.elemID, activatedTicketFieldInstance4),
          value: '<p>Test</p>',
        },
      ],
    })
    const errors = await macroActionsTicketFieldDeactivationValidator(
      [toChange({ after: macro })],
      buildElementsSourceFromElements([
        deactivatedTicketFieldInstance1,
        deactivatedTicketFieldInstance2,
        activatedTicketFieldInstance3,
        activatedTicketFieldInstance4,
      ]),
    )
    expect(errors).toEqual([
      {
        elemID: macro.elemID,
        severity: 'Error',
        message: `One or more of the actions in macro ${macro.elemID.name} has a deactivated ticket_field as a field`,
        detailedMessage: `One or more of the actions in macro ${macro.elemID.name} has a deactivated ticket_field as a field. The deactivated fields are: ${[deactivatedTicketFieldInstance1.elemID.name, deactivatedTicketFieldInstance2.elemID.name]}`,
      },
    ])
  })
  it('should not return an error when there are only activated ticket_fields', async () => {
    const macro = new InstanceElement('test', macroType, {
      title: 'test',
      actions: [
        {
          field: 'comment_value_html',
          value: '<p>Test</p>',
        },
        {
          field: new ReferenceExpression(activatedTicketFieldInstance3.elemID, activatedTicketFieldInstance3),
          value: '<p>Test</p>',
        },
        {
          field: new ReferenceExpression(activatedTicketFieldInstance4.elemID, activatedTicketFieldInstance4),
          value: '<p>Test</p>',
        },
      ],
    })
    const errors = await macroActionsTicketFieldDeactivationValidator(
      [toChange({ after: macro })],
      buildElementsSourceFromElements([
        deactivatedTicketFieldInstance1,
        deactivatedTicketFieldInstance2,
        activatedTicketFieldInstance3,
        activatedTicketFieldInstance4,
      ]),
    )
    expect(errors).toEqual([])
  })
  it('should not return an error when the ticket_field is not found in the elementSource', async () => {
    const macro = new InstanceElement('test', macroType, {
      title: 'test',
      actions: [
        {
          field: 'comment_value_html',
          value: '<p>Test</p>',
        },
        {
          field: new ReferenceExpression(activatedTicketFieldInstance3.elemID, activatedTicketFieldInstance3),
          value: '<p>Test</p>',
        },
      ],
    })
    const errors = await macroActionsTicketFieldDeactivationValidator(
      [toChange({ after: macro })],
      buildElementsSourceFromElements([activatedTicketFieldInstance4]),
    )
    expect(errors).toEqual([])
  })
})
