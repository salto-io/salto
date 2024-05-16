/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  isResolvedReferenceExpression,
  extractTemplate,
} from '@salto-io/adapter-utils'
import { collections, promises, values as lowerDashValues } from '@salto-io/lowerdash'
import {
  Change,
  createSaltoElementError,
  getChangeData,
  InstanceElement,
  isModificationChange,
  isStaticFile,
  isTemplateExpression,
  ObjectType,
  ReferenceExpression,
  SaltoElementError,
  StaticFile,
  TemplatePart,
  UnresolvedReference,
  Values,
} from '@salto-io/adapter-api'
import ZendeskClient from '../../client/client'
import { BRAND_TYPE_NAME, ZENDESK } from '../../constants'
import { getZendeskError } from '../../errors'
import { CLIENT_CONFIG, ZendeskApiConfig, ZendeskConfig } from '../../config'
import { DOMAIN_REGEX, ELEMENTS_REGEXES, transformReferenceUrls } from '../utils'

const { isDefined } = lowerDashValues

const { sleep } = promises.timeout
const log = logger(module)
const { awu } = collections.asynciterable

const RESULT_MAXIMUM_OUTPUT_SIZE = 100

// eslint-disable-next-line camelcase
type SourceLocaleModificationReqPayload = { category_locale?: string; section_locale?: string; article_locale?: string }

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

const EXPECTED_ATTACHMENT_SCHEMA = Joi.array()
  .items(
    Joi.object({
      value: Joi.object({
        id: Joi.number().required(),
        file_name: Joi.string().required(),
        content_type: Joi.string().required(),
        content_url: Joi.string().required(),
        inline: Joi.boolean().required(),
      })
        .unknown(true)
        .required(),
    }).unknown(true),
  )
  .required()

export const isAttachments = (value: unknown): value is Attachment[] => {
  const { error } = EXPECTED_ATTACHMENT_SCHEMA.validate(value)
  if (error !== undefined) {
    log.error(`Received an invalid response for the attachments values: ${error.message}, ${inspectValue(value)}`)
    return false
  }
  return true
}

const EXPECTED_ATTACHMENT_RESPONSE_SCHEMA = Joi.array()
  .items(
    Joi.object({
      id: Joi.number().required(),
      file_name: Joi.string().required(),
      content_type: Joi.string().required(),
      content_url: Joi.string().required(),
      inline: Joi.boolean().required(),
    }).unknown(true),
  )
  .required()

export const isAttachmentsResponse = (value: unknown): value is AttachmentResponse[] => {
  const { error } = EXPECTED_ATTACHMENT_RESPONSE_SCHEMA.validate(value)
  if (error !== undefined) {
    log.error(`Received an invalid response for the attachments values: ${error.message}, ${inspectValue(value)}`)
    return false
  }
  return true
}

