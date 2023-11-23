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
import {
  Change, Element, getChangeData, InstanceElement, isAdditionOrModificationChange,
  isInstanceChange, isInstanceElement, isReferenceExpression, isTemplateExpression, ReferenceExpression,
  SaltoError, TemplateExpression, TemplatePart, UnresolvedReference,
} from '@salto-io/adapter-api'
import {
  applyFunctionToChangeData,
  compactTemplate,
  createTemplateExpression,
  extractTemplate,
  getParent,
  replaceTemplatesWithValues,
  resolveTemplates,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  BRAND_TYPE_NAME,
} from '../../constants'
import { FETCH_CONFIG, isGuideEnabled, ZendeskConfig } from '../../config'
import { ELEMENTS_REGEXES, getBrandsForGuide, transformReferenceUrls } from '../utils'

const log = logger(module)
const { awu } = collections.asynciterable

const BODY_FIELD = 'body'
const URL_REGEX = /(https?:[0-9a-zA-Z;,/?:@&=+$-_.!~*'()#]+)/
const DOMAIN_REGEX = /(https:\/\/[^/]+)/

type missingBrandInfo = {
  brandName: string
  brandSubdomain: string
  articleName: string
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
  instancesById,
  brandsByUrl,
  brandsIncludingGuide,
  enableMissingReferences,
} : {
  translationInstance: InstanceElement
  instancesById: Record<string, InstanceElement>
  brandsByUrl: Record<string, InstanceElement>
  brandsIncludingGuide: InstanceElement[]
  enableMissingReferences?: boolean
}): missingBrandInfo[] => {
  const missingBrands: missingBrandInfo[] = []
  const originalTranslationBody = translationInstance.value[BODY_FIELD]
  if (!_.isString(originalTranslationBody) && !isTemplateExpression(originalTranslationBody)) {
    return []
  }

  const articleName = getParent(translationInstance).elemID.name
  // the body may have already been processed by a previous filter and converted to a template expression
  // if so, we need to extract the parts of the template expression and process each of them
  const originalTranslationBodyParts = _.isString(originalTranslationBody)
    ? [originalTranslationBody]
    : originalTranslationBody.parts
  // Find the urls that are in the body
  const processedTranslationBodyParts = originalTranslationBodyParts.map(part =>
    (isReferenceExpression(part)
      ? createTemplateExpression({ parts: [part] })
      : extractTemplate(
        part,
        [URL_REGEX],
        url => {
          // Make sure that a brand exists for that domain
          const urlBrandInstance = matchBrand(url, brandsByUrl)
          if (urlBrandInstance === undefined) {
            return url
          }

          if (!brandsIncludingGuide.includes(urlBrandInstance)) {
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
            urlPart => {
              const urlSubdomain = urlPart.match(DOMAIN_REGEX)?.pop()
              // We already made sure that the brand exists, so we can just return it
              if (urlSubdomain !== undefined) {
                return [new ReferenceExpression(urlBrandInstance.elemID, urlBrandInstance)]
              }
              return transformReferenceUrls({
                urlPart,
                instancesById,
                enableMissingReferences,
                brandOfInstance: urlBrandInstance,
              })
            }
          )
          return _.isString(urlParts) ? urlParts : urlParts.parts
        }
      )))

  const processedTranslationBody = createTemplateExpression({ parts:
    processedTranslationBodyParts.flatMap(part => (_.isString(part) ? [part] : part.parts)) })
  translationInstance.value.body = compactTemplate(processedTranslationBody)
  return _.isEmpty(missingBrands) ? [] : _.unionBy(missingBrands, obj => obj.brandName)
}

/**
 * Process template Expression references by the id type
 */
export const prepRef = (part: ReferenceExpression): TemplatePart => {
  // In some cases this function may run on the .before value of a Change, which may contain unresolved references.
  // .after values are always resolved because unresolved references are dropped by unresolved_references validator
  // we should add a generic solution since we have seen this repeating
  // This fix is enough since the .before value is not used in the deployment process
  if (part.value instanceof UnresolvedReference) {
    log.debug('prepRef received a part as unresolved reference, returning an empty string, instance fullName: %s ', part.elemID.getFullName())
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

export const articleBodyOnFetch = (elements: Element[], config: ZendeskConfig): { errors: SaltoError[] } => {
  const instances = elements.filter(isInstanceElement)
  const instancesById = _.keyBy(
    instances.filter(instance => _.isNumber(instance.value.id)),
    i => _.toString(i.value.id)
  )
  const brandsByUrl = _.keyBy(
    instances.filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME),
    i => _.toString(i.value.brand_url)
  )

  const brandsIncludingGuide = getBrandsForGuide(instances, config[FETCH_CONFIG])
  const translationToMissingBrands = instances
    .filter(instance => instance.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
    .filter(translationInstance => !_.isEmpty(translationInstance.value[BODY_FIELD]))
    .flatMap(translationInstance => (
      updateArticleTranslationBody({
        translationInstance,
        instancesById,
        brandsByUrl,
        brandsIncludingGuide,
        enableMissingReferences: config[FETCH_CONFIG].enableMissingReferences,
      })
    ))

  const warnings = _.isEmpty(translationToMissingBrands)
    ? []
    : getWarningsForMissingBrands(translationToMissingBrands)
  return { errors: warnings }
}

/**
 * Process body value in article translation instances to reference other objects
 */
const filterCreator: FilterCreator = ({ config }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    name: 'articleBodyFilter',
    onFetch: async (elements: Element[]) => {
      if (!isGuideEnabled(config[FETCH_CONFIG])) {
        return undefined
      }
      return articleBodyOnFetch(elements, config)
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
                log.error(`Error serializing article translation body in deployment for ${instance.elemID.getFullName()}: ${e}, stack: ${e.stack}`)
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
