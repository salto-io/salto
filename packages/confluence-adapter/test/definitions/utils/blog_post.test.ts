/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ADAPTER_NAME, BLOG_POST_TYPE_NAME } from '../../../src/constants'
import { adjustUserReferencesOnBlogPostReverse } from '../../../src/definitions/utils'

describe('blog_post definitions utils', () => {
  const blogPostObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, BLOG_POST_TYPE_NAME) })
  const blogPostChange = toChange({
    after: new InstanceElement('mockBlogPostName', blogPostObjectType, { id: 'mockId' }),
  })
  describe('adjustBlogPostOnModification', () => {
    describe('adjustUserReferencesOnBlogPostReverse', () => {
      it('should adjust user references on blog_post', async () => {
        const args = {
          typeName: 'mockType',
          context: {
            elementSource: buildElementsSourceFromElements([]),
            changeGroup: {
              changes: [],
              groupID: 'group-id',
            },
            sharedContext: {},
            change: blogPostChange,
          },
          value: {
            authorId: { accountId: 'authorId', displayName: 'authorId' },
            notUser: 'not',
          },
        }
        expect((await adjustUserReferencesOnBlogPostReverse(args)).value).toEqual({
          authorId: 'authorId',
          notUser: 'not',
        })
      })
    })
  })
})
