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
import { logger } from '@salto-io/logging'
import { Change, Element, getChangeData, InstanceElement, isAdditionOrModificationChange,
  isInstanceChange, isInstanceElement, isReferenceExpression, ReferenceExpression,
  SaltoError, TemplateExpression, TemplatePart } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, extractTemplate, getParent, replaceTemplatesWithValues, resolveTemplates, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import wu from 'wu'
import { FilterCreator } from '../../filter'
import {
  ARTICLE_ATTACHMENTS_FIELD,
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_TRANSLATION_TYPE_NAME,
  ARTICLE_TYPE_NAME, ARTICLES_FIELD,
  BRAND_TYPE_NAME, CATEGORIES_FIELD,
  CATEGORY_TYPE_NAME,
  SECTION_TYPE_NAME, SECTIONS_FIELD, ZENDESK,
} from '../../constants'
import { createMissingInstance } from '../references/missing_references'
import { FETCH_CONFIG } from '../../config'
import { getBrandsForGuide } from '../utils'

const log = logger(module)
const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues


const BODY_FIELD = 'body'

const ELEMENTS_REGEXES = [CATEGORIES_FIELD, SECTIONS_FIELD, ARTICLES_FIELD, ARTICLE_ATTACHMENTS_FIELD].map(
  field => ({
    field,
    urlRegex: new RegExp(`(\\/${field}\\/\\d+)`),
    idRegex: new RegExp(`(?<url>/${field}/)(?<id>\\d+)`),
  })
)

