/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG, DEPLOY_CONFIG } from '../../src/config'
import { ZENDESK, ARTICLE_TYPE_NAME } from '../../src/constants'
import filterCreator from '../../src/filters/deploy_articles_as_drafts'
import { createFilterCreatorParams } from '../utils'

type FilterType = filterUtils.FilterWith<'preDeploy'>
const articleType = new ObjectType({
  elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
})
const draftArticle = new InstanceElement('draftArticle', articleType, {
  draft: true,
})
const publishedArticle = new InstanceElement('publishedArticle', articleType, {
  draft: false,
})

describe('deployBrandedGuideTypesFilter', () => {
  describe('preDeploy', () => {
    let changes: Change<InstanceElement>[]
    beforeEach(() => {
      changes = [toChange({ after: draftArticle.clone() }), toChange({ after: publishedArticle.clone() })]
    })
    it('should update articles to be deployed as drafts if the flag is true', async () => {
      const filter = filterCreator(
        createFilterCreatorParams({
          config: {
            ...DEFAULT_CONFIG,
            [DEPLOY_CONFIG]: {
              deployArticlesAsDraft: true,
            },
          },
        }),
      ) as FilterType
      await filter.preDeploy(changes)

      expect(changes.every(change => getChangeData(change).value.draft)).toBeTruthy()
    })

    it('should not update articles to be deployed as drafts if the flag is false', async () => {
      const filter = filterCreator(
        createFilterCreatorParams({
          config: {
            ...DEFAULT_CONFIG,
            [DEPLOY_CONFIG]: {
              deployArticlesAsDraft: false,
            },
          },
        }),
      ) as FilterType
      await filter.preDeploy(changes)

      expect(changes.map(change => getChangeData(change).value.draft).sort()).toEqual([false, true])
    })
  })
})
