/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ZENDESK } from '../../src/constants'
import { MACRO_ATTACHMENT_TYPE_NAME } from '../../src/filters/macro_attachments'
import { attachmentWithoutContentValidator } from '../../src/change_validators'

describe('attachmentWithoutContentValidator', () => {
  const attachmentInstance = new InstanceElement(
    'testAttachment',
    new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_ATTACHMENT_TYPE_NAME) }),
    {},
  )
  it('should return an error if attachment is without content', async () => {
    const errors = await attachmentWithoutContentValidator([toChange({ after: attachmentInstance })])
    expect(errors).toEqual([
      {
        elemID: attachmentInstance.elemID,
        severity: 'Error',
        message: 'Attachment can not be deployed without content',
        detailedMessage: `${attachmentInstance.elemID.typeName} instance can not be deployed without a content field`,
      },
    ])
  })
  it('should not return an error if there is a content field', async () => {
    const clonedAttachment = attachmentInstance.clone()
    clonedAttachment.value.content = 'something'
    const errors = await attachmentWithoutContentValidator([toChange({ after: clonedAttachment })])
    expect(errors).toHaveLength(0)
  })
})
