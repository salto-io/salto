/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { DEFAULT_CONFIG, FIX_ELEMENTS_CONFIG } from '../../src/config'
import { ARTICLE_TRANSLATION_TYPE_NAME, ZENDESK } from '../../src/constants'
import { deployArticlesAsDraftHandler } from '../../src/fix_elements/deploy_articles_as_drafts'
import { ZendeskFixElementsConfig } from '../../src/user_config'
import { createFilterCreatorParams } from '../utils'

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
  let elements: InstanceElement[]
  beforeEach(() => {
    elements = [draftArticleTranslation.clone(), publishedArticleTranslation.clone()]
  })
  it('should update articles to be deployed as drafts if the flag is true', async () => {
    const fixer = deployArticlesAsDraftHandler(
      createFilterCreatorParams({
        config: {
          ...DEFAULT_CONFIG,
          [FIX_ELEMENTS_CONFIG]: {
            deployArticlesAsDraft: true,
          } as ZendeskFixElementsConfig,
        },
      }),
    )
    const { fixedElements, errors } = await fixer(elements)

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

  it('should not update articles to be deployed as drafts if the flag is false', async () => {
    const fixer = deployArticlesAsDraftHandler(
      createFilterCreatorParams({
        config: {
          ...DEFAULT_CONFIG,
          [FIX_ELEMENTS_CONFIG]: {
            deployArticlesAsDraft: false,
          } as ZendeskFixElementsConfig,
        },
      }),
    )
    const { fixedElements, errors } = await fixer(elements)

    expect(fixedElements).toEqual([])
    expect(errors).toEqual([])
  })
})
