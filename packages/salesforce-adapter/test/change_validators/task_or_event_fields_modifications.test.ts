/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, Field, ObjectType, toChange } from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/task_or_event_fields_modifications'
import { EVENT_CUSTOM_OBJECT, SALESFORCE, TASK_CUSTOM_OBJECT } from '../../src/constants'
import { createCustomObjectType, createField } from '../utils'

describe('Task or Event Fields Modifications Change Validator', () => {
  const FIELD_NAME = 'TestField__c'

  let taskField: Field
  let eventField: Field
  let taskFieldOfNonCustomObject: Field

  beforeEach(() => {
    const taskType = createCustomObjectType(TASK_CUSTOM_OBJECT, {})
    const eventType = createCustomObjectType(EVENT_CUSTOM_OBJECT, {})

    taskField = createField(taskType, BuiltinTypes.STRING, FIELD_NAME)
    eventField = createField(eventType, BuiltinTypes.STRING, FIELD_NAME)
    taskFieldOfNonCustomObject = createField(
      new ObjectType({ elemID: new ElemID(SALESFORCE, TASK_CUSTOM_OBJECT) }),
      BuiltinTypes.STRING,
      FIELD_NAME,
    )
  })
  it('should create correct change errors', async () => {
    const errors = await changeValidator(
      [taskField, eventField, taskFieldOfNonCustomObject].map(field => toChange({ after: field })),
    )
    expect(errors).toHaveLength(2)

    const [taskFieldError, eventFieldError] = errors

    expect(taskFieldError).toEqual({
      elemID: taskField.elemID,
      severity: 'Error',
      message: expect.stringContaining('Modifying a field of Task or Event is not allowed'),
      detailedMessage: expect.stringContaining(FIELD_NAME) && expect.stringContaining(TASK_CUSTOM_OBJECT),
    })

    expect(eventFieldError).toEqual({
      elemID: eventField.elemID,
      severity: 'Error',
      message: expect.stringContaining('Modifying a field of Task or Event is not allowed'),
      detailedMessage: expect.stringContaining(FIELD_NAME) && expect.stringContaining(EVENT_CUSTOM_OBJECT),
    })
  })
})
