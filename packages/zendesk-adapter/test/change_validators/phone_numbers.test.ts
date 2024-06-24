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
import { ZENDESK } from '../../src/constants'
import { phoneNumbersValidator } from '../../src/change_validators/phone_numbers'

describe('phone numbers changes validation', () => {
  const triggerType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'trigger'),
  })
  const automationType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'automation'),
  })
  const triggerWithNoPhone = new InstanceElement('trigger', triggerType, {
    title: 'test',
    actions: [
      {
        field: 'current_tags',
        value: 'test tag',
      },
    ],
    conditions: {
      all: [
        {
          field: 'role',
          operator: 'is',
          value: 'end_user',
        },
      ],
    },
  })
  const triggerWithPhone = new InstanceElement('trigger', triggerType, {
    title: 'test',
    actions: [
      {
        field: 'current_tags',
        value: 'test tag',
      },
      {
        field: 'notification_sms_user',
        value: ['smsGroup@gmail.com', 1500002631542, 'bla bla'],
      },
    ],
  })
  const automationInstance = new InstanceElement('Test', automationType, {
    id: 2,
    title: 'Test',
    active: true,
    actions: [
      {
        field: 'notification_sms_user',
        value: ['smsGroup@gmail.com', 1500002631542, 'bla bla'],
      },
    ],
  })

  describe('add instance with phone number', () => {
    it('should return an error because a phone was added', async () => {
      const errors = await phoneNumbersValidator([toChange({ after: triggerWithPhone })])
      expect(errors).toEqual([
        {
          elemID: triggerWithPhone.elemID,
          severity: 'Error',
          message: 'Adding / modifying phone number ids is not supported.',
          detailedMessage: `Element ${triggerWithPhone.elemID.getFullName()} includes additions / modifications of phone number ids and therefore cannot be deployed from Salto. Please make any phone number changes via the Zendesk UI and fetch.`,
        },
      ])
    })
    it('should return no error if a phone was not added', async () => {
      const errors = await phoneNumbersValidator([toChange({ after: triggerWithNoPhone })])
      expect(errors).toEqual([])
    })
  })
  describe('modify instance with phone number', () => {
    it('should return an error in case of phone modification', async () => {
      const newAutomation = automationInstance.clone()
      newAutomation.value.actions = [
        {
          field: 'notification_sms_user',
          value: ['smsGroup@gmail.com', 1500002631542, 'bla bla'],
        },
        {
          field: 'notification_sms_user',
          value: ['smsGroup@gmail.com', 123, 'bla bla'],
        },
      ]
      const errors = await phoneNumbersValidator([
        toChange({ before: triggerWithNoPhone, after: triggerWithPhone }),
        toChange({ before: automationInstance, after: newAutomation }),
      ])
      expect(errors).toEqual([
        {
          elemID: triggerWithPhone.elemID,
          severity: 'Error',
          message: 'Adding / modifying phone number ids is not supported.',
          detailedMessage: `Element ${triggerWithPhone.elemID.getFullName()} includes additions / modifications of phone number ids and therefore cannot be deployed from Salto. Please make any phone number changes via the Zendesk UI and fetch.`,
        },
        {
          elemID: automationInstance.elemID,
          severity: 'Error',
          message: 'Adding / modifying phone number ids is not supported.',
          detailedMessage: `Element ${automationInstance.elemID.getFullName()} includes additions / modifications of phone number ids and therefore cannot be deployed from Salto. Please make any phone number changes via the Zendesk UI and fetch.`,
        },
      ])
    })
    it('should return no error if the element was modified but the phone didnt', async () => {
      const newTrigger = new InstanceElement('trigger', triggerType, {
        title: 'test',
        actions: [
          {
            field: 'current_tags',
            value: 'test tag',
          },
          {
            field: 'notification_sms_group',
            value: ['smsGroup@gmail.com', 1500002631542, 'bla'],
          },
        ],
      })
      const errors = await phoneNumbersValidator([toChange({ before: triggerWithPhone, after: newTrigger })])
      expect(errors).toEqual([])
    })
    it('should return no error if a phone number was removed', async () => {
      const errors = await phoneNumbersValidator([toChange({ before: triggerWithPhone, after: triggerWithNoPhone })])
      expect(errors).toEqual([])
    })
  })
})
