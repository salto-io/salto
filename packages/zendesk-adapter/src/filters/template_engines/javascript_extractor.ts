/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ReferenceExpression, TemplateExpression } from '@salto-io/adapter-api'
import { extractTemplate } from '@salto-io/adapter-utils'
import { DOMAIN_REGEX } from '../utils'
import { extractIdIfElementExists } from './utils'

export const extractNumericValueIdsFromScripts = (
  idsToElements: Record<string, InstanceElement>,
  script: string,
  digitAmount: number,
): string | TemplateExpression =>
  extractTemplate(script, [new RegExp(`(\\d{${digitAmount},})`)], expression =>
    extractIdIfElementExists(idsToElements, expression),
  )

export const extractDomainsAndFieldsFromScripts = (
  idsToElements: Record<string, InstanceElement>,
  matchBrandSubdomain: (url: string) => InstanceElement | undefined,
  script: string,
): string | TemplateExpression => {
  const locators = [
    {
      locatorRegex: /(request_custom_fields_\d+)/,
      elementFunc: (expression: string) => {
        const potentialId = expression.match(/(\d+)/)
        if (potentialId === null) {
          return expression
        }
        return ['request_custom_fields_', extractIdIfElementExists(idsToElements, potentialId[0])]
      },
    },
    {
      locatorRegex: DOMAIN_REGEX,
      elementFunc: (expression: string) => {
        const element = matchBrandSubdomain(expression)
        if (element !== undefined) {
          return new ReferenceExpression(element.elemID, element)
        }
        return expression
      },
    },
  ]
  return extractTemplate(
    script,
    locators.map(locator => locator.locatorRegex),
    expression => {
      const locator = locators.find(loc => expression.match(loc.locatorRegex) !== null)
      return locator !== undefined ? locator.elementFunc(expression) : expression
    },
  )
}
