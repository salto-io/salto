/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { TemplateExpression } from '@salto-io/adapter-api'
import { extractTemplate, parseTagsFromHtml, PotentialReference } from '@salto-io/adapter-utils'
import { extractTemplateFromUrl, URL_REGEX } from '../article/utils'
import { TemplateEngineOptions } from './types'

// Regex for handlebar helper that may contain a reference to a URL.
// Assumes it's part of a string in an HTML attribute, which ends in a double quote.
// Example: <a href="{{help_center.url}}/hc/en-us/articles/360001234567">Link</a>
const HELP_CENTER_URL = /(\{\{help_center.url\}\}[^"]+)/

/*
 * Extracts potential references from a given string.
 * @param content - the string to extract the references from
 * @param urlBrandInstance - the brand instance to use for the URL reference
 * @param instancesById - a map of all instances by their ID
 * @param enableMissingReferences - whether to enable missing references
 */
export const parseUrlPotentialReferencesFromString = (
  content: string,
  { matchBrandSubdomain, idsToElements, enableMissingReferences }: TemplateEngineOptions,
): string | TemplateExpression =>
  extractTemplate(content, [URL_REGEX, HELP_CENTER_URL], expression => {
    if (expression.match(URL_REGEX)) {
      const urlBrandInstance = matchBrandSubdomain(expression)
      return urlBrandInstance !== undefined
        ? extractTemplateFromUrl({
            url: expression,
            urlBrandInstance,
            instancesById: idsToElements,
            enableMissingReferences,
          })
        : expression
    }
    return extractTemplateFromUrl({ url: expression, instancesById: idsToElements, enableMissingReferences })
  })

export const parseHtmlPotentialReferences = (
  content: string,
  { matchBrandSubdomain, idsToElements, enableMissingReferences }: TemplateEngineOptions,
): { urls: PotentialReference<string | TemplateExpression>[]; scripts: PotentialReference<string>[] } => {
  const { urls, scripts } = parseTagsFromHtml(content)
  return {
    urls: urls.map(url => ({
      value: parseUrlPotentialReferencesFromString(url.value, {
        matchBrandSubdomain,
        idsToElements,
        enableMissingReferences,
      }),
      loc: url.loc,
    })),
    scripts,
  }
}
