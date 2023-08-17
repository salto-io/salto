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
  getParent,
  normalizeFilePathPart,
  replaceTemplatesWithValues,
  safeJsonStringify,
  inspectValue,
} from '@salto-io/adapter-utils'
import { collections, promises, values as lowerDashValues } from '@salto-io/lowerdash'
import {
  createSaltoElementError,
  InstanceElement,
  isReferenceExpression,
  isStaticFile,
  isTemplateExpression,
  ObjectType,
  ReferenceExpression,
  SaltoElementError,
  StaticFile, Value,
  Values,
} from '@salto-io/adapter-api'
import ZendeskClient from '../../client/client'
import { ZENDESK } from '../../constants'
import { getZendeskError } from '../../errors'
import { CLIENT_CONFIG, ZendeskApiConfig, ZendeskConfig } from '../../config'
import { prepRef } from './article_body'

const { isDefined } = lowerDashValues

const { sleep } = promises.timeout
const log = logger(module)
const { awu } = collections.asynciterable

const RESULT_MAXIMUM_OUTPUT_SIZE = 100
export const SUCCESS_STATUS_CODE = 200

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

export type AttachmentResponse = {
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
    log.error(`Received an invalid response for the attachments values: ${error.message}, ${inspectValue((value))}`)
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
    log.error(`Received an invalid response for the attachments values: ${error.message}, ${inspectValue(value)}`)
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
}): Promise<SaltoElementError | undefined> => {
  const contentWarning = (error: string): SaltoElementError => ({
    message: error,
    severity: 'Warning',
    elemID: attachment.elemID,
  })

  if (article === undefined) {
    const error = `could not add attachment ${attachment.elemID.getFullName()}, as could not find article for article_id ${attachment.value.article_id}`
    log.error(error)
    return contentWarning(error)
  }
  const client = brandIdToClient[attachment.value.brand]
  let res
  try {
    res = await client.getSinglePage({
      url: `/hc/article_attachments/${attachment.value.id}/${attachment.value.file_name}`,
      responseType: 'arraybuffer',
    })
  } catch (e) {
    const error = `Failed to get attachment content for attachment ${attachment.elemID.getFullName()}`
    log.error(`${error}, error: ${safeJsonStringify(e)}`)
    return contentWarning(error)
  }
  const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
  if (!Buffer.isBuffer(content)) {
    const error = `Received invalid content response from Zendesk API for attachment ${attachment.elemID.getFullName()}`
    const buffer = Buffer.from(safeJsonStringify(res.data, undefined, 2)).toString('base64').slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)
    log.error(`${error}, ${buffer}. Not adding article attachment`)
    return contentWarning(error)
  }

  const resourcePathName = `${normalizeFilePathPart(article.value.title)}/${normalizeFilePathPart(attachment.value.file_name)}`
  attachment.value.content = new StaticFile({
    filepath: `${ZENDESK}/${attachmentType.elemID.name}/${resourcePathName}`,
    content,
  })
  return undefined
}

export const getArticleAttachments = async ({ brandIdToClient, articleById, attachmentType, attachments, config }: {
  brandIdToClient: Record<string, ZendeskClient>
  articleById: Record<string, InstanceElement>
  attachmentType: ObjectType
  apiDefinitions: ZendeskApiConfig
  attachments: Attachment[]
  config: ZendeskConfig
}): Promise<SaltoElementError[]> => {
  const rateLimit = config[CLIENT_CONFIG]?.rateLimit?.get ?? 100
  log.debug(`there are ${attachments.length} attachments, going to get their content in chunks of ${rateLimit}`)
  const attachChunk = _.chunk(attachments, rateLimit)
  return awu(attachChunk).flatMap(async (attach: Attachment[], index: number) => {
    log.debug(`starting article attachment chunk ${index + 1}/${attachChunk.length}`)
    const errors = await Promise.all(attach.map(async attachment => {
      const article = articleById[getParent(attachment).value.id]
      return getAttachmentContent({ brandIdToClient, attachment, article, attachmentType })
    }))
    await sleep(1000)
    return errors
  }).filter(isDefined).toArray()
}

export const createUnassociatedAttachment = async (
  client: ZendeskClient,
  attachmentInstance: InstanceElement,
): Promise<number | undefined> => {
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
      return undefined
    }
    if (Array.isArray(res.data)) {
      log.error(`Received an invalid response from Zendesk API, ${safeJsonStringify(res.data, undefined, 2).slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)}. Not adding article attachments`)
      return undefined
    }
    const createdAttachment = [res.data.article_attachment]
    if (!isAttachmentsResponse(createdAttachment)) {
      return undefined
    }
    return createdAttachment[0].id
  } catch (err) {
    throw getZendeskError(attachmentInstance.elemID, err) // caught in adapter.ts
  }
}

export const MAX_BULK_SIZE = 20
export const associateAttachments = async (
  client: ZendeskClient,
  article: InstanceElement,
  attachmentsIds: number[]
): Promise<{ status: number; ids: number[] }[]> => {
  const attachChunk = _.chunk(attachmentsIds, MAX_BULK_SIZE)
  const articleId = article.value.id
  log.debug(`there are ${attachmentsIds.length} attachments to associate for article ${article.elemID.name}, associating in chunks of 20`)
  const allRes = await Promise.all(attachChunk.map(async (chunk: number[], index: number) => {
    log.debug(`starting article attachment associate chunk ${index + 1}/${attachChunk.length} for article ${article.elemID.name}`)

    const createErrorMsg = (error: Value, status?: number): string => (
      [
        `could not associate chunk number ${index} for article ${article.elemID.name}`,
        status !== undefined ? `, status: ${status}` : '',
        `The unassociated attachment ids are: ${chunk}, error: ${safeJsonStringify(error)}`,
      ].join())

    try {
      const res = await client.post({
        url: `/api/v2/help_center/articles/${articleId}/bulk_attachments`,
        data: { attachment_ids: chunk },
      })
      if (res.status !== SUCCESS_STATUS_CODE) {
        log.warn(createErrorMsg(res.data, res.status))
      }
      return { status: res.status, ids: chunk }
    } catch (e) {
      const error = e.reponse?.data ?? e
      const status = e.reponse?.status

      log.error(createErrorMsg(error, status))
      return { status, ids: chunk }
    }
  }))
  return allRes
}

export const deleteArticleAttachment = async (
  client: ZendeskClient,
  attachmentId: number,
): Promise<void> => {
  const res = await client.delete({
    url: `/api/v2/help_center/articles/attachments/${attachmentId}`,
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
    log.error(`Received an invalid translations value for attachment ${articleValues.name} - ${inspectValue(articleTranslations)}`)
    return
  }
  await awu(articleTranslations)
    .filter(isReferenceExpression)
    .filter(translationInstance => isTemplateExpression(translationInstance.value.value.body))
    .forEach(async translationInstance => {
      try {
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
      } catch (e) {
        log.error(`Error serializing article translation body in Deployment for ${translationInstance.elemID.getFullName()}: ${e}, stack: ${e.stack}`)
        throw createSaltoElementError({ // caught in adapter.ts
          message: `Error serializing article translation body in Deployment for ${translationInstance.elemID.getFullName()}: ${e}, stack: ${e.stack}`,
          severity: 'Error',
          elemID: translationInstance.elemID,
        })
      }
      await client.put({
        url: `/api/v2/help_center/articles/${articleValues?.id}/translations/${translationInstance.value.value.locale.value.value.locale}`,
        data: { translation: { body: translationInstance.value.value.body } },
      })
    })
}
