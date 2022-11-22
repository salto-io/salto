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
import { FilterCreator } from '../filter'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME, ARTICLES_FIELD,
  BRAND_TYPE_NAME, CATEGORIES_FIELD,
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME, SECTIONS_FIELD,
} from '../constants'

const log = logger(module)
const { awu } = collections.asynciterable

const BODY_FIELD = 'body'

const ELEMENTS_REGEXES = [CATEGORIES_FIELD, SECTIONS_FIELD, ARTICLES_FIELD, ARTICLE_ATTACHMENT_TYPE_NAME].map(field => ({
  field,
  urlRegex: new RegExp(`(\\/${field}\\/\\d*)`),
  idRegex: new RegExp(`(?<url>/${field}/)(?<id>\\d*)`),
}))

const ATTACHED_IMG_URL_REGEX = /(https:\/\/.*?\.zendesk\.com\/hc\/article_attachments\/\d*)/g
const ARTICLE_ATTACHMENT_ID_URL_REGEX = /\/article_attachments\/(\d*)/

const DOMAIN_REGEX = /(https:\/\/[^/]+)/

// Attempt to match the regex to an element and create a reference to that element
const createElementReference = ({ urlPart, elements, idRegex }
  : { urlPart: string; elements: InstanceElement[]; idRegex: RegExp })
: TemplatePart[] | undefined => {
  const { url, id } = urlPart.match(idRegex)?.groups ?? {}
  if (url && id) {
    const referencedElement = elements.find(element => element.value.id.toString() === id)
    if (isInstanceElement(referencedElement)) {
      // We want to keep the original url and replace just the id
      return [url, new ReferenceExpression(referencedElement.elemID, referencedElement)]
    }
  }
  return undefined
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

const referenceUrls = ({ urlPart, articleAttachmentsById, additionalInstances }: {
  urlPart: string
  articleAttachmentsById: Record<string, InstanceElement>,
  additionalInstances: Record<string, InstanceElement[]>
}): TemplatePart[] => {
  // Attempt to match the brand
  const urlSubdomain = urlPart.match(DOMAIN_REGEX)?.pop()
  const urlBrand = additionalInstances[BRAND_TYPE_NAME]
    .find(brandInstance => brandInstance.value.brand_url === urlSubdomain)
  if (isInstanceElement(urlBrand)) {
    return [new ReferenceExpression(urlBrand.elemID.createNestedID('brand_url'), urlBrand?.value.brand_url)]
  }

  const attachedImageReference = urlPart.match(ATTACHED_IMG_URL_REGEX)
  if (attachedImageReference) {
    return referenceAttachedImageUrl({
      imageUrl: urlPart,
      brandInstances: additionalInstances[BRAND_TYPE_NAME],
      articleAttachmentsById,
    })
  }

  // Attempt to match other elements
  for (const { idRegex, field } of ELEMENTS_REGEXES) {
    const result = createElementReference({ urlPart, elements: additionalInstances[field], idRegex })
    if (result) {
      return result
    }
  }

  // If nothing matched, return the original url
  return [urlPart]
}

const updateArticleBody = (
  articleInstance: InstanceElement,
  articleAttachmentsById: Record<string, InstanceElement>,
  additionalInstances: Record<string, InstanceElement[]>
): void => {
  const originalArticleBody = articleInstance.value[BODY_FIELD]
  if (!_.isString(originalArticleBody)) {
    return
  }

  const processedArticleBody = extractTemplate(
    originalArticleBody,
    [DOMAIN_REGEX, ...ELEMENTS_REGEXES.map(s => s.urlRegex)],
    articleUrl => referenceUrls({ urlPart: articleUrl, articleAttachmentsById, additionalInstances }),
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
      const additionalInstances = {
        [BRAND_TYPE_NAME]: instances.filter(e => e.elemID.typeName === BRAND_TYPE_NAME),
        [CATEGORIES_FIELD]: instances.filter(e => e.elemID.typeName === CATEGORY_TYPE_NAME),
        [SECTIONS_FIELD]: instances.filter(e => e.elemID.typeName === SECTION_TYPE_NAME),
        [ARTICLES_FIELD]: instances.filter(e => e.elemID.typeName === ARTICLE_TYPE_NAME),
      }

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
          updateArticleBody(articleInstance, articleAttachmentsById, additionalInstances)))
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
