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
  BRAND_TYPE_NAME,
  DOMAIN_TYPE_NAME,
  EMAIL_CUSTOMIZATION_TYPE_NAME,
  ERROR_PAGE_TYPE_NAME,
  SIGN_IN_PAGE_TYPE_NAME,
} from '../constants'
import { FilterCreator } from '../filter'

const log = logger(module)

export type BrandCustomizationType =
  | typeof EMAIL_CUSTOMIZATION_TYPE_NAME
  | typeof ERROR_PAGE_TYPE_NAME
  | typeof SIGN_IN_PAGE_TYPE_NAME

const getParentBrand = (instance: InstanceElement): InstanceElement | undefined => {
  const parent = getParent(instance)
  if (parent.elemID.typeName === BRAND_TYPE_NAME) {
    return parent
  }
  return getParentBrand(parent)
}

export const brandCustomizationsToContentField: Record<BrandCustomizationType, string> = {
  [EMAIL_CUSTOMIZATION_TYPE_NAME]: 'body',
  [ERROR_PAGE_TYPE_NAME]: 'pageContent',
  [SIGN_IN_PAGE_TYPE_NAME]: 'pageContent',
}

const getMatchingDomainInstance = (
  instance: InstanceElement,
  domainByBrandElementID: Record<string, InstanceElement[]>,
): InstanceElement | undefined => {
  try {
    const matchingBrand = getParentBrand(instance)
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
  content,
  domain,
}: {
  content: string
  domain: InstanceElement
}): TemplateExpression | string => {
  const domainValue = domain.value.domain
  if (!_.isString(domainValue)) {
    log.warn('received invalid domain value %s for domain %s', inspectValue(domainValue), domain.elemID.getFullName())
    return content
  }
  const domainRegex = new RegExp(`(${domainValue})`)
  const domainReplacer: TemplateExtractionFunc = expression =>
    expression === domainValue ? new ReferenceExpression(domain.elemID, domain) : expression
  const { urls, scripts } = parseTagsFromHtml(content)
  const htmlTags = urls.concat(scripts)
  const htmlTagsAsTemplates = htmlTags.map(({ value, loc }) => ({
    value: extractTemplate(value, [domainRegex], domainReplacer),
    loc,
  }))
  return mergeDistinctReferences(content, htmlTagsAsTemplates)
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
    const brandCustomizationTypes = Object.keys(brandCustomizationsToContentField)
    const brandCustomizations = elements
      .filter(isInstanceElement)
      .filter(instance => brandCustomizationTypes.includes(instance.elemID.typeName))

    const domainsWithBrand = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === DOMAIN_TYPE_NAME)
      .filter(instance => isReferenceExpression(instance.value.brandId))

    const domainByBrandElementID = _.groupBy(domainsWithBrand, instance => instance.value.brandId.elemID.getFullName())

    brandCustomizations.forEach(instance => {
      const fieldName = brandCustomizationsToContentField[instance.elemID.typeName as BrandCustomizationType]
      const content = _.get(instance.value, fieldName)
      const matchingDomain = getMatchingDomainInstance(instance, domainByBrandElementID)
      if (_.isString(content) && matchingDomain !== undefined) {
        const template = getTemplateFromContent({ content, domain: matchingDomain })
        instance.value[fieldName] = template
      }
    })
  },
})

export default brandCustomizationsFilter
