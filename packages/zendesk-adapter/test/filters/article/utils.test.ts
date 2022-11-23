/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import {
  ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS, ReferenceExpression, StaticFile,
} from '@salto-io/adapter-api'
import ZendeskClient from '../../../src/client/client'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, ZENDESK } from '../../../src/constants'
import * as articleUtils from '../../../src/filters/article/utils'

jest.useFakeTimers()

describe('article utility functions', () => {
  let client: ZendeskClient
  let mockPost: jest.SpyInstance

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })
  const brandInstance = new InstanceElement(
    'brandName',
    brandType,
    {
      id: 121255,
      subdomain: 'igonre',
    }
  )
  const articleWithAttachmentInstance = new InstanceElement(
    'articleWithAttachment',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      id: 333333,
      author_id: 'author@salto.io',
      comments_disabled: false,
      draft: false,
      promoted: false,
      position: 0,
      section_id: '12345',
      source_locale: 'en-us',
      locale: 'en-us',
      outdated: false,
      permission_group_id: '666',
      brand: brandInstance.value.id,
      title: 'title',
    }
  )
  const content = Buffer.from('test')
  const articleAttachmentInstance = new InstanceElement(
    'testAttachment',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) }),
    {
      filename: 'attachmentFileName.png',
      contentType: 'image/png',
      content: new StaticFile({
        filepath: 'zendesk/article_attachment/title/attachmentFileName.png', encoding: 'binary', content,
      }),
      inline: 'false',
      brand: brandInstance.value.id,
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(
      articleWithAttachmentInstance.elemID,
      articleWithAttachmentInstance,
    )] },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
  })

  describe('createUnassociatedAttachment function', () => {
    beforeEach(() => {
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockImplementation(params => {
        if (
          params.url === '/api/v2/help_center/articles/attachments'
          // eslint-disable-next-line no-underscore-dangle
          && params.data._streams[3].includes(`filename="${articleAttachmentInstance.value.filename}"`)
        ) {
          return {
            status: 200,
            data: {
              article_attachment: {
                id: 20222022,
                file_name: articleAttachmentInstance.value.filename,
                content_type: articleAttachmentInstance.value.contentType,
                inline: articleAttachmentInstance.value.inline,
                content_url: 'https://yo.com',
              },
            },
          }
        }
        throw new Error('Err')
      })
    })
    it('should run the creation of unassociated attachment', async () => {
      const clonedAttachment = articleAttachmentInstance.clone()
      expect(clonedAttachment.value.id).toBeUndefined()
      await articleUtils.createUnassociatedAttachment(client, clonedAttachment)
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(clonedAttachment.value.id).toBe(20222022)
    })
  })
})
