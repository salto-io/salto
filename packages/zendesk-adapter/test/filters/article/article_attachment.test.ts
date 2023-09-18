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
  AdditionChange, ModificationChange, Value, toChange, ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
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
  let elementsSource: ReadOnlyElementsSource
  let createAttachmentSpy: jest.SpyInstance
  let associateAttachmentSpy: jest.SpyInstance
  let deleteAttachmentSpy: jest.SpyInstance
  let mockPost: jest.SpyInstance

  let article: InstanceElement
  let attachment1: InstanceElement
  let attachment2: InstanceElement
  let attachment3: InstanceElement
  let attachmentWithoutParent: InstanceElement
  let unrelatedInstance: InstanceElement

  beforeEach(async () => {
    article = createArticle('article')
    attachment1 = createArticleAttachment('attachment1', 1, article)
    attachment2 = createArticleAttachment('attachment2', 2, article)
    attachment3 = createArticleAttachment('attachment3', 3, article)
    attachmentWithoutParent = createArticleAttachment('attachmentWithoutParent', 4)
    unrelatedInstance = new InstanceElement(
      'unrelated',
      new ObjectType({ elemID: new ElemID(ZENDESK, 'unrelated') }),
      {},
    )
    elementsSource = buildElementsSourceFromElements([
      article,
      attachment1.clone(),
      attachment2.clone(),
      attachment3.clone(),
      attachmentWithoutParent,
      unrelatedInstance,
    ])
    const attachments = [attachment1, attachment2, attachment3]
    attachments.forEach(attachment => {
      // On deploy, the parent is unresolved (which mean it is the value and not a reference expression)
      attachment.annotations[CORE_ANNOTATIONS.PARENT] = attachment.annotations[CORE_ANNOTATIONS.PARENT][0].value.value
    })
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })

    filter = articleAttachmentsFilter(createFilterCreatorParams({ client, elementsSource })) as FilterType
    createAttachmentSpy = jest.spyOn(articleUtils, 'createUnassociatedAttachment')
    associateAttachmentSpy = jest.spyOn(articleUtils, 'associateAttachments')
    deleteAttachmentSpy = jest.spyOn(articleUtils, 'deleteArticleAttachment')
    mockPost = jest.spyOn(client, 'post')
  })
  describe('deploy', () => {
    it('should return success on happy flow', async () => {
      const newAttachment = attachment1.clone()
      delete newAttachment.value.id // New elements doesn't have id until they are created
      const changes = [
        toChange({ after: newAttachment }),
        toChange({ before: attachment2, after: attachment3 }),
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
            toChange({ after: attachment1 }),
            toChange({ before: attachment2, after: attachment3 }),
          ],
          errors: [],
        },
        leftoverChanges: [toChange({ after: unrelatedInstance })],
      })
    })
    it('should return failure on error', async () => {
      const changes = [
        toChange({ after: attachmentWithoutParent }),
        toChange({ before: attachment2, after: attachment3 }),
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
              elemID: attachmentWithoutParent.elemID,
              severity: 'Error',
              message: 'Resolved attachment\'s parent is invalid',
            },
            {
              elemID: attachment3.elemID,
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
    beforeEach(async () => {
      jest.clearAllMocks()
    })
    it('should create unassociated attachment on attachment addition and modification', async () => {
      const changes: (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[] = [
        { action: 'add', data: { after: attachment1 } },
        { action: 'modify', data: { before: attachment2, after: attachment3 } },
      ]
      mockPost.mockResolvedValueOnce(createAttachmentRes(9))
      mockPost.mockResolvedValueOnce(createAttachmentRes(10))
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes, elementsSource })
      expect(mockPost).toHaveBeenCalledTimes(2)
      expect(createAttachmentSpy).toHaveBeenCalledWith(client, attachment1)
      expect(createAttachmentSpy).toHaveBeenCalledWith(client, attachment3)
      expect(articleNameToAttachments).toEqual({
        [article.elemID.name]: {
          article,
          attachmentAdditions: {
            9: { action: 'add', data: { after: attachment1 } },
          },
          attachmentModifications: {
            10: {
              oldAttachmentId: attachment2.value.id,
              newAttachmentId: 10,
              change: { action: 'modify', data: { before: attachment2, after: attachment3 } },
            },
          },
          attachmentFailures: [],
        },
      })
    })
    it('should return the correct articleNameToAttachments on failures', async () => {
      const changes: (AdditionChange<InstanceElement> | ModificationChange<InstanceElement>)[] = [
        { action: 'add', data: { after: attachment1 } },
        { action: 'add', data: { after: attachment2 } },
        { action: 'modify', data: { before: attachmentWithoutParent, after: attachmentWithoutParent } },
      ]
      mockPost.mockResolvedValueOnce(createAttachmentRes(undefined))
      mockPost.mockResolvedValueOnce(createAttachmentRes([1, 2, 3]))
      mockPost.mockResolvedValueOnce(createAttachmentRes('invalid'))
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes, elementsSource })
      expect(mockPost).toHaveBeenCalledTimes(2) // should not call createAttachment for parentless attachment1
      expect(createAttachmentSpy).toHaveBeenCalledWith(client, attachment1)
      expect(createAttachmentSpy).toHaveBeenCalledWith(client, attachment2)
      expect(articleNameToAttachments).toEqual({
        [article.elemID.name]: {
          article,
          attachmentAdditions: {},
          attachmentModifications: {},
          attachmentFailures: [
            {
              change: { action: 'add', data: { after: attachment1 } },
              reason: 'Received an attachment in an unexpected format from Zendesk API: [{"file_name":"f","content_type":"ct","content_url":"cu","inline":false}]',
            },
            {
              change: { action: 'add', data: { after: attachment2 } },
              reason: 'Received an attachment in an unexpected format from Zendesk API: [{"id":[1,2,3],"file_name":"f","content_type":"ct","content_url":"cu","inline":false}]',
            },
          ],
        },
        '': {
          attachmentAdditions: {},
          attachmentModifications: {},
          attachmentFailures: [
            {
              change: { action: 'modify', data: { before: attachmentWithoutParent, after: attachmentWithoutParent } },
              reason: 'Resolved attachment\'s parent is invalid',
            },
          ],
        },
      })
    })
  })

  describe('associateAttachmentToArticles', () => {
    const NEW_ATTACHMENT_ID = 99
    beforeEach(() => {
      jest.clearAllMocks()
      createAttachmentSpy.mockResolvedValue({ id: NEW_ATTACHMENT_ID })
    })
    it('should not associate attachments that have no parent article', async () => {
      const changes: AdditionChange<InstanceElement>[] = [{ action: 'add', data: { after: attachmentWithoutParent } }]
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes, elementsSource })
      const deployResult = await associateAttachmentToArticles({ client, articleNameToAttachments })
      expect(associateAttachmentSpy).not.toHaveBeenCalled()
      expect(deleteAttachmentSpy).not.toHaveBeenCalled()
      expect(deployResult).toEqual({
        appliedChanges: [],
        errors: [{
          elemID: attachmentWithoutParent.elemID,
          severity: 'Error',
          message: 'Resolved attachment\'s parent is invalid',
        }],
      })
    })
    it('should associate attachments to articles on attachment addition', async () => {
      const change: AdditionChange<InstanceElement> = { action: 'add', data: { after: attachment1 } }
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy(
        { client, changes: [change], elementsSource }
      )
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
      // clone the after because it is modified in the filter
      const change: ModificationChange<InstanceElement> = { action: 'modify', data: { before: attachment1, after: attachment1.clone() } }
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy(
        { client, changes: [change], elementsSource }
      )
      mockPost.mockResolvedValue({ status: SUCCESS_STATUS_CODE })
      const deployResult = await associateAttachmentToArticles({ client, articleNameToAttachments })
      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({ data: { attachment_ids: [NEW_ATTACHMENT_ID] } }))
      expect(deleteAttachmentSpy).toHaveBeenCalledTimes(1)
      expect(deleteAttachmentSpy).toHaveBeenCalledWith(client, attachment1.value.id)
      expect(deployResult).toEqual({
        errors: [],
        appliedChanges: [change],
      })
    })
    it('should delete new attachments on association failure', async () => {
      const changes: AdditionChange<InstanceElement>[] = [{ action: 'add', data: { after: attachment1 } }]
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes, elementsSource })
      associateAttachmentSpy.mockResolvedValueOnce([{ status: 400, ids: [NEW_ATTACHMENT_ID], error: 'error!' }])
      const deployResult = await associateAttachmentToArticles({ client, articleNameToAttachments })
      expect(deleteAttachmentSpy).toHaveBeenCalledTimes(1)
      expect(deleteAttachmentSpy).toHaveBeenCalledWith(client, NEW_ATTACHMENT_ID)
      expect(deployResult).toEqual({
        appliedChanges: [],
        errors: [{
          elemID: attachment1.elemID,
          severity: 'Error',
          message: 'error!',
        }],
      })
    })
    it('should handle different bulk associate results differently', async () => {
      const successIds = Array.from({ length: MAX_BULK_SIZE }, (_, i) => i + 1)
      const failureIds = Array.from({ length: MAX_BULK_SIZE }, (_, i) => i + 1 + MAX_BULK_SIZE)
      const attachments = successIds.concat(failureIds).map(id => createArticleAttachment(`attachment${id}`, id, article))
      const changes: AdditionChange<InstanceElement>[] = attachments.map(attachment => ({
        action: 'add',
        data: { after: attachment },
      }))
      elementsSource = buildElementsSourceFromElements([article, ...attachments])
      successIds.concat(failureIds).forEach(id => createAttachmentSpy.mockResolvedValueOnce({ id }))
      const articleNameToAttachments = await prepareArticleAttachmentsForDeploy({ client, changes, elementsSource })

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
