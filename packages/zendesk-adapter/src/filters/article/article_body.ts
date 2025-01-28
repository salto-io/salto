/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  Change,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  isStaticFile,
  isTemplateExpression,
  SaltoError,
  StaticFile,
  TemplateExpression,
  TemplatePart,
} from '@salto-io/adapter-api'
import {
  applyFunctionToChangeData,
  createSaltoElementError,
  createTemplateExpression,
  ERROR_MESSAGES,
  extractTemplate,
  getParent,
  normalizeFilePathPart,
  replaceTemplatesWithValues,
  resolveTemplates,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { parserUtils } from '@salto-io/parser'
import { FilterCreator } from '../../filter'
import { ARTICLE_TRANSLATION_TYPE_NAME, BRAND_TYPE_NAME, ZENDESK } from '../../constants'
import { FETCH_CONFIG, isGuideEnabled } from '../../config'
import { getBrandsForGuide, matchBrand } from '../utils'
import { extractTemplateFromUrl, prepRef, URL_REGEX } from './utils'
import { ZendeskUserConfig } from '../../user_config'

const log = logger(module)
const { awu } = collections.asynciterable

const BODY_FIELD = 'body'

type missingBrandInfo = {
  brandName: string
  brandSubdomain: string
  articleName: string
}

const extractTranslationBodyParts = async (
  translationBody: string | TemplateExpression | StaticFile,
): Promise<TemplatePart[]> => {
  if (_.isString(translationBody)) {
    return [translationBody]
  }
  if (isTemplateExpression(translationBody)) {
    return translationBody.parts
  }
  if (isStaticFile(translationBody)) {
    if (translationBody.getContent() === undefined) {
      log.warn(`Translation body content is undefined for staticFile with path ${translationBody.filepath}`)
      return []
    }
    if (translationBody.isTemplate) {
      const templateExpression = await parserUtils.staticFileToTemplateExpression(translationBody)
      if (templateExpression === undefined) {
        return []
      }
      return templateExpression.parts
    }
    return [((await translationBody.getContent()) ?? '').toString()]
  }
  return []
}

const extractReferencesFromArticleTranslationBody = async ({
  translationInstance,
  instancesById,
  brandsByUrl,
  brandsIncludingGuide,
  templateExpressionConverter,
  enableMissingReferences,
}: {
  translationInstance: InstanceElement
  instancesById: Record<string, InstanceElement>
  brandsByUrl: Record<string, InstanceElement>
  brandsIncludingGuide: InstanceElement[]
  templateExpressionConverter: (
    translationBody: TemplateExpression,
    translationElemID: ElemID,
  ) => StaticFile | TemplateExpression
  enableMissingReferences?: boolean
}): Promise<missingBrandInfo[]> => {
  const missingBrands: missingBrandInfo[] = []
  const originalTranslationBody = translationInstance.value[BODY_FIELD]
  if (
    !_.isString(originalTranslationBody) &&
    !isTemplateExpression(originalTranslationBody) &&
    !isStaticFile(originalTranslationBody)
  ) {
    return []
  }

  const articleName = getParent(translationInstance).elemID.name
  // the body may have already been processed by a previous filter and converted to a template expression or static file
  // if so, we need to extract the parts of the template expression and process each of them
  const originalTranslationBodyParts = await extractTranslationBodyParts(originalTranslationBody)
  // Find the urls that are in the body
  const processedTranslationBodyParts = originalTranslationBodyParts.map(part =>
    isReferenceExpression(part)
      ? createTemplateExpression({ parts: [part] })
      : extractTemplate(part, [URL_REGEX], url => {
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
          return extractTemplateFromUrl({ url, instancesById, enableMissingReferences, urlBrandInstance })
        }),
  )

  const processedTranslationBody = createTemplateExpression({
    parts: processedTranslationBodyParts.flatMap(part => (_.isString(part) ? [part] : part.parts)),
  })
  translationInstance.value.body = templateExpressionConverter(processedTranslationBody, translationInstance.elemID)
  return _.isEmpty(missingBrands) ? [] : _.unionBy(missingBrands, obj => obj.brandName)
}

const getWarningsForMissingBrands = (missingBrandsForWarning: missingBrandInfo[]): SaltoError[] => {
  const missingBrandsByBrandNames = _.groupBy(missingBrandsForWarning, 'brandName')
  const missingBrandsToArticleNames = Object.entries(missingBrandsByBrandNames).map(([brandName, warningObjects]) => ({
    brandName,
    // warningObjects is a list of length 1 at least
    brandSubdomain: warningObjects[0].brandSubdomain,
    articles: _.uniq(warningObjects.map(obj => obj.articleName)),
  }))
  return missingBrandsToArticleNames.map(missingBrandInfo => ({
    message: ERROR_MESSAGES.OTHER_ISSUES,
    detailedMessage: `Brand ${missingBrandInfo.brandName} (subdomain ${missingBrandInfo.brandSubdomain}) is referenced by articles, but it is not currently fetched - therefore URLs pointing to it are treated as external, and will not be modified if these articles are deployed to another environment.\nIf you would like to include this brand, please add it under fetch.guide.brands.\nThe brand is referenced from the following articles (partial list limited to 10): ${missingBrandInfo.articles.slice(0, 10).join(', ')}`,
    severity: 'Warning',
  }))
}

const templateExpressionToStaticFile = (translationBody: TemplateExpression, translationElemID: ElemID): StaticFile => {
  // The filepath is temporary and will be updated in a following filter
  const filepath = `${ZENDESK}/article_translations/${normalizeFilePathPart(translationElemID.getFullName())}`
  return translationBody.parts.every(part => typeof part === 'string')
    ? new StaticFile({ filepath, content: Buffer.from(translationBody.parts.join('')) })
    : parserUtils.templateExpressionToStaticFile(translationBody, filepath)
}

export const templateExpressionIdentity = (
  translationBody: TemplateExpression,
  _translationElemID: ElemID,
): TemplateExpression => translationBody

export const articleBodyOnFetch =
  (
    templateExpressionConverter: (
      translationBody: TemplateExpression,
      translationElemID: ElemID,
    ) => StaticFile | TemplateExpression,
  ) =>
  async (elements: Element[], config: ZendeskUserConfig): Promise<{ errors: SaltoError[] }> => {
    const instances = elements.filter(isInstanceElement)
    const instancesById = _.keyBy(
      instances.filter(instance => _.isNumber(instance.value.id)),
      i => _.toString(i.value.id),
    )
    const brandsByUrl = _.keyBy(
      instances.filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME),
      i => _.toString(i.value.brand_url),
    )

    const brandsIncludingGuide = getBrandsForGuide(instances, config[FETCH_CONFIG])
    const translationToMissingBrands = (
      await Promise.all(
        instances
          .filter(instance => instance.elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
          .filter(translationInstance => !_.isEmpty(translationInstance.value[BODY_FIELD]))
          .flatMap(translationInstance =>
            extractReferencesFromArticleTranslationBody({
              translationInstance,
              instancesById,
              brandsByUrl,
              brandsIncludingGuide,
              templateExpressionConverter,
              enableMissingReferences: config[FETCH_CONFIG].enableMissingReferences,
            }),
          ),
      )
    ).flat()
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
      const templateExpressionConverter = config[FETCH_CONFIG].translationBodyAsStaticFile
        ? templateExpressionToStaticFile
        : templateExpressionIdentity
      return articleBodyOnFetch(templateExpressionConverter)(elements, config)
    },
    preDeploy: async (changes: Change<InstanceElement>[]) => {
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
            if (Buffer.isBuffer(instance.value.body)) {
              // Due to the resolver, the staticFile is converted to a buffer
              instance.value.body = instance.value.body.toString()
            }
            try {
              replaceTemplatesWithValues(
                { values: [instance.value], fieldName: 'body' },
                deployTemplateMapping,
                prepRef,
              )
            } catch (e) {
              const message = `Error serializing article translation body in deployment: ${e}, stack: ${e.stack}`

              throw createSaltoElementError({
                // caught in adapter.ts
                message,
                detailedMessage: message,
                severity: 'Error',
                elemID: instance.elemID,
              })
            }
            return instance
          })
        })
    },

    onDeploy: async (changes: Change<InstanceElement>[]) => {
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME)
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
            resolveTemplates({ values: [instance.value], fieldName: 'body' }, deployTemplateMapping)
            return instance
          })
        })
    },
  }
}

export default filterCreator
