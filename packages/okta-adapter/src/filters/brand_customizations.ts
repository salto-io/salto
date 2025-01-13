/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import {
  InstanceElement,
  isInstanceElement,
  TemplateExpression,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import {
  TemplateExtractionFunc,
  extractTemplate,
  getParent,
  inspectValue,
  mergeDistinctReferences,
  parseTagsFromHtml,
} from '@salto-io/adapter-utils'
import {
  DOMAIN_TYPE_NAME,
  EMAIL_CUSTOMIZATION_TYPE_NAME,
  ERROR_PAGE_TYPE_NAME,
  SIGN_IN_PAGE_TYPE_NAME,
} from '../constants'
import { FilterCreator } from '../filter'

const log = logger(module)

const brandCustomizationTypes = [EMAIL_CUSTOMIZATION_TYPE_NAME, ERROR_PAGE_TYPE_NAME, SIGN_IN_PAGE_TYPE_NAME] as const
export type BrandsCustomizationType = (typeof brandCustomizationTypes)[number]

type BrandExtractionParams = {
  fieldName: string
  getMatchingBrandFunc: (instance: InstanceElement) => InstanceElement | undefined
}

const getParentOfParent = (instance: InstanceElement): InstanceElement | undefined => getParent(getParent(instance))

export const brandCustomizationsToContentField: Record<BrandsCustomizationType, BrandExtractionParams> = {
  [EMAIL_CUSTOMIZATION_TYPE_NAME]: {
    fieldName: 'body',
    getMatchingBrandFunc: getParentOfParent,
  },
  [ERROR_PAGE_TYPE_NAME]: {
    fieldName: 'pageContent',
    getMatchingBrandFunc: getParent,
  },
  [SIGN_IN_PAGE_TYPE_NAME]: {
    fieldName: 'pageContent',
    getMatchingBrandFunc: getParent,
  },
}

const getInstanceMatchingDomain = (
  instance: InstanceElement,
  domainByBrandElementID: Record<string, InstanceElement[]>,
): InstanceElement | undefined => {
  try {
    const matchingBrand =
      brandCustomizationsToContentField[instance.elemID.typeName as BrandsCustomizationType].getMatchingBrandFunc(
        instance,
      )
    if (!matchingBrand) {
      log.warn('failed to extract domain from instance %s, matching brand was not found', instance.elemID.getFullName())
      return undefined
    }
    const brandDomains = domainByBrandElementID[matchingBrand.elemID.getFullName()]
    if (brandDomains.length > 1) {
      log.warn(
        'found more than one domain for brand %s: %s, not extracting references',
        matchingBrand.elemID.getFullName(),
        brandDomains.map(domain => domain.elemID.getFullName()).join(', '),
      )
      return undefined
    }
    return brandDomains[0]
  } catch (e) {
    log.warn(
      'failed to extract matching brand for instance %s with error: %s, not extracting references from content',
      instance.elemID.getFullName(),
      e.message,
    )
    return undefined
  }
}

const getTemplateFromContent = ({
  instance,
  content,
  domainByBrandElementID,
}: {
  instance: InstanceElement
  content: string
  domainByBrandElementID: Record<string, InstanceElement[]>
}): TemplateExpression | string => {
  const domain = getInstanceMatchingDomain(instance, domainByBrandElementID)
  if (domain === undefined) {
    return content
  }
  const { urls, scripts } = parseTagsFromHtml(content)
  const domainValue = domain.value.domain
  if (!_.isString(domainValue)) {
    log.warn('received invalid domain value %s for domain %s', inspectValue(domainValue), domain.elemID.getFullName())
    return content
  }
  const domainRegex = new RegExp(`(${domainValue})`)
  const domainReplacer: TemplateExtractionFunc = expression =>
    expression === domainValue ? new ReferenceExpression(domain.elemID, domain) : expression
  const htmlTags = urls.concat(scripts)
  const htmlTagsAsTemplates = htmlTags.map(({ value, loc }) => ({
    value: extractTemplate(value, [domainRegex], domainReplacer),
    loc,
  }))
  const template = mergeDistinctReferences(content, htmlTagsAsTemplates)
  return template
}

/** *
 * Processes brand email templates and page customizations to replace references in their HTML content with references to the appropriate domain.
 */
const brandCustomizationsFilter: FilterCreator = ({ config: { fetch } }) => ({
  name: 'brandCustomizationsFilter',
  onFetch: async elements => {
    if (!fetch.enableBrandReferences) {
      return
    }
    log.debug('extracting references in brand customizations elements')
    const brandCustomizations = elements
      .filter(isInstanceElement)
      .filter(instance => (brandCustomizationTypes as readonly string[]).includes(instance.elemID.typeName))

    const domainsWithBrand = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === DOMAIN_TYPE_NAME)
      .filter(instance => isReferenceExpression(instance.value.brandId))

    const domainByBrandElementID = _.groupBy(domainsWithBrand, instance => instance.value.brandId.elemID.getFullName())

    brandCustomizations.forEach(instance => {
      const { fieldName } = brandCustomizationsToContentField[instance.elemID.typeName as BrandsCustomizationType]
      const content = _.get(instance.value, fieldName)
      if (_.isString(content)) {
        const template = getTemplateFromContent({ instance, content, domainByBrandElementID })
        instance.value[fieldName] = template
      }
    })
  },
})

export default brandCustomizationsFilter
