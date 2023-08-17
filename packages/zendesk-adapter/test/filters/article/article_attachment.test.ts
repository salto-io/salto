/*
*                      Copyright 2023 Salto Labs Ltd.
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
  ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS, ReferenceExpression,
  AdditionChange, ModificationChange, Value, toChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createFilterCreatorParams } from '../../utils'
import ZendeskClient from '../../../src/client/client'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME, ZENDESK } from '../../../src/constants'
import articleAttachmentsFilter, {
  associateAttachmentToArticles,
  prepareArticleAttachmentsForDeploy,
} from '../../../src/filters/article/article_attachment'
import * as articleUtils from '../../../src/filters/article/utils'
import { AttachmentResponse, MAX_BULK_SIZE, SUCCESS_STATUS_CODE } from '../../../src/filters/article/utils'

const createArticle = (name: string): InstanceElement => new InstanceElement(
  name,
  new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
  {}
)

const createArticleAttachment = (name: string, id: number, parent?: InstanceElement)
  : InstanceElement => new InstanceElement(
  name,
  new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME) }),
  {
    id,
    file_name: 'attachmentFileName.png',
    content_type: 'image/png',
    inline: false,
    content_url: 'https://someURL.com',
    content: 'aaa',
  },
  undefined,
  {
    [CORE_ANNOTATIONS.PARENT]: parent ? [new ReferenceExpression(parent.elemID, parent)] : undefined,
  },
)

// eslint-disable-next-line camelcase
const createAttachmentRes = (id: Value): { data: { article_attachment: AttachmentResponse }} => ({
  data: {
    article_attachment: {
      id,
      file_name: 'f',
      content_type: 'ct',
      content_url: 'cu',
      inline: false,
    },
  },
})

describe('article filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let createAttachmentSpy: jest.SpyInstance
  let associateAttachmentSpy: jest.SpyInstance
  let deleteAttachmentSpy: jest.SpyInstance
  let mockPost: jest.SpyInstance

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = articleAttachmentsFilter(createFilterCreatorParams({ client })) as FilterType
    createAttachmentSpy = jest.spyOn(articleUtils, 'createUnassociatedAttachment')
    associateAttachmentSpy = jest.spyOn(articleUtils, 'associateAttachments')
    deleteAttachmentSpy = jest.spyOn(articleUtils, 'deleteArticleAttachment')
    mockPost = jest.spyOn(client, 'post')
  })
  describe('deploy', () => {
    it('should return success on happy flow', async () => {
      const article = createArticle('article')
      const attachment = createArticleAttachment('attachment', 1, article)
      const oldAttachment = createArticleAttachment('oldAttachment', 2, article)
      const newAttachment = createArticleAttachment('newAttachment', 3, article)
      const unrelatedInstance = new InstanceElement(
        'unrelated',
        new ObjectType({ elemID: new ElemID(ZENDESK, 'unrelated') }),
        {},
      )
      const changes = [
        toChange({ after: attachment }),
        toChange({ before: oldAttachment, after: newAttachment }),
        toChange({ after: unrelatedInstance }),
      ]

      createAttachmentSpy.mockResolvedValueOnce({ id: 1 })
      createAttachmentSpy.mockResolvedValueOnce({ id: 3 })
      associateAttachmentSpy.mockResolvedValueOnce([{ status: SUCCESS_STATUS_CODE, ids: [1] }])
      associateAttachmentSpy.mockResolvedValueOnce([{ status: SUCCESS_STATUS_CODE, ids: [3] }])
      const result = await filter.deploy(changes)
      expect(result).toEqual({
        deployResult: {
          appliedChanges: [
            toChange({ after: attachment }),
            toChange({ before: oldAttachment, after: newAttachment }),
          ],
          errors: [],
        },
        leftoverChanges: [toChange({ after: unrelatedInstance })],
      })
    })
    it('should return failure on error', async () => {
      const article = createArticle('article')
      const attachment = createArticleAttachment('attachment', 1)
      const oldAttachment = createArticleAttachment('oldAttachment', 2, article)
      const newAttachment = createArticleAttachment('newAttachment', 3, article)
      const changes = [
        toChange({ after: attachment }),
        toChange({ before: oldAttachment, after: newAttachment }),
      ]

      createAttachmentSpy.mockResolvedValueOnce({ id: 3 })
      mockPost.mockResolvedValueOnce({ status: 400, ids: [3], data: 'error!' })
      deleteAttachmentSpy.mockResolvedValueOnce({})
      const result = await filter.deploy(changes)
      expect(result).toEqual({
        deployResult: {
          appliedChanges: [],
          errors: [
            {
              elemID: attachment.elemID,
              severity: 'Error',
              message: 'Couldn\'t find the attachment\'s parent article',
            },
            {
              elemID: newAttachment.elemID,
              severity: 'Error',
              message: 'could not associate chunk number 0 for article \'article\', status: 400, The unassociated attachment ids are: 3, error: "error!"',
            },
          ],
        },
        leftoverChanges: [],
      })
    })
  })
  describe('prepareArticleAttachmentsForDeploy', () => {
    let article: InstanceElement
    beforeEach(async () => {
      article = createArticle('article')
      jest.clearAllMocks()
    })
    it('should create unassociated attachment on attachment addition and modification', async () => {
      const newAttachment = createArticleAttachment('newAttachment', 1, article)
      const modifiedAttachment = createArticleAttachment('modifiedAttachment', 2, article)
      const changes: (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[] = [
        { action: 'add', data: { after: newAttachment } },
        { action: 'modify', data: { before: modifiedAttachment, after: modifiedAttachment } },
      ]
      mockPost.mockResolvedValueOnce(createAttachmentRes(3))
      mockPost.mockResolvedValueOnce(createAttachmentRes(4))
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes })
      expect(mockPost).toHaveBeenCalledTimes(2)
      expect(createAttachmentSpy).toHaveBeenCalledWith(client, newAttachment)
      expect(createAttachmentSpy).toHaveBeenCalledWith(client, modifiedAttachment)
      expect(articleNameToAttachments).toEqual({
        [article.elemID.name]: {
          article,
          attachmentAdditions: {
            3: { action: 'add', data: { after: newAttachment } },
          },
          attachmentModifications: {
            4: {
              oldAttachmentId: 2,
              newAttachmentId: 4,
              change: { action: 'modify', data: { before: modifiedAttachment, after: modifiedAttachment } },
            },
          },
          attachmentFailures: [],
        },
      })
    })
    it('should return the correct articleNameToAttachments on failures', async () => {
      const newAttachment1 = createArticleAttachment('newAttachment1', 1, article)
      const newAttachment2 = createArticleAttachment('newAttachment2', 2, article)
      const modifiedAttachment = createArticleAttachment('modifiedAttachment', 3)

      const changes: (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[] = [
        { action: 'add', data: { after: newAttachment1 } },
        { action: 'add', data: { after: newAttachment2 } },
        { action: 'modify', data: { before: modifiedAttachment, after: modifiedAttachment } },
      ]
      mockPost.mockResolvedValueOnce(createAttachmentRes(undefined))
      mockPost.mockResolvedValueOnce(createAttachmentRes([1, 2, 3]))
      mockPost.mockResolvedValueOnce(createAttachmentRes('invalid'))
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes })
      expect(mockPost).toHaveBeenCalledTimes(2) // should not call createAttachment for parentless attachment
      expect(createAttachmentSpy).toHaveBeenCalledWith(client, newAttachment1)
      expect(createAttachmentSpy).toHaveBeenCalledWith(client, newAttachment2)
      expect(articleNameToAttachments).toEqual({
        [article.elemID.name]: {
          article,
          attachmentAdditions: {},
          attachmentModifications: {},
          attachmentFailures: [
            {
              change: { action: 'add', data: { after: newAttachment1 } },
              reason: 'Received an attachment in an unexpected format from Zendesk API: [{"file_name":"f","content_type":"ct","content_url":"cu","inline":false}]',
            },
            {
              change: { action: 'add', data: { after: newAttachment2 } },
              reason: 'Received an attachment in an unexpected format from Zendesk API: [{"id":[1,2,3],"file_name":"f","content_type":"ct","content_url":"cu","inline":false}]',
            },
          ],
        },
        '': {
          attachmentAdditions: {},
          attachmentModifications: {},
          attachmentFailures: [
            {
              change: { action: 'modify', data: { before: modifiedAttachment, after: modifiedAttachment } },
              reason: 'Couldn\'t find the attachment\'s parent article',
            },
          ],
        },
      })
    })
  })

  describe('associateAttachmentToArticles', () => {
    const OLD_ATTACHMENT_ID = 1
    const NEW_ATTACHMENT_ID = 2
    let article: InstanceElement
    let oldAttachment: InstanceElement
    let newAttachment: InstanceElement
    beforeEach(() => {
      jest.clearAllMocks()
      article = createArticle('article')
      oldAttachment = createArticleAttachment('oldAttachment', OLD_ATTACHMENT_ID, article)
      newAttachment = createArticleAttachment('newAttachment', NEW_ATTACHMENT_ID, article)
      createAttachmentSpy.mockResolvedValue({ id: NEW_ATTACHMENT_ID })
    })
    it('should not associate attachments that have no parent article', async () => {
      const attachmentWithNoParent = createArticleAttachment('attachmentWithNoParent', OLD_ATTACHMENT_ID)
      const changes: AdditionChange<InstanceElement>[] = [{ action: 'add', data: { after: attachmentWithNoParent } }]
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes })
      const deployResult = await associateAttachmentToArticles({ client, articleNameToAttachments })
      expect(associateAttachmentSpy).not.toHaveBeenCalled()
      expect(deleteAttachmentSpy).not.toHaveBeenCalled()
      expect(deployResult).toEqual({
        appliedChanges: [],
        errors: [{
          elemID: attachmentWithNoParent.elemID,
          severity: 'Error',
          message: 'Couldn\'t find the attachment\'s parent article',
        }],
      })
    })
    it('should associate attachments to articles on attachment addition', async () => {
      const change: AdditionChange<InstanceElement> = { action: 'add', data: { after: newAttachment } }
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes: [change] })
      mockPost.mockResolvedValue({ status: SUCCESS_STATUS_CODE })
      const deployResult = await associateAttachmentToArticles({ client, articleNameToAttachments })
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({ data: { attachment_ids: [NEW_ATTACHMENT_ID] } }))
      expect(deleteAttachmentSpy).not.toHaveBeenCalled()
      expect(deployResult).toEqual({
        errors: [],
        appliedChanges: [change],
      })
    })
    it('should associate new attachments and unassociate old attachments to articles on attachment modification', async () => {
      const change: ModificationChange<InstanceElement> = { action: 'modify', data: { before: oldAttachment, after: newAttachment } }
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes: [change] })
      mockPost.mockResolvedValue({ status: SUCCESS_STATUS_CODE })
      const deployResult = await associateAttachmentToArticles({ client, articleNameToAttachments })
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({ data: { attachment_ids: [NEW_ATTACHMENT_ID] } }))
      expect(deleteAttachmentSpy).toHaveBeenCalledTimes(1)
      expect(deleteAttachmentSpy).toHaveBeenCalledWith(client, OLD_ATTACHMENT_ID)
      expect(deployResult).toEqual({
        errors: [],
        appliedChanges: [change],
      })
    })
    it('should delete new attachments on association failure', async () => {
      const changes: AdditionChange<InstanceElement>[] = [{ action: 'add', data: { after: newAttachment } }]
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes })
      associateAttachmentSpy.mockResolvedValueOnce([{ status: 400, ids: [NEW_ATTACHMENT_ID], error: 'error!' }])
      const deployResult = await associateAttachmentToArticles({ client, articleNameToAttachments })
      expect(deleteAttachmentSpy).toHaveBeenCalledTimes(1)
      expect(deleteAttachmentSpy).toHaveBeenCalledWith(client, NEW_ATTACHMENT_ID)
      expect(deployResult).toEqual({
        appliedChanges: [],
        errors: [{
          elemID: newAttachment.elemID,
          severity: 'Error',
          message: 'error!',
        }],
      })
    })
    it('should handle different bulk associate results differently', async () => {
      const successIds = Array.from({ length: MAX_BULK_SIZE }, (_, i) => i + 1)
      const failureIds = Array.from({ length: MAX_BULK_SIZE }, (_, i) => i + 1 + MAX_BULK_SIZE)
      const changes: AdditionChange<InstanceElement>[] = successIds.concat(failureIds).map(id => ({
        action: 'add',
        data: { after: createArticleAttachment(`attachment${id}`, id, article) },
      }))
      successIds.concat(failureIds).forEach(id => createAttachmentSpy.mockResolvedValueOnce({ id }))
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes })

      associateAttachmentSpy.mockResolvedValueOnce([
        { status: SUCCESS_STATUS_CODE, ids: successIds },
        { status: 400, ids: failureIds, error: 'error!' },
      ])
      associateAttachmentSpy.mockResolvedValueOnce([])
      deleteAttachmentSpy.mockResolvedValue({})
      const deployResult = await associateAttachmentToArticles({ client, articleNameToAttachments })

      expect(deleteAttachmentSpy).toHaveBeenCalledTimes(MAX_BULK_SIZE)
      failureIds.forEach(id => expect(deleteAttachmentSpy).toHaveBeenCalledWith(client, id))

      expect(deployResult).toEqual({
        appliedChanges: successIds.map(id => changes[id - 1]),
        errors: failureIds.map(id => ({
          elemID: createArticleAttachment(`attachment${id}`, id).elemID,
          severity: 'Error',
          message: 'error!',
        })),
      })
    })
  })
})
