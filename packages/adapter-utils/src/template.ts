/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  Values,
  TemplateExpression,
  isReferenceExpression,
  isTemplateExpression,
  TemplatePart,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { strings } from '@salto-io/lowerdash'
import _ from 'lodash'

const { continuousSplit } = strings

export type TemplateContainer = {
  values: Values[]
  fieldName: string
}

export type TemplateExtractionFunc = (expression: string) => TemplatePart | TemplatePart[]

export const compactTemplateParts = (parts: TemplatePart[]): TemplatePart[] => {
  let tempString: string[] = []
  const compactedParts: TemplatePart[] = []
  parts.forEach(part => {
    if (_.isString(part)) {
      tempString.push(part)
    } else {
      if (tempString.length > 0) {
        compactedParts.push(tempString.join(''))
      }
      tempString = []
      compactedParts.push(part)
    }
  })
  if (tempString.length > 0) {
    compactedParts.push(tempString.join(''))
  }
  return compactedParts
}

export const compactTemplate = (template: TemplateExpression): TemplateExpression | string => {
  const parts = compactTemplateParts(template.parts)
  return parts.every(_.isString) ? parts.join() : new TemplateExpression({ parts })
}

export const createTemplateExpression = (parts: { parts: TemplatePart[] }): TemplateExpression => {
  const newParts = compactTemplateParts(parts.parts).filter(value => !_.isEmpty(value))
  return new TemplateExpression({ parts: newParts })
}

export const prepareTemplateForDeploy = (
  template: TemplateExpression,
  prepRef: (part: ReferenceExpression) => TemplatePart,
): TemplateExpression =>
  createTemplateExpression({
    parts: template.parts.map(part => (isReferenceExpression(part) ? prepRef(part) : part)),
  })

export const replaceTemplatesWithValues = (
  container: TemplateContainer,
  deployTemplateMapping: Record<string, TemplateExpression>,
  prepRef: (part: ReferenceExpression) => TemplatePart,
): void => {
  const { fieldName } = container
  const handleTemplateValue = (template: TemplateExpression): string => {
    const templateUsingIdField = prepareTemplateForDeploy(template, prepRef)
    deployTemplateMapping[templateUsingIdField.value] = template
    return templateUsingIdField.value
  }
  const replaceIfTemplate = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(replaceIfTemplate)
    }
    return isTemplateExpression(value) ? handleTemplateValue(value) : value
  }

  container.values.forEach(value => {
    value[fieldName] = replaceIfTemplate(value[fieldName])
  })
}

export const resolveTemplates = (
  container: TemplateContainer,
  deployTemplateMapping: Record<string, TemplateExpression>,
): void => {
  const resolveTemplate = (value: string): TemplateExpression | string => deployTemplateMapping[value] ?? value

  const resolveTemplateValue = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(resolveTemplateValue)
    }
    return _.isString(value) ? resolveTemplate(value) : value
  }

  const { fieldName } = container
  container.values.forEach(value => {
    const val = value[fieldName]
    value[fieldName] = Array.isArray(val) ? val.map(resolveTemplateValue) : resolveTemplate(val)
  })
}

export const extractTemplate = (
  formula: string,
  regexes: RegExp[],
  extractionFunc: TemplateExtractionFunc,
): TemplateExpression | string => {
  // The second part is a split that separates the now-marked ids, so they could be replaced
  // with ReferenceExpression in the loop code.
  // we continuously split the expression to find all kinds of potential references
  const templateParts = continuousSplit(formula, regexes)
    .flatMap(extractionFunc)
    .filter(v => !_.isEmpty(v))
  if (templateParts.every(_.isString)) {
    return templateParts.join('')
  }
  return createTemplateExpression({ parts: templateParts })
}

export type PotentialReference<T extends string | TemplateExpression> = {
  value: T
  loc: { start: number; end: number }
}

export const mergeDistinctReferences = (
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
