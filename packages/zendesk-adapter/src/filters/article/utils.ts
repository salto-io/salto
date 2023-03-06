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
import _ from 'lodash'
import Joi from 'joi'
import FormData from 'form-data'
import { logger } from '@salto-io/logging'
import {
  elementExpressionStringifyReplacer,
  getParent,
  normalizeFilePathPart,
  replaceTemplatesWithValues,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { collections, promises } from '@salto-io/lowerdash'
import {
  InstanceElement,
  isReferenceExpression,
  isStaticFile,
  isTemplateExpression,
  ObjectType,
  ReferenceExpression,
  StaticFile,
  Values,
} from '@salto-io/adapter-api'
import ZendeskClient from '../../client/client'
import { ZENDESK } from '../../constants'
import { getZendeskError } from '../../errors'
import { CLIENT_CONFIG, ZendeskApiConfig, ZendeskConfig } from '../../config'
import { prepRef } from './article_body'


const { sleep } = promises.timeout
const log = logger(module)
const { awu } = collections.asynciterable

const RESULT_MAXIMUM_OUTPUT_SIZE = 100
export const ATTACHMENTS_FIELD_NAME = 'attachments'

type Attachment = InstanceElement & {
  value: {
    id: number
    // eslint-disable-next-line camelcase
    file_name: string
    // eslint-disable-next-line camelcase
    content_type: string
    // eslint-disable-next-line camelcase
    content_url: string
    inline: boolean
  }
}

type AttachmentResponse = {
  id: number
  // eslint-disable-next-line camelcase
  file_name: string
  // eslint-disable-next-line camelcase
  content_type: string
  // eslint-disable-next-line camelcase
  content_url: string
  inline: boolean
}

const EXPECTED_ATTACHMENT_SCHEMA = Joi.array().items(Joi.object({
  value: Joi.object({
    id: Joi.number().required(),
    file_name: Joi.string().required(),
    content_type: Joi.string().required(),
    content_url: Joi.string().required(),
    inline: Joi.boolean().required(),
  }).unknown(true).required(),
}).unknown(true)).required()

export const isAttachments = (value: unknown): value is Attachment[] => {
  const { error } = EXPECTED_ATTACHMENT_SCHEMA.validate(value)
  if (error !== undefined) {
    log.error(`Received an invalid response for the attachments values: ${error.message}, ${safeJsonStringify(value, elementExpressionStringifyReplacer)}`)
    return false
  }
  return true
}

const EXPECTED_ATTACHMENT_RESPONSE_SCHEMA = Joi.array().items(Joi.object({
  id: Joi.number().required(),
  file_name: Joi.string().required(),
  content_type: Joi.string().required(),
  content_url: Joi.string().required(),
  inline: Joi.boolean().required(),
}).unknown(true)).required()

export const isAttachmentsResponse = (value: unknown): value is AttachmentResponse[] => {
  const { error } = EXPECTED_ATTACHMENT_RESPONSE_SCHEMA.validate(value)
  if (error !== undefined) {
    log.error(`Received an invalid response for the attachments values: ${error.message}, ${safeJsonStringify(value, elementExpressionStringifyReplacer)}`)
    return false
  }
  return true
}

const getAttachmentContent = async ({
  brandIdToClient, attachment, article, attachmentType,
}: {
  brandIdToClient: Record<string, ZendeskClient>
  attachment: Attachment
  article: InstanceElement | undefined
  attachmentType: ObjectType
}): Promise<void> => {
  if (article === undefined) {
    log.error(`could not add attachment ${attachment.elemID.getFullName()}, as could not find article for article_id ${attachment.value.article_id}`)
    return
  }
  const client = brandIdToClient[attachment.value.brand]
  const res = await client.getSinglePage({
    url: `/hc/article_attachments/${attachment.value.id}/${attachment.value.file_name}`,
    responseType: 'arraybuffer',
  })
  const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
  if (!Buffer.isBuffer(content)) {
    log.error(`Received invalid response from Zendesk API for attachment content, ${
      Buffer.from(safeJsonStringify(res.data, undefined, 2)).toString('base64').slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)
    }. Not adding article attachments`)
    return
  }
  const resourcePathName = `${normalizeFilePathPart(article.value.title)}/${normalizeFilePathPart(attachment.value.file_name)}`
  attachment.value.content = new StaticFile({
    filepath: `${ZENDESK}/${attachmentType.elemID.name}/${resourcePathName}`,
    content,
  })
}

export const getArticleAttachments = async ({ brandIdToClient, articleById, attachmentType, attachments, config }: {
  brandIdToClient: Record<string, ZendeskClient>
  articleById: Record<string, InstanceElement>
  attachmentType: ObjectType
  apiDefinitions: ZendeskApiConfig
  attachments: Attachment[]
  config: ZendeskConfig
}): Promise<void> => {
  const rateLimit = config[CLIENT_CONFIG]?.rateLimit?.get ?? 100
  log.debug(`there are ${attachments.length} attachments, going to get their content in chunks of ${rateLimit}`)
  const attachChunk = _.chunk(attachments, rateLimit)
  await awu(attachChunk).map(async (attach: Attachment[], index: number) => {
    log.debug(`starting article attachment chunk ${index + 1}/${attachChunk.length}`)
    await Promise.all(attach.map(async attachment => {
      const article = articleById[getParent(attachment).value.id]
      await getAttachmentContent({ brandIdToClient, attachment, article, attachmentType })
    }))
    await sleep(1000)
  }).toArray()
}

export const createUnassociatedAttachment = async (
  client: ZendeskClient,
  attachmentInstance: InstanceElement,
): Promise<void> => {
  try {
    log.info(`Creating unassociated article attachment: ${attachmentInstance.value.file_name}`)
    const fileContent = isStaticFile(attachmentInstance.value.content)
      ? await attachmentInstance.value.content.getContent()
      : attachmentInstance.value.content
    const form = new FormData()
    form.append('inline', attachmentInstance.value.inline.toString())
    form.append('file', fileContent, attachmentInstance.value.file_name)
    const res = await client.post({
      url: '/api/v2/help_center/articles/attachments',
      data: form,
      headers: { ...form.getHeaders() },
    })
    if (res === undefined) {
      log.error('Received an empty response from Zendesk API. Not adding article attachments')
      return
    }
    if (Array.isArray(res.data)) {
      log.error(`Received an invalid response from Zendesk API, ${safeJsonStringify(res.data, undefined, 2).slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)}. Not adding article attachments`)
      return
    }
    const createdAttachment = [res.data.article_attachment]
    if (!isAttachmentsResponse(createdAttachment)) {
      return
    }
    attachmentInstance.value.id = createdAttachment[0].id
  } catch (err) {
    throw getZendeskError(attachmentInstance.elemID, err)
  }
}

export const deleteArticleAttachment = async (
  client: ZendeskClient,
  attachmentInstance: InstanceElement,
): Promise<void> => {
  const res = await client.delete({
    url: `/api/v2/help_center/articles/attachments/${attachmentInstance.value.id}`,
  })
  if (res === undefined) {
    log.error('Received an empty response from Zendesk API when deleting an article attachment')
  }
}

export const updateArticleTranslationBody = async ({
  client,
  articleValues,
  attachmentInstances,
}: {
  client: ZendeskClient
  articleValues: Values
  attachmentInstances: InstanceElement[]
}): Promise<void> => {
  const attachmentElementsNames = attachmentInstances.map(instance => instance.elemID.name)
  const articleTranslations = articleValues?.translations
  if (!Array.isArray(articleTranslations)) {
    log.error(`Received an invalid translations value for attachment ${articleValues.name} - ${safeJsonStringify(articleTranslations, elementExpressionStringifyReplacer)}`)
    return
  }
  await awu(articleTranslations)
    .filter(isReferenceExpression)
    .filter(translationInstance => isTemplateExpression(translationInstance.value.value.body))
    .forEach(async translationInstance => {
      replaceTemplatesWithValues(
        { values: [translationInstance.value.value], fieldName: 'body' },
        {},
        (part: ReferenceExpression) => {
          const attachmentIndex = attachmentElementsNames.findIndex(name => name === part.elemID.name)
          if (attachmentIndex !== -1) {
            return attachmentInstances[attachmentIndex].value.id.toString()
          }
          return prepRef(part)
        }
      )
      await client.put({
        url: `/api/v2/help_center/articles/${articleValues?.id}/translations/${translationInstance.value.value.locale.value.value.locale}`,
        data: { translation: { body: translationInstance.value.value.body } },
      })
    })
}