const URL_REGEX = /(https?:[0-9a-zA-Z;,/?:@&=+$-_.!~*'()#]+)/
const DOMAIN_REGEX = /(https:\/\/[^/]+)/

type missingBrandInfo = {
  brandName: string
  brandSubdomain: string
  articleName: string
}

// Attempt to match the regex to an element and create a reference to that element
const createInstanceReference = ({ urlPart, urlBrandInstance, idToInstance, idRegex, field, enableMissingReferences }: {
  urlPart: string
  urlBrandInstance: InstanceElement
  idToInstance: Record<string, InstanceElement>
  idRegex: RegExp
  field: string
  enableMissingReferences?: boolean
}): TemplatePart[] | undefined => {
  const { url, id } = urlPart.match(idRegex)?.groups ?? {}
  if (url !== undefined && id !== undefined) {
    const referencedInstance = idToInstance[id]
    // Catch both options because the instance value might be resolved and then the 'brand' field will just be id
    const brandId = isReferenceExpression(referencedInstance?.value.brand)
      ? referencedInstance.value.brand.value.value.id
      : referencedInstance?.value.brand
    if (brandId === urlBrandInstance.value.id) {
      // We want to keep the original url and replace just the id
      return [url, new ReferenceExpression(referencedInstance.elemID, referencedInstance)]
    }
    // if could not find a valid instance, create a MissingReferences.
    if (enableMissingReferences) {
      const missingInstance = createMissingInstance(ZENDESK, field, `${urlBrandInstance.value.name}_${id}`)
      missingInstance.value.id = id
      return [url, new ReferenceExpression(missingInstance.elemID, missingInstance)]
    }
  }
  return undefined
}

const referenceUrls = ({ urlPart, urlBrandInstance, additionalInstances, enableMissingReferences }: {
  urlPart: string
  urlBrandInstance: InstanceElement
  additionalInstances: Record<string, Record<string, InstanceElement>>
  enableMissingReferences?: boolean
}): TemplatePart[] => {
  const urlSubdomain = urlPart.match(DOMAIN_REGEX)?.pop()
  // We already made sure that the brand exists, so we can just return it
  if (urlSubdomain !== undefined) {
    return [new ReferenceExpression(urlBrandInstance.elemID.createNestedID('brand_url'), urlBrandInstance?.value.brand_url)]
  }

  // Attempt to match other instances, stop on the first result
  const result = wu(ELEMENTS_REGEXES).map(({ idRegex, field }) =>
    createInstanceReference({
      urlPart,
      urlBrandInstance,
      idToInstance: additionalInstances[field],
      idRegex,
      field,
      enableMissingReferences,
    })).find(isDefined)

  // If nothing matched, return the original url
  return result ?? [urlPart]
}

const matchBrand = (url: string, brands: Record<string, InstanceElement>): InstanceElement | undefined => {
  const urlSubdomain = url.match(DOMAIN_REGEX)?.pop()
  const urlBrand = urlSubdomain ? brands[urlSubdomain] : undefined
  if (urlBrand !== undefined) {
    return urlBrand
  }
  return undefined
}

const updateArticleTranslationBody = ({
  translationInstance,
  additionalInstances,
  includedBrands,
  enableMissingReferences,
} : {
  translationInstance: InstanceElement
  additionalInstances: Record<string, Record<string, InstanceElement>>
  includedBrands: InstanceElement[]
  enableMissingReferences?: boolean
}): missingBrandInfo[] => {
  const missingBrands: missingBrandInfo[] = []
  const originalTranslationBody = translationInstance.value[BODY_FIELD]
  if (!_.isString(originalTranslationBody)) {
    return []
  }

  const articleName = getParent(translationInstance).elemID.name
  // Find the urls that are in the body
  const processedTranslationBody = extractTemplate(
    originalTranslationBody,
    [URL_REGEX],
    url => {
      // Make sure that a brand exists for that domain
      const urlBrandInstance = matchBrand(url, additionalInstances[BRAND_TYPE_NAME])
      if (urlBrandInstance === undefined) {
        return url
      }

      if (!includedBrands.includes(urlBrandInstance)) {
        // If the brand is excluded, don't try to create references
        missingBrands.push({
          brandName: urlBrandInstance.value.name,
          brandSubdomain: urlBrandInstance.value.subdomain,
          articleName,
        })
        return url
      }
      // Extract the referenced instances inside
      const urlParts = extractTemplate(
        url,
        [DOMAIN_REGEX, ...ELEMENTS_REGEXES.map(s => s.urlRegex)],
        urlPart => referenceUrls({
          urlPart,
          urlBrandInstance,
          additionalInstances,
          enableMissingReferences,
        })
      )
      return _.isString(urlParts) ? urlParts : urlParts.parts
    }
  )

  translationInstance.value.body = processedTranslationBody
  return _.isEmpty(missingBrands) ? [] : _.unionBy(missingBrands, obj => obj.brandName)
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

const getWarningsForMissingBrands = (
  missingBrandsForWarning: missingBrandInfo[]
): SaltoError[] => {
  const missingBrandsByBrandNames = _.groupBy(missingBrandsForWarning, 'brandName')
  const missingBrandsToArticleNames = Object.entries(missingBrandsByBrandNames)
    .map(([brandName, warningObjects]) =>
      ({
        brandName,
        // warningObjects is a list of length 1 at least
        brandSubdomain: warningObjects[0].brandSubdomain,
        articles: _.uniq(warningObjects.map(obj => obj.articleName)),
      }))
  return missingBrandsToArticleNames
    .map(missingBrandInfo => ({
      message: `Brand ${missingBrandInfo.brandName} (subdomain ${missingBrandInfo.brandSubdomain}) is referenced by articles, but it is not currently fetched - therefore URLs pointing to it are treated as external, and will not be modified if these articles are deployed to another environment.\nIf you would like to include this brand, please add it under fetch.guide.brands.\nThe brand is referenced from the following articles (partial list limited to 10): ${(missingBrandInfo.articles.slice(0, 10)).join(', ')}`,
      severity: 'Warning',
    }))
}

/**
 * Process body value in article translation instances to reference other objects
 */
const filterCreator: FilterCreator = ({ config }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    name: 'articleBodyFilter',
    onFetch: async (elements: Element[]) => {
      const instances = elements.filter(isInstanceElement)
      const additionalInstances = {
        [BRAND_TYPE_NAME]:
            _.keyBy(instances.filter(e => e.elemID.typeName === BRAND_TYPE_NAME), i => _.toString(i.value.brand_url)),
        [CATEGORIES_FIELD]:
            _.keyBy(instances.filter(e => e.elemID.typeName === CATEGORY_TYPE_NAME), i => _.toString(i.value.id)),
        [SECTIONS_FIELD]:
            _.keyBy(instances.filter(e => e.elemID.typeName === SECTION_TYPE_NAME), i => _.toString(i.value.id)),
        [ARTICLES_FIELD]:
            _.keyBy(instances.filter(e => e.elemID.typeName === ARTICLE_TYPE_NAME), i => _.toString(i.value.id)),
        [ARTICLE_ATTACHMENTS_FIELD]:
            _.keyBy(
              instances.filter(e => e.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME && e.value.id !== undefined),
              i => _.toString(i.value.id)
            ),
      }
      const includedBrands = getBrandsForGuide(instances, config[FETCH_CONFIG])
      const translationToMissingBrands = instances
        .filter(instance => instance.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
        .filter(translationInstance => !_.isEmpty(translationInstance.value[BODY_FIELD]))
        .flatMap(translationInstance => (
          updateArticleTranslationBody({
            translationInstance,
            additionalInstances,
            includedBrands,
            enableMissingReferences: config[FETCH_CONFIG].enableMissingReferences,
          })
        ))

      const warnings = _.isEmpty(translationToMissingBrands)
        ? []
        : getWarningsForMissingBrands(translationToMissingBrands)
      return { errors: warnings }
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
