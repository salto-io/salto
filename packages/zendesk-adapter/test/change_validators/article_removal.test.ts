/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ARTICLE_TYPE_NAME, ZENDESK } from '../../src/constants'
import { articleRemovalValidator } from '../../src/change_validators/article_removal'

describe('articleRemovalValidator', () => {
  const articleInstance = new InstanceElement(
    'testArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      author_id: 'author@salto.io',
      comments_disabled: false,
      draft: false,
      promoted: false,
      position: 0,
      section_id: '12345',
      name: 'The name of the article',
      title: 'The title of the article',
      source_locale: 'en-us',
      locale: 'en-us',
      outdated: false,
      permission_group_id: '666',
      body: '<p>ppppp</p>',
      translations: ['9999999'],
      brand: '1',
    },
  )
  it('should return a warning if an article is removed', async () => {
    const errors = await articleRemovalValidator([toChange({ before: articleInstance })])
    expect(errors).toEqual([
      {
        elemID: articleInstance.elemID,
        severity: 'Warning',
        message: 'Article has been archived instead of being deleted',
        detailedMessage: `Permanent deletion of articles must be applied manually, please make sure to delete ${articleInstance.value.name} from the archived list`,
      },
    ])
  })
  it('should not return an error if the brand was modified', async () => {
    const clonedBeforeArticle = articleInstance.clone()
    const clonedAfterArticle = articleInstance.clone()
    clonedAfterArticle.value.title = 'newTitle!'
    const errors = await articleRemovalValidator([toChange({ before: clonedBeforeArticle, after: clonedAfterArticle })])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if the brand was created', async () => {
    const errors = await articleRemovalValidator([toChange({ after: articleInstance })])
    expect(errors).toHaveLength(0)
  })
})
