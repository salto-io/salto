/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { automationAllConditionsValidator } from '../../src/change_validators'


describe('automationAllConditionsValidator', () => {
  const automationType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'automation'),
  })

  const validAutomation = new InstanceElement(
    'Test1',
    automationType,
    {
      id: 2,
      title: 'Test',
      active: true,
      actions: [{
        field: 'Test',
        value: 'Test',
      }],
      conditions: {
        all: [
          {
            field: 'status',
            operator: 'is',
            value: 'new',
          },
        ],
      },
    },
  )

  const notValidAutomation = new InstanceElement(
    'Test2',
    automationType,
    {
      id: 2,
      title: 'Test',
      active: true,
      actions: [{
        field: 'Test',
        value: 'Test',
      }],
      conditions: {
        all: [
          {
            field: 'other',
            operator: 'is',
            value: 'new',
          },
        ],
      },
    },
  )
  const noConditionInAutomation = new InstanceElement(
    'Test3',
    automationType,
    {
      id: 2,
      title: 'Test',
      active: true,
      actions: [{
        field: 'Test',
        value: 'Test',
      }],
    },
  )
  const noAllInConditionAutomation = new InstanceElement(
    'Test4',
    automationType,
    {
      id: 2,
      title: 'Test',
      active: true,
      actions: [{
        field: 'Test',
        value: 'Test',
      }],
      conditions: {},
    },
  )
  const notValidAutomationSeveralConditions = new InstanceElement(
    'Test5',
    automationType,
    {
      id: 2,
      title: 'Test',
      active: true,
      actions: [{
        field: 'Test',
        value: 'Test',
      }],
      conditions: {
        all: [
          {
            field: 'other',
            operator: 'is',
            value: 'new',
          },
          {
            field: 'other',
            operator: 'is',
            value: 'new',
          },
        ],
      },
    },
  )
  const validAutomationSeveralConditions = new InstanceElement(
    'Test6',
    automationType,
    {
      id: 2,
      title: 'Test',
      active: true,
      actions: [{
        field: 'Test',
        value: 'Test',
      }],
      conditions: {
        all: [
          {
            field: 'not valid',
            operator: 'is',
            value: 'new',
          },
          {
            field: 'type',
            operator: 'is',
            value: 'new',
          },
        ],
      },
    },
  )
  it('should return an error when automation does not contain necessary field condition', async () => {
    const errors = await automationAllConditionsValidator(
      [toChange({ after: notValidAutomation })]
    )
    expect(errors).toEqual([{
      elemID: notValidAutomation.elemID,
      severity: 'Error',
      message: 'Can not change automation ,because the ALL conditions do not contain a necessary field',
      detailedMessage: `Can not change automation ${notValidAutomation.elemID.getFullName()} ,because none of the ALL conditions 
      section do not contain the fields: Status, Type, Group, Assignee, Requester`,
    }])
  })
  it('should return an error when automation does not contain necessary field condition of several conditions', async () => {
    const errors = await automationAllConditionsValidator(
      [toChange({ after: notValidAutomationSeveralConditions })]
    )
    expect(errors).toEqual([{
      elemID: notValidAutomationSeveralConditions.elemID,
      severity: 'Error',
      message: 'Can not change automation ,because the ALL conditions do not contain a necessary field',
      detailedMessage: `Can not change automation ${notValidAutomationSeveralConditions.elemID.getFullName()} ,because none of the ALL conditions 
      section do not contain the fields: Status, Type, Group, Assignee, Requester`,
    }])
  })
  it('should not return an error when automation contains necessary field condition', async () => {
    const errors = await automationAllConditionsValidator(
      [toChange({ after: validAutomation })]
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when automation contains necessary field condition out of several conditions', async () => {
    const errors = await automationAllConditionsValidator(
      [toChange({ after: validAutomationSeveralConditions })]
    )
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when we remove an item', async () => {
    const errors = await automationAllConditionsValidator(
      [toChange({ before: validAutomation })]
    )
    expect(errors).toHaveLength(0)
  })
  it('should return error when there are no conditions', async () => {
    const errors = await automationAllConditionsValidator(
      [toChange({ after: noConditionInAutomation })]
    )
    expect(errors).toEqual([{
      elemID: noConditionInAutomation.elemID,
      severity: 'Error',
      message: 'Can not change automation ,because the ALL conditions do not contain a necessary field',
      detailedMessage: `Can not change automation ${noConditionInAutomation.elemID.getFullName()} ,because none of the ALL conditions 
      section do not contain the fields: Status, Type, Group, Assignee, Requester`,
    }])
  })
  it('should return error when there are no All conditions', async () => {
    const errors = await automationAllConditionsValidator(
      [toChange({ after: noAllInConditionAutomation })]
    )
    expect(errors).toEqual([{
      elemID: noAllInConditionAutomation.elemID,
      severity: 'Error',
      message: 'Can not change automation ,because the ALL conditions do not contain a necessary field',
      detailedMessage: `Can not change automation ${noAllInConditionAutomation.elemID.getFullName()} ,because none of the ALL conditions 
      section do not contain the fields: Status, Type, Group, Assignee, Requester`,
    }])
  })
})
