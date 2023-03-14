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
import { ZENDESK } from '../../src/constants'
import { invalidActionsValidator } from '../../src/change_validators/invalid_actions'

describe('invalidActionsValidator', () => {
  const triggerType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'trigger'),
  })
  const validTrigger = new InstanceElement(
    'trigger',
    triggerType,
    {
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
    },
  )
  it('should return an error if an invalid actions exist', async () => {
    const trigger = new InstanceElement(
      'trigger',
      triggerType,
      {
        title: 'test',
        actions: [
          {
            field: 'current_tags',
            value: 'test tag',
          },
          {
            field: 'deflection',
            value: ['requester_id', 'We got your request', 'test', ''],
          },
        ],
      },
    )
    const errors = await invalidActionsValidator(
      [trigger, validTrigger].map(inst => toChange({ after: inst }))
    )
    expect(errors).toEqual([{
      elemID: trigger.elemID,
      severity: 'Error',
      message: 'Cannot change this element since one of its action types is not supported',
      detailedMessage: 'Actions {deflection} are not supported',
    }])
  })
  it('should return no error if all the actions are valid', async () => {
    const errors = await invalidActionsValidator([toChange({ after: validTrigger })])
    expect(errors).toEqual([])
  })
})
