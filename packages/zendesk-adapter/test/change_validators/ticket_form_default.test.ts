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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ZENDESK, TICKET_FORM_TYPE_NAME } from '../../src/constants'
import { onlyOneTicketFormDefaultValidator } from '../../src/change_validators'

const createTicketForm = (name: string, isDefault: boolean): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) }), {
    default: isDefault,
  })

describe('onlyOneTicketFormDefaultValidator', () => {
  let defaultTicketForm1: InstanceElement
  let defaultTicketForm2: InstanceElement
  let notDefaultTicketForm: InstanceElement
  beforeEach(() => {
    defaultTicketForm1 = createTicketForm('defaultTicketForm1', true)
    defaultTicketForm2 = createTicketForm('defaultTicketForm2', true)
    notDefaultTicketForm = createTicketForm('notDefaultTicketForm', false)
  })
  it('should return an error when more than one ticket form is set as default', async () => {
    const elementsSource = buildElementsSourceFromElements([defaultTicketForm1, defaultTicketForm2])
    const changes = [toChange({ after: defaultTicketForm1 }), toChange({ after: defaultTicketForm2 })]
    const errors = await onlyOneTicketFormDefaultValidator(changes, elementsSource)

    expect(errors).toHaveLength(2)
    expect(errors[0]).toEqual({
      elemID: defaultTicketForm1.elemID,
      severity: 'Error',
      message: 'More than one ticket form is set as default',
      detailedMessage: `Only one ticket form can be set as default, default ticket forms: ${[defaultTicketForm1, defaultTicketForm2].map(e => e.elemID.name).join(', ')}`,
    })
    expect(errors[1]).toEqual({
      elemID: defaultTicketForm2.elemID,
      severity: 'Error',
      message: 'More than one ticket form is set as default',
      detailedMessage: `Only one ticket form can be set as default, default ticket forms: ${[defaultTicketForm1, defaultTicketForm2].map(e => e.elemID.name).join(', ')}`,
    })
  })
  it('should return a warning when a new default ticket form is set and there is already a default ticket form in the elementsSource', async () => {
    const elementsSource = buildElementsSourceFromElements([defaultTicketForm2])
    const changes = [toChange({ after: defaultTicketForm1 })]
    const warning = await onlyOneTicketFormDefaultValidator(changes, elementsSource)

    expect(warning).toHaveLength(1)
    expect(warning).toEqual([
      {
        elemID: defaultTicketForm1.elemID,
        severity: 'Warning',
        message: 'Setting a new default ticket form will unset the previous default ticket form',
        detailedMessage: `Setting this ticket form as default will unset the other default ticket forms: ${defaultTicketForm2.elemID.name}`,
      },
    ])
  })
  it('should return nothing if there is only one default ticket form in both changes and elementsSource', async () => {
    const elementsSource = buildElementsSourceFromElements([defaultTicketForm1, notDefaultTicketForm])
    const changes = [toChange({ after: defaultTicketForm1 }), toChange({ after: notDefaultTicketForm })]
    const errors = await onlyOneTicketFormDefaultValidator(changes, elementsSource)

    expect(errors).toHaveLength(0)
  })
})
