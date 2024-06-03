/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { InstanceElement, TemplateExpression } from '@salto-io/adapter-api'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { Themes } from '../../config'
import { parseHandlebarPotentialReferences } from './handlebar_parser'
import { parseHtmlPotentialReferences } from './html_parser'
import { extractDomainsAndFieldsFromScripts, extractNumericValueIdsFromScripts } from './javascript_extractor'
import { parsePotentialReferencesByPrefix } from './javascript_parser'
import { PotentialReference, TemplateEngineOptions } from './types'

export type TemplateEngineCreator = (
  content: string,
  options: TemplateEngineOptions,
  javascriptReferenceLookupStrategy: Themes['referenceOptions']['javascriptReferenceLookupStrategy'],
) => string | TemplateExpression

const extractOrParseByStrategy = (
  scripts: PotentialReference<string>[],
  idsToElements: Record<string, InstanceElement>,
  javascriptReferenceLookupStrategy: Themes['referenceOptions']['javascriptReferenceLookupStrategy'],
): PotentialReference<string | TemplateExpression>[] => {
  if (javascriptReferenceLookupStrategy?.strategy === 'numericValues') {
    return scripts.map(script => ({
      value: extractNumericValueIdsFromScripts(
        idsToElements,
        script.value,
        javascriptReferenceLookupStrategy.minimumDigitAmount,
      ),
      loc: script.loc,
    }))
  }
  if (javascriptReferenceLookupStrategy?.strategy === 'varNamePrefix') {
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

const mergeDistinctReferences = (
  content: string,
  references: PotentialReference<string | TemplateExpression>[],
): string | TemplateExpression => {
  const sortedReferences = references.sort((a, b) => a.loc.start - b.loc.start)
  const mergedReferences: (string | TemplateExpression)[] = []
  let lastEnd = 0
  sortedReferences.forEach(reference => {
    if (reference.loc.start > lastEnd) {
      mergedReferences.push(content.slice(lastEnd, reference.loc.start))
    }
    mergedReferences.push(reference.value)
    lastEnd = reference.loc.end
  })
  if (lastEnd < content.length) {
    mergedReferences.push(content.slice(lastEnd))
  }
  const templateParts = mergedReferences.flatMap(part => (typeof part === 'string' ? part : part.parts))
  const templateExpression = createTemplateExpression({
    parts: templateParts,
  })
  return templateExpression.parts.every(part => typeof part === 'string')
    ? templateExpression.parts.join('')
    : templateExpression
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
