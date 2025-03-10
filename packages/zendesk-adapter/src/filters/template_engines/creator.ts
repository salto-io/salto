/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement, TemplateExpression } from '@salto-io/adapter-api'
import { PotentialReference, createTemplateExpression, mergeDistinctReferences } from '@salto-io/adapter-utils'
import { Themes } from '../../user_config'
import { parseHandlebarPotentialReferences } from './handlebar_parser'
import { parseHtmlPotentialReferences } from './html_parser'
import { extractDomainsAndFieldsFromScripts, extractNumericValueIdsFromScripts } from './javascript_extractor'
import { parsePotentialReferencesByPrefix } from './javascript_parser'
import { TemplateEngineOptions } from './types'

export type TemplateEngineCreator = (
  content: string,
  options: TemplateEngineOptions,
  javascriptReferenceLookupStrategy: Themes['referenceOptions']['javascriptReferenceLookupStrategy'],
) => string | TemplateExpression

const isNumericValuesStrategy = (
  javascriptReferenceLookupStrategy: Themes['referenceOptions']['javascriptReferenceLookupStrategy'],
): javascriptReferenceLookupStrategy is { strategy: 'numericValues'; minimumDigitAmount: number } =>
  javascriptReferenceLookupStrategy?.strategy === 'numericValues' &&
  javascriptReferenceLookupStrategy?.minimumDigitAmount !== undefined

const isVarNamePrefixStrategy = (
  javascriptReferenceLookupStrategy: Themes['referenceOptions']['javascriptReferenceLookupStrategy'],
): javascriptReferenceLookupStrategy is { strategy: 'varNamePrefix'; prefix: string } =>
  javascriptReferenceLookupStrategy?.strategy === 'varNamePrefix' &&
  javascriptReferenceLookupStrategy?.prefix !== undefined

const extractOrParseByStrategy = (
  scripts: PotentialReference<string>[],
  idsToElements: Record<string, InstanceElement>,
  javascriptReferenceLookupStrategy: Themes['referenceOptions']['javascriptReferenceLookupStrategy'],
): PotentialReference<string | TemplateExpression>[] => {
  if (isNumericValuesStrategy(javascriptReferenceLookupStrategy)) {
    return scripts.map(script => ({
      value: extractNumericValueIdsFromScripts(
        idsToElements,
        script.value,
        javascriptReferenceLookupStrategy.minimumDigitAmount,
      ),
      loc: script.loc,
    }))
  }
  if (isVarNamePrefixStrategy(javascriptReferenceLookupStrategy)) {
    return scripts.flatMap(script => {
      const parsedScripts = parsePotentialReferencesByPrefix(
        script.value,
        idsToElements,
        javascriptReferenceLookupStrategy.prefix,
      )
      return parsedScripts.map(parsedScript => ({
        value: parsedScript.value,
        loc: { start: script.loc.start + parsedScript.loc.start, end: script.loc.start + parsedScript.loc.end },
      }))
    })
  }
  return scripts
}

const extractDomainsAndFieldsAfterStrategy = (
  script: PotentialReference<string | TemplateExpression>,
  idsToElements: Record<string, InstanceElement>,
  matchBrandSubdomain: (url: string) => InstanceElement | undefined,
): PotentialReference<string | TemplateExpression> => {
  if (typeof script.value === 'string') {
    return {
      value: extractDomainsAndFieldsFromScripts(idsToElements, matchBrandSubdomain, script.value),
      loc: script.loc,
    }
  }
  return {
    value: createTemplateExpression({
      parts: script.value.parts.flatMap(part => {
        if (typeof part === 'string') {
          const templatedString = extractDomainsAndFieldsFromScripts(idsToElements, matchBrandSubdomain, part)
          return typeof templatedString === 'string' ? templatedString : templatedString.parts
        }
        return part
      }),
    }),
    loc: script.loc,
  }
}

const javascriptReferencesByConfig = (
  scripts: PotentialReference<string>[],
  idsToElements: Record<string, InstanceElement>,
  matchBrandSubdomain: (url: string) => InstanceElement | undefined,
  javascriptReferenceLookupStrategy: Themes['referenceOptions']['javascriptReferenceLookupStrategy'],
): PotentialReference<string | TemplateExpression>[] => {
  if (javascriptReferenceLookupStrategy === undefined) {
    return scripts
  }
  return extractOrParseByStrategy(scripts, idsToElements, javascriptReferenceLookupStrategy).flatMap(script =>
    extractDomainsAndFieldsAfterStrategy(script, idsToElements, matchBrandSubdomain),
  )
}

export const createHandlebarTemplateExpression: TemplateEngineCreator = (
  content,
  { matchBrandSubdomain, idsToElements, enableMissingReferences },
  javascriptReferenceLookupStrategy,
) => {
  const handlebarReferences = parseHandlebarPotentialReferences(content, idsToElements)
  const { urls, scripts } = parseHtmlPotentialReferences(content, {
    matchBrandSubdomain,
    idsToElements,
    enableMissingReferences,
  })
  const javascriptReferences = javascriptReferencesByConfig(
    scripts,
    idsToElements,
    matchBrandSubdomain,
    javascriptReferenceLookupStrategy,
  )
  return mergeDistinctReferences(content, [...handlebarReferences, ...urls, ...javascriptReferences])
}

export const createHtmlTemplateExpression: TemplateEngineCreator = (
  content,
  { matchBrandSubdomain, idsToElements, enableMissingReferences },
  javascriptReferenceLookupStrategy,
) => {
  const { urls, scripts } = parseHtmlPotentialReferences(content, {
    matchBrandSubdomain,
    idsToElements,
    enableMissingReferences,
  })
  const javascriptReferences = javascriptReferencesByConfig(
    scripts,
    idsToElements,
    matchBrandSubdomain,
    javascriptReferenceLookupStrategy,
  )
  return mergeDistinctReferences(content, [...urls, ...javascriptReferences])
}

export const createJavascriptTemplateExpression: TemplateEngineCreator = (
  content,
  { matchBrandSubdomain, idsToElements },
  javascriptReferenceLookupStrategy,
) => {
  const javascriptReferences = javascriptReferencesByConfig(
    [{ value: content, loc: { start: 0, end: content.length } }],
    idsToElements,
    matchBrandSubdomain,
    javascriptReferenceLookupStrategy,
  )
  return mergeDistinctReferences(content, javascriptReferences)
}
