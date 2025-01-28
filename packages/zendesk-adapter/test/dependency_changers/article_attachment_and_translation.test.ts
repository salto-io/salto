/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, toChange, ReferenceExpression, ObjectType, ElemID, StaticFile } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { parserUtils } from '@salto-io/parser'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME,
  MACRO_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import { articleAttachmentAndTranslationDependencyChanger } from '../../src/dependency_changers/article_attachment_and_translation'

describe('articleAttachmentAndTranslationDependencyChanger', () => {
  const articleTranslationType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME) })
  const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) })
  const articleAttachmentType = new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) })
  const macro = new InstanceElement('macro', macroType, {})
  const articleAttachment = new InstanceElement('attachment1', articleAttachmentType, { id: 1 })
  const articleAttachment2 = new InstanceElement('attachment2', articleAttachmentType, { id: 2 })
  const articleAttachment3 = new InstanceElement('attachment3', articleAttachmentType, { id: 3 })
  const articleTranslation = new InstanceElement('articleTranslation', articleTranslationType, {
    body: parserUtils.templateExpressionToStaticFile(
      createTemplateExpression({
        parts: [
          'hi',
          new ReferenceExpression(articleAttachment.elemID),
          'bye',
          new ReferenceExpression(articleAttachment2.elemID),
          'bla',
          new ReferenceExpression(macro.elemID),
          'attachment that does not have a change',
          new ReferenceExpression(articleAttachment3.elemID),
        ],
      }),
      'test',
    ),
  })

  it('should add dependency from translation to attachments', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: articleAttachment })],
      [1, toChange({ before: articleAttachment2, after: articleAttachment2 })],
      [2, toChange({ before: articleTranslation, after: articleTranslation })],
      [3, toChange({ before: macro, after: macro })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
      [2, new Set()],
      [3, new Set()],
    ])

    const dependencyChanges = [...(await articleAttachmentAndTranslationDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(1)
    expect(dependencyChanges.every(change => change.action === 'add')).toBe(true)
    expect(dependencyChanges[0].dependency).toMatchObject({ source: 2, target: 1 })
  })
  it('should do nothing if translation body does not have references', async () => {
    const afterTranslation = articleTranslation.clone()
    afterTranslation.value.body = new StaticFile({ content: Buffer.from('hi'), filepath: 'test' })
    const inputChanges = new Map([
      [0, toChange({ after: articleAttachment })],
      [1, toChange({ before: articleAttachment2, after: articleAttachment2 })],
      [2, toChange({ before: articleTranslation, after: afterTranslation })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
      [2, new Set()],
    ])

    const dependencyChanges = [...(await articleAttachmentAndTranslationDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(0)
  })
})
