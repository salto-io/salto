/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import { badFormatWebhookActionValidator } from '../../src/change_validators'

describe('badFormatWebhookActionValidator', () => {
  const automationType = new ObjectType({
    elemID: new ElemID(ZENDESK, 'automation'),
  })

  const validAutomation = new InstanceElement('Test1', automationType, {
    actions: [
      {
        field: 'notification_webhook',
        value: ['1', '2'],
      },
      {
        field: 'Test',
        value: 'Test',
      },
    ],
  })

  const inValidAutomation = new InstanceElement('Test2', automationType, {
    actions: [
      {
        field: 'notification_webhook',
        value: '["1", "2"]',
      },
      {
        field: 'Test',
        value: 'Test',
      },
    ],
  })

  it('should not return an error when automation action has a notification_webhook with an array value', async () => {
    const changes = [toChange({ after: validAutomation }), toChange({ before: validAutomation })]
    const errors = await badFormatWebhookActionValidator(changes)
    expect(errors).toHaveLength(0)
  })

  it('should return an error when automation action has a notification_webhook with a non array value', async () => {
    const changes = [
      toChange({ after: inValidAutomation }),
      toChange({ before: inValidAutomation, after: inValidAutomation }),
      toChange({ before: inValidAutomation }),
    ]
    const errors = await badFormatWebhookActionValidator(changes)
    expect(errors).toMatchObject([
      {
        elemID: inValidAutomation.elemID,
        severity: 'Warning',
        message: `${inValidAutomation.elemID.typeName} instance has unexpected structure and might not work properly`,
        detailedMessage: `The instance have an action of notification_webhook with a value in a bad format (should be an array). This might cause the ${inValidAutomation.elemID.typeName} to not work properly.`,
      },
      {
        elemID: inValidAutomation.elemID,
        severity: 'Warning',
        message: `${inValidAutomation.elemID.typeName} instance has unexpected structure and might not work properly`,
        detailedMessage: `The instance have an action of notification_webhook with a value in a bad format (should be an array). This might cause the ${inValidAutomation.elemID.typeName} to not work properly.`,
      },
    ])
  })
})
