/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, StaticFile, toChange } from '@salto-io/adapter-api'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ZENDESK } from '../../src/constants'
import { articleAttachmentSizeValidator } from '../../src/change_validators/article_attachment_size'
import { LazyStaticFile } from '../../../workspace/src/workspace/static_files/source'

describe('articleAttachmentSizeValidator', () => {
  const shortContent = Buffer.from('x'.repeat(20 * 1024 * 1024 - 1))
  const longContent = Buffer.from('x'.repeat(20 * 1024 * 1024))
  const anotherLongContent = Buffer.from('y'.repeat(20 * 1024 * 1024))
  const articleAttachmentInstance = new InstanceElement(
    'testArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) }),
    {
      id: 20222022,
      filename: 'filename.png',
      contentType: 'image/png',
      content: new StaticFile({
        filepath: 'zendesk/article_attachment/title/attachmentFileName.png',
        encoding: 'binary',
        content: longContent,
      }),
      inline: true,
      brand: '1',
    },
  )
  it('should return an error for large article attachment when adding', async () => {
    const errors = await articleAttachmentSizeValidator([toChange({ after: articleAttachmentInstance })])
    expect(errors).toEqual([
      {
        elemID: articleAttachmentInstance.elemID,
        severity: 'Error',
        message: `Article attachment ${articleAttachmentInstance.elemID.name} size has exceeded the file size limit.`,
        detailedMessage: 'The file size limit of article attachments is 20 MB per attachment',
      },
    ])
  })
  it('should not return an error for large article attachment when adding lazyStaticFile', async () => {
    const articleAttachmentLazyInstance = new InstanceElement(
      'testArticle',
      new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) }),
      {
        id: 20222022,
        filename: 'filename.png',
        contentType: 'image/png',
        content: new LazyStaticFile('some/path.ext', 'hash', 'some/path.ext', async () => Buffer.from('content')),
        inline: true,
        brand: '1',
      },
    )
    const errors = await articleAttachmentSizeValidator([toChange({ after: articleAttachmentLazyInstance })])
    expect(errors).toEqual([])
  })
  it('should return an error for large article attachment when adding lazyStaticFile', async () => {
    const articleAttachmentLazyInstance = new InstanceElement(
      'testArticle',
      new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) }),
      {
        id: 20222022,
        filename: 'filename.png',
        contentType: 'image/png',
        content: new LazyStaticFile('some/path.ext', 'hash', 'some/path.ext', async () =>
          Buffer.from('x'.repeat(20 * 1024 * 1024)),
        ),
        inline: true,
        brand: '1',
      },
    )
    const errors = await articleAttachmentSizeValidator([toChange({ after: articleAttachmentLazyInstance })])
    expect(errors).toEqual([
      {
        elemID: articleAttachmentLazyInstance.elemID,
        severity: 'Error',
        message: `Article attachment ${articleAttachmentLazyInstance.elemID.name} size has exceeded the file size limit.`,
        detailedMessage: 'The file size limit of article attachments is 20 MB per attachment',
      },
    ])
  })
  it('should return an error for large article attachment when modifying', async () => {
    const clonedAttachment = articleAttachmentInstance.clone()
    clonedAttachment.value.content = new StaticFile({
      filepath: 'zendesk/article_attachment/title/attachmentFileName.png',
      encoding: 'binary',
      content: anotherLongContent,
    })
    const errors = await articleAttachmentSizeValidator([
      toChange({ before: clonedAttachment, after: articleAttachmentInstance }),
    ])
    expect(errors).toEqual([
      {
        elemID: articleAttachmentInstance.elemID,
        severity: 'Error',
        message: `Article attachment ${articleAttachmentInstance.elemID.name} size has exceeded the file size limit.`,
        detailedMessage: 'The file size limit of article attachments is 20 MB per attachment',
      },
    ])
  })
  it('should not return an error if the attachment is being deleted', async () => {
    const errors = await articleAttachmentSizeValidator([toChange({ before: articleAttachmentInstance })])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if for short contents', async () => {
    const clonedAttachment = articleAttachmentInstance.clone()
    clonedAttachment.value.content = new StaticFile({
      filepath: 'zendesk/article_attachment/title/attachmentFileName.png',
      encoding: 'binary',
      content: shortContent,
    })
    const errors = await articleAttachmentSizeValidator([toChange({ after: clonedAttachment })])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error when the content inside the attachment is not a static file', async () => {
    const articleAttachmentLazyInstance = new InstanceElement(
      'testArticle',
      new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) }),
      {
        id: 20222022,
        filename: 'filename.png',
        contentType: 'image/png',
        content: 'Hello',
        inline: true,
        brand: '1',
      },
    )
    const errors = await articleAttachmentSizeValidator([toChange({ after: articleAttachmentLazyInstance })])
    expect(errors).toHaveLength(0)
  })
})
