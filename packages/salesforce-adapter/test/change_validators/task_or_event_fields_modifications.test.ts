/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/task_or_event_fields_modifications'
import { ACTIVITY_CUSTOM_OBJECT, EVENT_CUSTOM_OBJECT, SALESFORCE, TASK_CUSTOM_OBJECT } from '../../src/constants'
import { createCustomObjectType, createField } from '../utils'

describe('Task or Event Fields Modifications Change Validator', () => {
  const FIELD1_NAME = 'TestField1__c'
  const FIELD2_NAME = 'TestField2__c'

  const activityType = createCustomObjectType(ACTIVITY_CUSTOM_OBJECT, {})
  const taskType = createCustomObjectType(TASK_CUSTOM_OBJECT, {})
  const eventType = createCustomObjectType(EVENT_CUSTOM_OBJECT, {})

  const activityField1 = createField(activityType, BuiltinTypes.STRING, `Activity.${FIELD1_NAME}`, {}, FIELD1_NAME)
  const activityField1Ref = new ReferenceExpression(activityField1.elemID, activityField1)
  const taskField1 = createField(
    taskType,
    BuiltinTypes.STRING,
    `Task.${FIELD1_NAME}`,
    { activityField: activityField1Ref },
    FIELD1_NAME,
  )
  const eventField1 = createField(
    eventType,
    BuiltinTypes.STRING,
    `Event.${FIELD1_NAME}`,
    { activityField: activityField1Ref },
    FIELD1_NAME,
  )

  const activityField2 = createField(activityType, BuiltinTypes.STRING, `Activity.${FIELD2_NAME}`, {}, FIELD2_NAME)
  const activityField2Ref = new ReferenceExpression(activityField2.elemID, activityField2)
  const taskField2 = createField(
    taskType,
    BuiltinTypes.STRING,
    `Task.${FIELD2_NAME}`,
    { activityField: activityField2Ref },
    FIELD2_NAME,
  )
  const eventField2 = createField(
    eventType,
    BuiltinTypes.STRING,
    `Event.${FIELD2_NAME}`,
    { activityField: activityField2Ref },
    FIELD2_NAME,
  )

  const taskFieldOfNonCustomObject = createField(
    new ObjectType({ elemID: new ElemID(SALESFORCE, TASK_CUSTOM_OBJECT) }),
    BuiltinTypes.STRING,
    FIELD1_NAME,
  )

  it("should create correct change errors when there's no corresponding Activity change", async () => {
    const changes = [
      // Field additions with a corresponding Activity field addition, should produce an error.
      toChange({ after: activityField1 }),
      toChange({ after: taskField1 }),
      toChange({ after: eventField1 }),

      // Non-custom object field change, should not produce an error.
      toChange({ after: taskFieldOfNonCustomObject }),

      // Field removals without a corresponding Activity field removal, should produce an error.
      toChange({ before: taskField2 }),
      toChange({ before: eventField2 }),
    ]
    const errors = await changeValidator(changes)
    expect(errors).toHaveLength(2)

    const [taskField1Error, eventField1Error] = errors

    expect(taskField1Error).toEqual({
      elemID: taskField2.elemID,
      severity: 'Error',
      message: expect.stringContaining('Modifying a field of Task or Event is not allowed'),
      detailedMessage: expect.stringContaining(FIELD2_NAME) && expect.stringContaining(TASK_CUSTOM_OBJECT),
    })

    expect(eventField1Error).toEqual({
      elemID: eventField2.elemID,
      severity: 'Error',
      message: expect.stringContaining('Modifying a field of Task or Event is not allowed'),
      detailedMessage: expect.stringContaining(FIELD2_NAME) && expect.stringContaining(EVENT_CUSTOM_OBJECT),
    })
  })
})
