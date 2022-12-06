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
import _ from 'lodash'
import Joi from 'joi'
import FormData from 'form-data'
import { logger } from '@salto-io/logging'
import { naclCase, normalizeFilePathPart, pathNaclCase, replaceTemplatesWithValues, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, isReferenceExpression, isStaticFile,
  isTemplateExpression, ObjectType, ReferenceExpression, StaticFile, Values,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import ZendeskClient from '../../client/client'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TYPE_NAME, ZENDESK } from '../../constants'
import { getZendeskError } from '../../errors'
import { ZendeskApiConfig } from '../../config'
import { prepRef } from './article_body'

const log = logger(module)
const { awu } = collections.asynciterable
const { RECORDS_PATH, SUBTYPES_PATH, TYPES_PATH, generateInstanceNameFromConfig } = elementsUtils

const RESULT_MAXIMUM_OUTPUT_SIZE = 100
export const ATTACHMENTS_FIELD_NAME = 'attachments'

type Attachment = {
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
  id: Joi.number().required(),
  file_name: Joi.string().required(),
  content_type: Joi.string().required(),
  content_url: Joi.string().required(),
  inline: Joi.boolean().required(),
}).unknown(true)).required()

const isAttachments = (value: unknown): value is Attachment[] => {
  const { error } = EXPECTED_ATTACHMENT_SCHEMA.validate(value)
  if (error !== undefined) {
    log.error(`Received an invalid response for the attachments values: ${error.message}, ${safeJsonStringify(value)}`)
    return false
  }
  return true
}

const createAttachmentInstance = ({
  attachment, attachmentType, article, content, apiDefinitions,
}: {
  attachment: Attachment
  attachmentType: ObjectType
  article: InstanceElement
  content: Buffer
  apiDefinitions: ZendeskApiConfig
}): InstanceElement => {
  const resourcePathName = `${normalizeFilePathPart(article.value.title)}/${normalizeFilePathPart(attachment.file_name)}`
  const attachmentValues = {
    id: attachment.id,
    filename: attachment.file_name,
    contentType: attachment.content_type,
    content: new StaticFile({
      filepath: `${ZENDESK}/${attachmentType.elemID.name}/${resourcePathName}`,
      content,
    }),
    inline: attachment.inline,
    brand: article.value.brand,
  }

  const articleRef = new ReferenceExpression(article.elemID, article)
  const configInstanceName = generateInstanceNameFromConfig(
    attachmentValues,
    ARTICLE_ATTACHMENT_TYPE_NAME,
    apiDefinitions,
  )
  const parentConfigInstanceName = generateInstanceNameFromConfig(
    article.value,
    ARTICLE_TYPE_NAME,
    apiDefinitions,
  )
  // Eventually the element name and path of article_attachment is changed due to it extends the parend id
  const tempName = (parentConfigInstanceName
    && apiDefinitions.types[ARTICLE_ATTACHMENT_TYPE_NAME].transformation?.extendsParentId)
    ? parentConfigInstanceName.concat(`__${configInstanceName}`)
    : configInstanceName
  const tempNaclName = naclCase(tempName)
  const tempPathName = pathNaclCase(tempNaclName)
  return new InstanceElement(
    tempNaclName,
    attachmentType,
    attachmentValues,
    [ZENDESK, RECORDS_PATH, ARTICLE_ATTACHMENT_TYPE_NAME, tempPathName],
    { [CORE_ANNOTATIONS.PARENT]: [articleRef] },
  )
}

export const createAttachmentType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(ZENDESK, ARTICLE_ATTACHMENT_TYPE_NAME),
    fields: {
      id: {
        refType: BuiltinTypes.SERVICE_ID_NUMBER,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      filename: { refType: BuiltinTypes.STRING },
      contentType: { refType: BuiltinTypes.STRING },
      content: { refType: BuiltinTypes.STRING },
      inline: { refType: BuiltinTypes.BOOLEAN },
      brand: { refType: BuiltinTypes.NUMBER },
    },
    path: [ZENDESK, TYPES_PATH, SUBTYPES_PATH, ARTICLE_ATTACHMENT_TYPE_NAME],
  })

const getAttachmentContent = async ({
  client, attachment, article, attachmentType, apiDefinitions,
}: {
  client: ZendeskClient
  attachment: Attachment
  article: InstanceElement
  attachmentType: ObjectType
  apiDefinitions: ZendeskApiConfig
}): Promise<InstanceElement | undefined> => {
  const res = await client.getSinglePage({
    url: `/hc/article_attachments/${attachment.id}/${attachment.file_name}`,
    responseType: 'arraybuffer',
  })
  const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
  if (!Buffer.isBuffer(content)) {
    log.error(`Received invalid response from Zendesk API for attachment content, ${
      Buffer.from(safeJsonStringify(res.data, undefined, 2)).toString('base64').slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)
    }. Not adding article attachments`)
    return undefined
  }
  return createAttachmentInstance({ attachment, attachmentType, article, content, apiDefinitions })
}

export const getArticleAttachments = async ({ client, article, attachmentType, apiDefinitions }: {
  client: ZendeskClient
  article: InstanceElement
  attachmentType: ObjectType
  apiDefinitions: ZendeskApiConfig
}): Promise<InstanceElement[]> => {
  const listAttachmentsResponse = await client.getSinglePage({
    url: `/api/v2/help_center/articles/${article.value.id}/attachments`,
  })
  if (listAttachmentsResponse === undefined) {
    log.error('Received an empty response from Zendesk API. Not adding article attachments')
    return []
  }
  if (Array.isArray(listAttachmentsResponse.data)) {
    log.error(`Received an invalid response from Zendesk API, ${safeJsonStringify(listAttachmentsResponse.data, undefined, 2).slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)}. Not adding article attachments`)
    return []
  }
  const attachments = listAttachmentsResponse.data.article_attachments
  if (!isAttachments(attachments)) {
    return []
  }
  const attachmentInstances = (await Promise.all(
    _.orderBy(attachments, ['file_name', 'content_type', 'inline']).map(async attachment =>
      getAttachmentContent({ client, attachment, article, attachmentType, apiDefinitions }))
  )).filter(values.isDefined)
  if (attachmentInstances.length > 0) {
    article.value[ATTACHMENTS_FIELD_NAME] = attachmentInstances
      .map(instance => new ReferenceExpression(instance.elemID, instance))
  }
  return attachmentInstances
}

export const createUnassociatedAttachment = async (
  client: ZendeskClient,
  attachmentInstance: InstanceElement,
): Promise<void> => {
  try {
    log.info(`Creating unassociated article attachment: ${attachmentInstance.value.filename}`)
    const fileContent = isStaticFile(attachmentInstance.value.content)
      ? await attachmentInstance.value.content.getContent()
      : attachmentInstance.value.content
    const form = new FormData()
    form.append('inline', attachmentInstance.value.inline.toString())
    form.append('file', fileContent, attachmentInstance.value.filename)
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
    if (!isAttachments(createdAttachment)) {
      return
    }
    attachmentInstance.value.id = createdAttachment[0].id
  } catch (err) {
    throw getZendeskError(attachmentInstance.elemID.getFullName(), err)
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
    log.error(`Received an invalid translations value for attachment ${articleValues.name} - ${safeJsonStringify(articleTranslations)}`)
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
