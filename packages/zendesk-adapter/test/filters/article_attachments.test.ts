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
import FormData from 'form-data'
import {
  ObjectType, ElemID, InstanceElement, isInstanceElement, StaticFile, ReferenceExpression,
  CORE_ANNOTATIONS, toChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import filterCreator, { ATTACHMENTS_FIELD_NAME } from '../../src/filters/article_attachments'
import ZendeskClient from '../../src/client/client'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, ZENDESK } from '../../src/constants'
import { createFilterCreatorParams } from '../utils'
import { lookupFunc } from '../../src/filters/field_references'

jest.useFakeTimers()

describe('article attachments filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch'>
  let filter: FilterType
  let mockGet: jest.SpyInstance
  let mockPost: jest.SpyInstance

  const brandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })
  const attachmentType = new ObjectType({
    elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME),
  })
  const articleType = new ObjectType({
    elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME),
    fields: {
      [ATTACHMENTS_FIELD_NAME]: { refType: new ObjectType(attachmentType) },
      [BRAND_TYPE_NAME]: { refType: new ObjectType(brandType) },
    },
  })
  const articleId = 11
  const attachmentId = 111
  const filename = 'articleAttachment1.png'
  const content = Buffer.from('test')

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    const brandId = 121255
    const brandIdToClient = { [brandId]: client }
    filter = filterCreator(createFilterCreatorParams({ client, brandIdToClient })) as FilterType
  })

  describe('onFetch', () => {
    let articleInstance: InstanceElement
    beforeEach(() => {
      const brandInstance = new InstanceElement(
        'brandName',
        brandType,
        {
          id: 121255,
          subdomain: 'ignore',
        }
      )
      articleInstance = new InstanceElement(
        'testArticle',
        articleType,
        {
          id: articleId,
          name: 'testArticle',
          title: 'testArticle',
          brand: brandInstance.value.id,
        },
      )
      mockGet = jest.spyOn(client, 'getSinglePage')
      mockGet.mockImplementation(params => {
        if (params.url === `/api/v2/help_center/articles/${articleInstance.value.id}/attachments`) {
          return {
            status: 200,
            data: {
              article_attachments: [
                {
                  id: attachmentId,
                  file_name: filename,
                  content_type: 'image/png',
                  inline: true,
                  content_url: `https://ignore.zendesk.com/hc/article_attachments/${attachmentId}/${filename}`,
                },
              ],
            },
          }
        }
        if (params.url === `/hc/article_attachments/${attachmentId}/${filename}`) {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
    })
    it('should create article attachments instances', async () => {
      const elements = [articleType, articleInstance].map(e => e.clone())
      await filter.onFetch(elements)

      expect(elements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk.article',
          'zendesk.article.instance.testArticle',
          'zendesk.article_attachment',
          'zendesk.article_attachment.instance.testArticle__articleAttachment1_png@uuv',
        ])
    })
    it('should create a new attachment instance', async () => {
      const elements = [articleType, articleInstance].map(e => e.clone())
      await filter.onFetch(elements)

      const instances = elements.filter(isInstanceElement)
      const attachment = instances.find(e => e.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME)
      expect(attachment?.value).toEqual({
        id: attachmentId,
        filename,
        contentType: 'image/png',
        content: new StaticFile({
          filepath: 'zendesk/article_attachment/testArticle/articleAttachment1.png', encoding: 'binary', content,
        }),
        inline: true,
        brand: 121255,
      })
    })
    it('should update the article instance', async () => {
      const elements = [articleType, articleInstance].map(e => e.clone())
      await filter.onFetch(elements)

      const instances = elements.filter(isInstanceElement)
      const article = instances.find(e => e.elemID.typeName === ARTICLE_TYPE_NAME)
      const attachment = instances.find(
        e => e.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME
      ) as InstanceElement
      expect(article?.value).toEqual({
        ...articleInstance.value,
        [ATTACHMENTS_FIELD_NAME]: [new ReferenceExpression(attachment.elemID, attachment)],
      })
    })
  })

  describe('deploy', () => {
    let attachmentInstance: InstanceElement
    let articleInstance: InstanceElement
    beforeEach(() => {
      mockGet = jest.spyOn(client, 'getSinglePage')
      mockGet.mockImplementation(params => {
        if (params.url === `/hc/article_attachments/${attachmentId}/${filename}`) {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
      attachmentInstance = new InstanceElement(
        'articleAttachment',
        attachmentType,
        {
          id: attachmentId,
          filename: 'test.png',
          contentType: 'image/png',
          content: new StaticFile({
            filepath: 'zendesk/article_attachment/article1/test__test.png', encoding: 'binary', content,
          }),
          inline: true,
        },
      )
      articleInstance = new InstanceElement(
        'article',
        articleType,
        {
          id: articleId,
          name: 'test',
          active: true,
          [ATTACHMENTS_FIELD_NAME]: [
            new ReferenceExpression(attachmentInstance.elemID, attachmentInstance),
          ],
        },
      )
      attachmentInstance.annotate({
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(articleInstance.elemID, articleInstance),
        ],
      })
    })
    it('should add attachment instances', async () => {
      const clonedArticle = articleInstance.clone()
      const clonedAttachment = attachmentInstance.clone()
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockResolvedValueOnce({ data: { article: { attachment: { id: attachmentId, file_name: 'test.png' } } }, status: 201 })
      const resolvedArticleAddition = await resolveChangeElement(
        toChange({ after: clonedArticle }), lookupFunc
      )
      const resolvedAttachmentAddition = await resolveChangeElement(
        toChange({ after: clonedAttachment }), lookupFunc
      )
      // The changes are resolved due to the filter runs on Zendesk Guide types changes
      const res = await filter.deploy([
        resolvedArticleAddition,
        resolvedAttachmentAddition,
      ])
      const resolvedClonedArticle = clonedArticle.clone()
      resolvedClonedArticle.value[ATTACHMENTS_FIELD_NAME] = [attachmentId]
      resolvedClonedArticle.value.id = articleId

      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith({
        url: `/api/v2/help_center/articles/${articleId}/attachments`,
        data: expect.any(FormData),
        headers: expect.anything(),
      })

      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual(resolvedAttachmentAddition)
    })
    it('should not remove attachment instances in the filter', async () => {
      const clonedArticle = articleInstance.clone()
      const clonedAttachment = attachmentInstance.clone()
      mockPost = jest.spyOn(client, 'post')
      const res = await filter.deploy([
        { action: 'remove', data: { before: clonedArticle } },
        { action: 'remove', data: { before: clonedAttachment } },
      ])

      expect(mockPost).toHaveBeenCalledTimes(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(2)
    })
    it('should return errors for modification changes', async () => {
      const clonedAttachment = attachmentInstance.clone()
      const changedClonedAttachment = attachmentInstance.clone()
      changedClonedAttachment.value.filename = 'somethingElse'
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockResolvedValueOnce({ status: 404 })
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedAttachment, after: changedClonedAttachment } },
      ])

      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0]).toEqual(Error('article_attachment modification changes aren\'t supported'))
      expect(res.deployResult.appliedChanges).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)
    })
  })
})