const getAttachmentContent = async ({
  brandIdToClient,
  attachment,
  article,
  attachmentType,
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
  // need to initialize hash for the case where there is no content
  attachment.value.hash = 'INVALID_HASH'
  if (article === undefined) {
    const error = `could not add attachment ${attachment.elemID.getFullName()}, as could not find article for article_id ${attachment.value.article_id}`
    log.error(error)
    return contentWarning(error)
  }
  if (attachment.value.relative_path === undefined) {
    const error = `could not add attachment ${attachment.elemID.getFullName()}, as the relative_path is undefined`
    log.warn(error)
    return contentWarning(error)
  }
  const client = brandIdToClient[attachment.value.brand]
  let res
  try {
    const path = attachment.value.relative_path
    res = await client.get({
      url: `${path.substring(0, path.lastIndexOf('/'))}`,
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
    const buffer = Buffer.from(safeJsonStringify(res.data, undefined, 2))
      .toString('base64')
      .slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)
    log.error(`${error}, ${buffer}. Not adding article attachment`)
    return contentWarning(error)
  }

  const resourcePathName = `${normalizeFilePathPart(article.value.title)}/${normalizeFilePathPart(attachment.value.file_name)}`
  attachment.value.content = new StaticFile({
    filepath: `${ZENDESK}/${attachmentType.elemID.name}/${resourcePathName}`,
    content,
  })
  attachment.value.hash = attachment.value.content.hash
  return undefined
}

export const getArticleAttachments = async ({
  brandIdToClient,
  articleById,
  attachmentType,
  attachments,
  config,
}: {
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
  return awu(attachChunk)
    .flatMap(async (attach: Attachment[], index: number) => {
      log.debug(`starting article attachment chunk ${index + 1}/${attachChunk.length}`)
      const errors = await Promise.all(
        attach.map(async attachment => {
          const article = articleById[getParent(attachment).value.id]
          return getAttachmentContent({ brandIdToClient, attachment, article, attachmentType })
        }),
      )
      await sleep(1000)
      return errors
    })
    .filter(isDefined)
    .toArray()
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
      log.error(
        `Received an invalid response from Zendesk API, ${safeJsonStringify(res.data, undefined, 2).slice(0, RESULT_MAXIMUM_OUTPUT_SIZE)}. Not adding article attachments`,
      )
      return
    }
    const createdAttachment = [res.data.article_attachment]
    if (!isAttachmentsResponse(createdAttachment)) {
      return
    }
    attachmentInstance.value.id = createdAttachment[0].id
  } catch (err) {
    throw getZendeskError(attachmentInstance.elemID, err) // caught in adapter.ts
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

/**
 * Process template Expression references by the id type
 */
export const prepRef = (part: ReferenceExpression): TemplatePart => {
  // In some cases this function may run on the .before value of a Change, which may contain unresolved references.
  // .after values are always resolved because unresolved references are dropped by unresolved_references validator
  // we should add a generic solution since we have seen this repeating (SALTO-5074)
  // This fix is enough since the .before value is not used in the deployment process
  if (part.value instanceof UnresolvedReference) {
    log.trace(
      'prepRef received a part as unresolved reference, returning an empty string, instance fullName: %s ',
      part.elemID.getFullName(),
    )
    return ''
  }
  if (part.elemID.typeName === BRAND_TYPE_NAME) {
    // The value used to be a string, but now it's an instance element
    // we need to support versions both until all customers fetch the new version
    return _.isString(part.value) ? part.value : part.value.value.brand_url
  }
  if (part.elemID.isTopLevel()) {
    return part.value.value.id.toString()
  }
  if (!_.isString(part.value)) {
    // caught in try catch block
    throw new Error(
      `Received an invalid value inside a template expression ${part.elemID.getFullName()}: ${safeJsonStringify(part.value)}`,
    )
  }
  return part.value
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
    log.error(
      `Received an invalid translations value for attachment ${articleValues.name} - ${inspectValue(articleTranslations)}`,
    )
    return
  }
  await awu(articleTranslations)
    .filter(isResolvedReferenceExpression)
    .map(translationRef => translationRef.value)
    .filter(translationInstance => isTemplateExpression(translationInstance.value.body))
    .map(translationInstance => translationInstance.clone()) // we don't want to resolve the translation itself
    .forEach(async translationInstance => {
      try {
        replaceTemplatesWithValues(
          { values: [translationInstance.value], fieldName: 'body' },
          {},
          (part: ReferenceExpression) => {
            const attachmentIndex = attachmentElementsNames.findIndex(name => name === part.elemID.name)
            if (attachmentIndex !== -1) {
              return attachmentInstances[attachmentIndex].value.id.toString()
            }
            return prepRef(part)
          },
        )
      } catch (e) {
        log.error(
          `Error serializing article translation body in Deployment for ${translationInstance.elemID.getFullName()}: ${e}, stack: ${e.stack}`,
        )
        throw createSaltoElementError({
          // caught in adapter.ts
          message: `Error serializing article translation body in Deployment: ${e}, stack: ${e.stack}`,
          severity: 'Error',
          elemID: translationInstance.elemID,
        })
      }
      await client.put({
        url: `/api/v2/help_center/articles/${articleValues?.id}/translations/${translationInstance.value.locale.value.value.locale}`,
        data: { translation: { body: translationInstance.value.body } },
      })
    })
}

export const URL_REGEX = /(https?:[0-9a-zA-Z;,/?:@&=+$-_.!~*'()#]+)/

export const extractTemplateFromUrl = ({
  url,
  urlBrandInstance,
  instancesById,
  enableMissingReferences,
}: {
  url: string
  urlBrandInstance?: InstanceElement
  instancesById: Record<string, InstanceElement>
  enableMissingReferences?: boolean
}): string | TemplatePart[] => {
  const urlParts = extractTemplate(url, [DOMAIN_REGEX, ...ELEMENTS_REGEXES.map(s => s.urlRegex)], urlPart => {
    const urlSubdomain = urlPart.match(DOMAIN_REGEX)?.pop()
    // We already made sure that the brand exists, so we can just return it
    if (urlSubdomain !== undefined && urlBrandInstance !== undefined) {
      return [new ReferenceExpression(urlBrandInstance.elemID, urlBrandInstance)]
    }
    return transformReferenceUrls({
      urlPart,
      instancesById,
      enableMissingReferences,
      brandOfInstance: urlBrandInstance,
    })
  })
  return _.isString(urlParts) ? urlParts : urlParts.parts
}

/**
 * Modifying the source_locale is done through a different endpoint.
 * This function checks whether there are changes to the source_locale, and if there are - sends a put request to
 * the correct endpoint before any of the other changes get deployed.
 * Object can be a section, article or category
 */
export const maybeModifySourceLocaleInGuideObject = async (
  change: Change<InstanceElement>,
  client: ZendeskClient,
  object: 'articles' | 'sections' | 'categories',
): Promise<boolean> => {
  if (!isModificationChange(change)) {
    return true
  }
  const changeData = getChangeData(change)
  if (
    change.data.before.value.source_locale === changeData.value.source_locale ||
    changeData.value.source_locale === undefined
  ) {
    return true
  }
  const data: SourceLocaleModificationReqPayload = {}
  if (object === 'articles') {
    data.article_locale = changeData.value.source_locale
  } else if (object === 'categories') {
    data.category_locale = changeData.value.source_locale
  } else {
    data.section_locale = changeData.value.source_locale
  }
  try {
    const res = await client.put({
      url: `/api/v2/help_center/${object}/${changeData.value.id}/source_locale`,
      data,
    })
    return res.status === 200
  } catch (e) {
    log.error(`Failed to modify source_locale, error: ${inspectValue(e)}`)
    return false
  }
}
