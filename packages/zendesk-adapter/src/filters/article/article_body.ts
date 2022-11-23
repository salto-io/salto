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
import { logger } from '@salto-io/logging'
import {
  Change, getChangeData, InstanceElement, isAdditionOrModificationChange,
  isInstanceChange, isInstanceElement, ReferenceExpression, TemplateExpression, TemplatePart,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData, extractTemplate, replaceTemplatesWithValues, resolveTemplates, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TRANSLATION_TYPE_NAME, ARTICLE_TYPE_NAME, BRAND_TYPE_NAME } from '../../constants'

const log = logger(module)
const { awu } = collections.asynciterable

const BODY_FIELD = 'body'

const BASE_URL_REGEX = /(https:\/\/.*\.zendesk\.com)/
const ATTACHED_IMG_URL_REGEX = /(https:\/\/.*?\.zendesk\.com\/hc\/article_attachments\/\d*)/g
const ARTICLE_ATTACHMENT_ID_URL_REGEX = /\/article_attachments\/(\d*)/
const ARTICLE_REF_URL_REGEX = /(https:\/\/.*\.zendesk\.com\/hc\/.*\/articles\/\d*)/g
const ARTICLE_REF_URL_GROUPS_REGEX = /((?<urlSubdomain>https:\/\/.*\.zendesk\.com)(?<translation>\/hc\/.*\/articles\/)(?<urlArticleId>\d*))/g

const referenceArticleUrl = ({
  articleUrl,
  brandInstances,
  articleInstances,
}: {
  articleUrl: string
  brandInstances: InstanceElement[]
  articleInstances: InstanceElement[]
}): TemplatePart[] => {
  const urlParts = ARTICLE_REF_URL_GROUPS_REGEX.exec(articleUrl)?.groups ?? {}
  // https://stackoverflow.com/questions/4724701/regexp-exec-returns-null-sporadically
  ARTICLE_REF_URL_GROUPS_REGEX.lastIndex = 0
  const { urlSubdomain, translation, urlArticleId } = urlParts

  const urlBrand = brandInstances
    .find(brandInstance => brandInstance.value.brand_url === urlSubdomain)
  const referencedArticle = articleInstances
    .find(articleInstance => articleInstance.value.id.toString() === urlArticleId)
  if (!isInstanceElement(urlBrand) || !isInstanceElement(referencedArticle)) {
    return [articleUrl]
  }
  return [
    new ReferenceExpression(urlBrand.elemID.createNestedID('brand_url'), urlBrand?.value.brand_url),
    translation,
    new ReferenceExpression(referencedArticle.elemID, referencedArticle),
  ]
}

const referenceAttachedImageUrl = ({
  imageUrl,
  brandInstances,
  articleAttachmentsById,
}: {
  imageUrl: string
  brandInstances: InstanceElement[]
  articleAttachmentsById: Record<string, InstanceElement>
}): TemplatePart[] => {
  const urlSubdomain = imageUrl.match(BASE_URL_REGEX)?.pop()
  const urlBrand = brandInstances
    .find(brandInstance => brandInstance.value.brand_url === urlSubdomain)
  const urlArticleAttachmentId = imageUrl.match(ARTICLE_ATTACHMENT_ID_URL_REGEX)?.pop()
  if (urlArticleAttachmentId === undefined) {
    return [imageUrl]
  }
  const referencedArticleAttachment = articleAttachmentsById[urlArticleAttachmentId]
  if (!isInstanceElement(urlBrand) || !isInstanceElement(referencedArticleAttachment)) {
    return [imageUrl]
  }
  return [
    new ReferenceExpression(urlBrand.elemID.createNestedID('brand_url'), urlBrand?.value.brand_url),
    '/hc/article_attachments/',
    new ReferenceExpression(referencedArticleAttachment.elemID, referencedArticleAttachment),
  ]
}

const updateArticleBody = ({
  articleInstance,
  brandInstances,
  articleInstances,
  articleAttachmentsById,
} : {
  articleInstance: InstanceElement
  brandInstances: InstanceElement[]
  articleInstances: InstanceElement[]
  articleAttachmentsById: Record<string, InstanceElement>
}): void => {
  const originalArticleBody = articleInstance.value[BODY_FIELD]
  if (!_.isString(originalArticleBody)) {
    return
  }
  const processedArticleBody = extractTemplate(
    originalArticleBody,
    [ARTICLE_REF_URL_REGEX, ATTACHED_IMG_URL_REGEX],
    expression => {
      const articleUrlReference = expression.match(ARTICLE_REF_URL_REGEX)
      if (articleUrlReference) {
        return referenceArticleUrl({ articleUrl: expression, brandInstances, articleInstances })
      }
      const attachedImageReference = expression.match(ATTACHED_IMG_URL_REGEX)
      if (attachedImageReference) {
        return referenceAttachedImageUrl({
          imageUrl: expression,
          brandInstances,
          articleAttachmentsById,
        })
      }
      return expression
    },
  )
  articleInstance.value.body = processedArticleBody
}

/**
 * Process template Expression references by the id type
 */
export const prepRef = (part: ReferenceExpression): TemplatePart => {
  if (part.elemID.isTopLevel()) {
    return part.value.value.id.toString()
  }
  if (!_.isString(part.value)) {
    throw new Error(`Received an invalid value inside a template expression ${part.elemID.getFullName()}: ${safeJsonStringify(part.value)}`)
  }
  return part.value
}

/**
 * Process body value in article instances to reference other objects
 */
const filterCreator: FilterCreator = () => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    onFetch: async elements => {
      const instances = elements.filter(isInstanceElement)
      const brandInstances = instances
        .filter(e => e.elemID.typeName === BRAND_TYPE_NAME)
      const articleInstances = instances
        .filter(e => e.elemID.typeName === ARTICLE_TYPE_NAME)
      const articleAttachmentsById: Record<string, InstanceElement> = _.keyBy(
        instances.filter(
          e => e.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME && e.value.id !== undefined
        ),
        instance => _.toString(instance.value.id)
      )
      instances
        .filter(instance => instance.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
        .filter(articleInstance => !_.isEmpty(articleInstance.value[BODY_FIELD]))
        .forEach(articleInstance => (
          updateArticleBody({
            articleInstance,
            brandInstances,
            articleInstances,
            articleAttachmentsById,
          })))
    },
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(
            change,
            instance => {
              try {
                replaceTemplatesWithValues(
                  { values: [instance.value], fieldName: 'body' },
                  deployTemplateMapping,
                  prepRef,
                )
              } catch (e) {
                log.error('Error parsing article body value in deployment', e)
              }
              return instance
            }
          )
        })
    },

    onDeploy: async (changes: Change<InstanceElement>[]) => {
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(
            change,
            instance => {
              resolveTemplates(
                { values: [instance.value], fieldName: 'body' },
                deployTemplateMapping,
              )
              return instance
            }
          )
        })
    },
  }
}

export default filterCreator
