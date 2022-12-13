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
  ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS, ReferenceExpression, toChange,
  getChangeData,
  isInstanceElement,
  StaticFile,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { createFilterCreatorParams } from '../../utils'
import ZendeskClient from '../../../src/client/client'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, USER_SEGMENT_TYPE_NAME, ZENDESK } from '../../../src/constants'
import filterCreator from '../../../src/filters/article/article'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../../src/config'
import { createEveryoneUserSegmentInstance } from '../../../src/filters/everyone_user_segment'
import * as articleUtils from '../../../src/filters/article/utils'

jest.useFakeTimers()

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('article filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy' | 'onDeploy'>
  let filter: FilterType
  let mockGet: jest.SpyInstance
  let mockPost: jest.SpyInstance
  let mockDelete: jest.SpyInstance

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
  const userSegmentInstance = new InstanceElement(
    'notEveryone',
    new ObjectType({ elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME) }),
    {
      user_type: 'notEveryone',
      built_in: true,
      name: 'notEveryone',
    }
  )
  const articleInstance = new InstanceElement(
    'testArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      id: 1111,
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
    }
  )
  const anotherArticleInstance = new InstanceElement(
    'userSegmentArticle',
    new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
    {
      id: 2222,
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
      user_segment_id: new ReferenceExpression(userSegmentInstance.elemID, userSegmentInstance),
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
      id: 20222022,
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
  const articleTranslationInstance = new InstanceElement(
    'testArticleTranslation',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'article_translation') }),
    {
      locale: { locale: 'en-us' },
      title: 'The title of the article',
      draft: false,
      brand: brandInstance.value.id,
      body: '<p>ppppp</p>',
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]:
        [new ReferenceExpression(articleInstance.elemID, articleInstance)] },
  )
  articleInstance.value.translations = [
    new ReferenceExpression(articleTranslationInstance.elemID, articleTranslationInstance),
  ]
  const translationWithAttachmentInstance = new InstanceElement(
    'translationWithAttachment',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'article_translation') }),
    {
      locale: { id: 'en-us' },
      title: 'This translation has attachment',
      draft: false,
      brand: brandInstance.value.id,
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(
      articleWithAttachmentInstance.elemID,
      articleWithAttachmentInstance,
    )] },
  )
  articleWithAttachmentInstance.value.translations = [new ReferenceExpression(
    translationWithAttachmentInstance.elemID,
    translationWithAttachmentInstance,
  )]
  const userSegmentType = new ObjectType({ elemID: new ElemID(ZENDESK, USER_SEGMENT_TYPE_NAME) })
  const everyoneUserSegmentInstance = createEveryoneUserSegmentInstance(userSegmentType)

  const generateElements = (): (InstanceElement | ObjectType)[] => ([
    articleInstance, anotherArticleInstance, userSegmentInstance, userSegmentType,
    everyoneUserSegmentInstance,
  ]).map(element => element.clone())

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    const elementsSource = buildElementsSourceFromElements([
      userSegmentType,
      everyoneUserSegmentInstance,
      articleAttachmentInstance,
    ])
    const brandIdToClient = { [brandInstance.value.id]: client }
    filter = filterCreator(createFilterCreatorParams({
      client,
      elementsSource,
      brandIdToClient,
      config: {
        ...DEFAULT_CONFIG,
        [FETCH_CONFIG]: {
          include: [{
            type: '.*',
          }],
          exclude: [],
          guide: {
            brands: ['.*'],
          },
        },
      },
    })) as FilterType
  })


  describe('onFetch', () => {
    let elements: (InstanceElement | ObjectType)[]

    beforeEach(() => {
      elements = generateElements()
      mockGet = jest.spyOn(client, 'getSinglePage')
      mockGet.mockImplementation(params => {
        if ([
          '/api/v2/help_center/articles/333333/attachments',
        ].includes(params.url)) {
          return {
            status: 200,
            data: {
              article_attachments: [
                {
                  id: articleAttachmentInstance.value.id,
                  file_name: articleAttachmentInstance.value.filename,
                  content_type: articleAttachmentInstance.value.contentType,
                  inline: articleAttachmentInstance.value.inline,
                  content_url: 'https://yo.com',
                },
              ],
            },
          }
        }
        if ([
          '/api/v2/help_center/articles/2222/attachments',
          '/api/v2/help_center/articles/1111/attachments',
        ].includes(params.url)) {
          return { status: 200, data: { article_attachments: [] } }
        }
        if (params.url === '/hc/article_attachments/20222022/attachmentFileName.png') {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
    })

    it('should add Everyone user_segment_id field', async () => {
      await filter.onFetch(elements)
      const fetchedArticle = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'testArticle')
      expect(fetchedArticle?.value).toEqual({
        ...articleInstance.value,
        user_segment_id: new ReferenceExpression(
          everyoneUserSegmentInstance.elemID,
          everyoneUserSegmentInstance
        ),
      })
    })
    it('should not edit existing user_segment', async () => {
      await filter.onFetch(elements)
      const fetchedArticle = elements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'userSegmentArticle')
      expect(fetchedArticle?.value).toEqual(anotherArticleInstance.value)
    })
    it('should create article_attachment instance', async () => {
      const clonedElements = [articleWithAttachmentInstance].map(e => e.clone())
      await filter.onFetch(clonedElements)
      expect(clonedElements.map(e => e.elemID.getFullName()).sort())
        .toEqual([
          'zendesk.article.instance.articleWithAttachment',
          'zendesk.article_attachment',
          'zendesk.article_attachment.instance.title_12345__attachmentFileName_png_false@uuuvu',
        ])
      const fetchedAttachment = clonedElements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'title_12345__attachmentFileName_png_false@uuuvu')
      expect(fetchedAttachment?.value).toEqual(articleAttachmentInstance.value)
      const fetchedArticle = clonedElements
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'articleWithAttachment')
      expect(fetchedArticle?.value.attachments).toHaveLength(1)
      expect(fetchedArticle?.value.attachments[0].elemID.name).toBe('title_12345__attachmentFileName_png_false@uuuvu')
    })
  })

  describe('preDeploy', () => {
    beforeEach(() => {
      mockPost = jest.spyOn(client, 'post')
      mockPost.mockImplementation(params => {
        if ([
          '/api/v2/help_center/articles/333333/bulk_attachments',
        ].includes(params.url)) {
          return {
            status: 200,
          }
        }
        throw new Error('Err')
      })
      mockDelete = jest.spyOn(client, 'delete')
      mockDelete.mockImplementation(params => {
        if ([
          '/api/v2/help_center/articles/attachments/20222022',
        ].includes(params.url)) {
          return {
            status: 204,
          }
        }
        throw new Error('Err')
      })
    })
    it('should add the title and the body to the article instance from its translation', async () => {
      const clonedArticle = articleInstance.clone()
      const clonedTranslation = articleTranslationInstance.clone()
      const articleAddition = toChange({ after: clonedArticle })
      const TranslationAddition = toChange({ after: clonedTranslation })

      expect(clonedArticle.value.title).toBeUndefined()
      expect(clonedArticle.value.body).toBeUndefined()
      await filter.preDeploy([
        articleAddition,
        TranslationAddition,
      ])
      const filteredArticle = getChangeData(articleAddition)
      expect(filteredArticle.value.title).toBe('The title of the article')
      expect(filteredArticle.value.body).toBe('<p>ppppp</p>')
      expect(getChangeData(TranslationAddition)).toBe(clonedTranslation)
    })
    it('should run the creation of unassociated attachment', async () => {
      const mockAttachmentCreation = jest.spyOn(articleUtils, 'createUnassociatedAttachment')
        .mockImplementation(jest.fn())
      const clonedArticle = articleWithAttachmentInstance.clone()
      const clonedAttachment = articleAttachmentInstance.clone()
      await filter.preDeploy([
        { action: 'add', data: { after: clonedArticle } },
        { action: 'add', data: { after: clonedAttachment } },
      ])
      expect(mockAttachmentCreation).toHaveBeenCalledTimes(1)
      expect(mockAttachmentCreation).toHaveBeenCalledWith(client, clonedAttachment)
    })
    it('should create and associate modified attachments', async () => {
      const mockAttachmentCreation = jest.spyOn(articleUtils, 'createUnassociatedAttachment')
        .mockImplementation(jest.fn())
      const clonedArticle = articleWithAttachmentInstance.clone()
      const beforeClonedAttachment = articleAttachmentInstance.clone()
      const afterClonedAttachment = articleAttachmentInstance.clone()
      afterClonedAttachment.value.content = new StaticFile({
        filepath: 'zendesk/article_attachment/title/modified.png', encoding: 'binary', content: Buffer.from('modified'),
      })
      clonedArticle.value.attachments = [
        new ReferenceExpression(afterClonedAttachment.elemID, afterClonedAttachment),
      ]
      await filter.preDeploy([
        { action: 'modify', data: { before: beforeClonedAttachment, after: afterClonedAttachment } },
      ])

      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(mockAttachmentCreation).toHaveBeenCalledTimes(1)
      expect(mockAttachmentCreation).toHaveBeenCalledWith(client, afterClonedAttachment)
    })
    it('should delete new attachment in case associate fails', async () => {
      const mockAttachmentDeletion = jest.spyOn(articleUtils, 'deleteArticleAttachment')
        .mockImplementation(jest.fn())
      mockPost.mockReturnValueOnce({ status: 400 })
      const clonedArticle = articleWithAttachmentInstance.clone()
      const beforeClonedAttachment = articleAttachmentInstance.clone()
      const afterClonedAttachment = articleAttachmentInstance.clone()
      afterClonedAttachment.value.content = new StaticFile({
        filepath: 'zendesk/article_attachment/title/modified.png', encoding: 'binary', content: Buffer.from('modified'),
      })
      clonedArticle.value.attachments = [
        new ReferenceExpression(afterClonedAttachment.elemID, afterClonedAttachment),
      ]
      await filter.preDeploy([
        { action: 'modify', data: { before: beforeClonedAttachment, after: afterClonedAttachment } },
      ])

      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(mockAttachmentDeletion).toHaveBeenCalledTimes(1)
      expect(mockAttachmentDeletion).toHaveBeenCalledWith(client, afterClonedAttachment)
    })
  })

  describe('deploy', () => {
    beforeEach(() => {
      mockPost = jest.spyOn(client, 'post')
      // For article_attachment UT
      mockPost.mockImplementation(params => {
        if ([
          '/api/v2/help_center/articles/333333/bulk_attachments',
        ].includes(params.url)) {
          return {
            status: 200,
          }
        }
        throw new Error('Err')
      })
    })
    it('should pass the correct params to deployChange on create', async () => {
      const id = 2
      mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: articleInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: articleInstance } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations', 'attachments'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([{ action: 'add', data: { after: articleInstance } }])
    })

    it('should pass the correct params to deployChange on update', async () => {
      const id = 3333
      const clonedArticleBefore = articleInstance.clone()
      const clonedArticleAfter = articleInstance.clone()
      clonedArticleBefore.value.id = id
      clonedArticleAfter.value.id = id
      clonedArticleAfter.value.title = 'newTitle!'
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter
        .deploy([{ action: 'modify', data: { before: clonedArticleBefore, after: clonedArticleAfter } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedArticleBefore, after: clonedArticleAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations', 'attachments'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([
          {
            action: 'modify',
            data: { before: clonedArticleBefore, after: clonedArticleAfter },
          },
        ])
    })

    it('should pass the correct params to deployChange on remove', async () => {
      const id = 2
      const clonedArticle = articleInstance.clone()
      clonedArticle.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: clonedArticle } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if deployChange failed', async () => {
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: articleInstance } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: articleInstance } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['translations', 'attachments'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should associate attachments to articles on creation', async () => {
      const clonedArticle = articleWithAttachmentInstance.clone()
      const clonedAttachment = articleAttachmentInstance.clone()
      clonedArticle.value.attachments = [
        new ReferenceExpression(clonedAttachment.elemID, clonedAttachment),
      ]
      const id = 2
      mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedArticle } },
        { action: 'add', data: { after: clonedAttachment } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges)
        .toEqual([
          { action: 'add', data: { after: clonedArticle } },
          { action: 'add', data: { after: clonedAttachment } },
        ])
    })
  })

  describe('onDeploy', () => {
    it('should omit the title and the body from the article instance', async () => {
      const clonedArticle = articleInstance.clone()
      const clonedTranslation = articleTranslationInstance.clone()
      const articleAddition = toChange({ after: clonedArticle })
      const TranslationAddition = toChange({ after: clonedTranslation })

      clonedArticle.value.title = 'title'
      clonedArticle.value.body = 'body'
      await filter.onDeploy([
        articleAddition,
        TranslationAddition,
      ])
      const filteredArticle = getChangeData(articleAddition)
      expect(filteredArticle.value.title).toBeUndefined()
      expect(filteredArticle.value.body).toBeUndefined()
      expect(getChangeData(TranslationAddition)).toBe(clonedTranslation)
    })
  })
})
