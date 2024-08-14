/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { ZENDESK, MACRO_TYPE_NAME } from '../../src/constants'
import { maxAttachmentsInMacroValidator } from '../../src/change_validators/macro'
import { MACRO_ATTACHMENT_TYPE_NAME, ATTACHMENTS_FIELD_NAME } from '../../src/filters/macro_attachments'

describe('macro', () => {
  const attachment = new InstanceElement(
    'attachment',
    new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_ATTACHMENT_TYPE_NAME) }),
    {
      filename: 'test.txt',
      content: 'hello',
    },
  )
  const macro = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) }), {
    title: 'test',
    actions: [
      {
        field: 'comment_value_html',
        value: '<p>Test</p>',
      },
    ],
    [ATTACHMENTS_FIELD_NAME]: [new ReferenceExpression(attachment.elemID, attachment)],
  })
  it('should return an error when we change macro to have more than 5 attachments', async () => {
    const clonedInstance = macro.clone()
    clonedInstance.value[ATTACHMENTS_FIELD_NAME] = [
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
    ]
    const errors = await maxAttachmentsInMacroValidator([toChange({ after: clonedInstance })])
    expect(errors).toEqual([
      {
        elemID: clonedInstance.elemID,
        severity: 'Error',
        message: 'Cannot make this change since there are too many macro attachments',
        detailedMessage: 'Cannot have more than 5 attachments in a single macro',
      },
    ])
  })
  it('should not return an error when we change macro to have 5 attachments or less', async () => {
    const clonedInstance = macro.clone()
    clonedInstance.value[ATTACHMENTS_FIELD_NAME] = [
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
    ]
    const errors = await maxAttachmentsInMacroValidator([toChange({ after: clonedInstance })])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if we delete macro with more than 5 attachments', async () => {
    const clonedInstance = macro.clone()
    clonedInstance.value[ATTACHMENTS_FIELD_NAME] = [
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
      new ReferenceExpression(attachment.elemID, attachment),
    ]
    const errors = await maxAttachmentsInMacroValidator([toChange({ before: clonedInstance })])
    expect(errors).toHaveLength(0)
  })
})
