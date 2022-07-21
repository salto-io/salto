/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { Values, TemplateExpression, isReferenceExpression, isTemplateExpression, TemplatePart, ReferenceExpression } from '@salto-io/adapter-api'
import { strings } from '@salto-io/lowerdash'
import _ from 'lodash'

const { continuousSplit } = strings

export type TemplateContainer = {
    values: Values[]
    fieldName: string
  }

export const prepareTemplateForDeploy = (template: TemplateExpression,
  prepRef: (part: ReferenceExpression) => TemplatePart): TemplateExpression =>
  new TemplateExpression({
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
  const replaceIfTemplate = (value: unknown): unknown =>
    (isTemplateExpression(value) ? handleTemplateValue(value) : value)
  container.values.forEach(value => {
    if (Array.isArray(value[fieldName])) {
      value[fieldName] = value[fieldName].map(replaceIfTemplate)
    } else {
      value[fieldName] = replaceIfTemplate(value[fieldName])
    }
  })
}

export const resolveTemplates = (
  container: TemplateContainer,
  deployTemplateMapping: Record<string, TemplateExpression>
): void => {
  const { fieldName } = container
  container.values.forEach(value => {
    const val = value[fieldName]
    value[fieldName] = deployTemplateMapping[val] ?? val
  })
}

export const extractTemplate = (
  formula: string,
  regexes: RegExp[],
  extractionFunc: (expression: string) => TemplatePart | TemplatePart[],
): TemplateExpression | string => {
  // The second part is a split that separates the now-marked ids, so they could be replaced
  // with ReferenceExpression in the loop code.
  // we continuously split the expression to find all kinds of potential references
  const templateParts = continuousSplit(formula, regexes)
    .flatMap(extractionFunc).filter(v => !_.isEmpty(v))
  if (templateParts.every(_.isString)) {
    return templateParts.join('')
  }
  return new TemplateExpression({ parts: templateParts })
}
