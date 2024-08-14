/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { ARTICLE_TYPE_NAME, ZENDESK } from '../../src/constants'
import { articleLabelNamesRemovalValidator } from '../../src/change_validators/article_label_names_removal'

describe('articleLabelNamesRemovalValidator', () => {
  const articleInstanceWithoutLabels = new InstanceElement(
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
  const articleInstanceWithLabels = articleInstanceWithoutLabels.clone()
  articleInstanceWithLabels.value.label_names = ['label']
  it('should return a warning if article label_names list is removed', async () => {
    const errors = await articleLabelNamesRemovalValidator([
      toChange({ before: articleInstanceWithLabels, after: articleInstanceWithoutLabels }),
    ])
    expect(errors).toEqual([
      {
        elemID: articleInstanceWithoutLabels.elemID,
        severity: 'Warning',
        message: 'Article labels removal is ineffective',
        detailedMessage:
          'To remove all the labels from The name of the article, please make sure to put an empty list under label_names field',
      },
    ])
  })
  it('should not return an error if the list has been emptied', async () => {
    const clonedAfterArticle = articleInstanceWithLabels.clone()
    clonedAfterArticle.value.label_names = []
    const errors = await articleLabelNamesRemovalValidator([
      toChange({ before: articleInstanceWithLabels, after: clonedAfterArticle }),
    ])
    expect(errors).toHaveLength(0)
  })
  it('should not return an error if the article was created without label_names', async () => {
    const errors = await articleLabelNamesRemovalValidator([toChange({ after: articleInstanceWithoutLabels })])
    expect(errors).toHaveLength(0)
  })
})
