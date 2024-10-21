/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { ARTICLE_TRANSLATION_TYPE_NAME, ZENDESK } from '../../src/constants'
import { deployArticlesAsDraftHandler } from '../../src/fix_elements/deploy_articles_as_drafts'
import { FixElementsArgs } from '../../src/fix_elements/types'

const articleTranslationType = new ObjectType({
  elemID: new ElemID(ZENDESK, ARTICLE_TRANSLATION_TYPE_NAME),
})
const draftArticleTranslation = new InstanceElement('draftArticle', articleTranslationType, {
  draft: true,
})
const publishedArticleTranslation = new InstanceElement('publishedArticle', articleTranslationType, {
  draft: false,
})

describe('deployArticlesAsDraftHandler', () => {
  it('should update articles to be deployed as drafts if published', async () => {
    const fixer = deployArticlesAsDraftHandler({} as FixElementsArgs)
    const { fixedElements, errors } = await fixer([publishedArticleTranslation.clone()])

    const expectedFixedArticle = publishedArticleTranslation.clone()
    expectedFixedArticle.value.draft = true
    expect(fixedElements).toEqual([expectedFixedArticle])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toEqual(
      expect.objectContaining({
        elemID: publishedArticleTranslation.elemID,
        severity: 'Info',
        message: 'Article will be deployed as a Draft',
        detailedMessage: 'Article translation was originally Published, but will be deployed as a Draft',
      }),
    )
  })

  it('should not update articles if already draft', async () => {
    const fixer = deployArticlesAsDraftHandler({} as FixElementsArgs)
    const { fixedElements, errors } = await fixer([draftArticleTranslation.clone()])

    expect(fixedElements).toEqual([])
    expect(errors).toEqual([])
  })
})
