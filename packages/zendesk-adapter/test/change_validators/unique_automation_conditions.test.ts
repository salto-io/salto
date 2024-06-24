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
import { InstanceElement, ObjectType, ElemID, toChange, Value, ReferenceExpression } from '@salto-io/adapter-api'
import { elementSource as elementSourceUtils } from '@salto-io/workspace'
import _ from 'lodash'
import { AUTOMATION_TYPE_NAME, ZENDESK } from '../../src/constants'
import { uniqueAutomationConditionsValidator } from '../../src/change_validators'

const { createInMemoryElementSource } = elementSourceUtils

const conditions = {
  all: [
    {
      field: 'ticket_form_id',
      operator: 'is',
      value: 'val',
    },
  ],
  any: [
    {
      field: 'via_id',
      operator: 'is',
      value: 'val',
    },
  ],
}

const createAutomationInstance = (name: string, conds: Value): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, AUTOMATION_TYPE_NAME) }), {
    active: true,
    conditions: _.cloneDeep(conds),
  })

describe('duplicateAutomationConditionValidator', () => {
  let automationInstance: InstanceElement
  beforeEach(() => {
    automationInstance = createAutomationInstance('automation', conditions)
  })

  it('should not return errors for automations with unique conditions', async () => {
    const uniqueAutomation1 = createAutomationInstance('unique1', 'unique1')
    const uniqueAutomation2 = createAutomationInstance('unique2', 'unique2')

    const changes = [
      toChange({ after: uniqueAutomation1 }),
      toChange({ after: uniqueAutomation2, before: automationInstance }),
    ]
    const elementSource = createInMemoryElementSource([automationInstance, uniqueAutomation1, uniqueAutomation2])
    const errors = await uniqueAutomationConditionsValidator(changes, elementSource)
    expect(errors).toEqual([])
  })

  it('should not return errors for automations with equal conditions to an inactive automation', async () => {
    const notUniqueAutomation1 = createAutomationInstance('notUnique1', 'notUnique')
    const notUniqueAutomation2 = createAutomationInstance('notUnique2', 'notUnique')
    const notUniqueAutomation3 = createAutomationInstance('notUnique3', 'notUnique')
    notUniqueAutomation1.value.active = false
    notUniqueAutomation2.value.active = false

    const changes = [toChange({ after: notUniqueAutomation1 }), toChange({ after: notUniqueAutomation2 })]
    const elementSource = createInMemoryElementSource([
      notUniqueAutomation1,
      notUniqueAutomation2,
      notUniqueAutomation3,
    ])
    const errors = await uniqueAutomationConditionsValidator(changes, elementSource)
    expect(errors).toEqual([])
  })

  it('should return an error for automations with the same conditions as another changed automation', async () => {
    const notUniqueConditions = _.cloneDeep(conditions)
    notUniqueConditions.all[0].value = 'notUnique'
    const notUniqueAutomation1 = createAutomationInstance('notUnique1', notUniqueConditions)
    const notUniqueAutomation2 = createAutomationInstance('notUnique2', notUniqueConditions)

    const changes = [
      toChange({ after: notUniqueAutomation1 }),
      toChange({ after: notUniqueAutomation2, before: automationInstance }),
    ]
    const elementSource = createInMemoryElementSource([automationInstance, notUniqueAutomation1, notUniqueAutomation2])
    const errors = await uniqueAutomationConditionsValidator(changes, elementSource)
    expect(errors).toMatchObject([
      {
        elemID: notUniqueAutomation1.elemID,
        severity: 'Error',
        message: 'Automation conditions are not unique',
        detailedMessage:
          "Automation has the same conditions as 'zendesk.automation.instance.notUnique2', make sure the conditions are unique before deploying.",
      },
      {
        elemID: notUniqueAutomation2.elemID,
        severity: 'Error',
        message: 'Automation conditions are not unique',
        detailedMessage:
          "Automation has the same conditions as 'zendesk.automation.instance.notUnique1', make sure the conditions are unique before deploying.",
      },
    ])
  })

  it('should return an error for automations with the same conditions as an automation from elementSource', async () => {
    const refElemId = new ElemID(ZENDESK, 'ref')

    const elementSourceAutomation = createAutomationInstance('automation', conditions)
    const notUniqueAutomation = createAutomationInstance('notUnique', conditions)

    // Elements in elementSource have unresolved references, we want to make sure we handle that
    elementSourceAutomation.value.conditions.all[0].value = new ReferenceExpression(refElemId)
    notUniqueAutomation.value.conditions.all[0].value = new ReferenceExpression(refElemId, refElemId)

    const changes = [toChange({ after: notUniqueAutomation })]
    const elementSource = createInMemoryElementSource([elementSourceAutomation, notUniqueAutomation])
    const errors = await uniqueAutomationConditionsValidator(changes, elementSource)
    expect(errors).toMatchObject([
      {
        elemID: notUniqueAutomation.elemID,
        severity: 'Error',
        message: 'Automation conditions are not unique',
        detailedMessage:
          "Automation has the same conditions as 'zendesk.automation.instance.automation', make sure the conditions are unique before deploying.",
      },
    ])
  })
})
