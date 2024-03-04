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
import { isReferenceExpression, StaticFile, TemplateExpression, TemplatePart } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { escapeTemplateMarker } from '../parser/internal/utils'
import { createReferenceExpresion, unescapeTemplateMarker } from '../parser/internal/native/helpers'
import { IllegalReference } from '../parser'
import { REFERENCE_PART } from '../parser/internal/native/lexer'

const log = logger(module)

type PartWithReferenceIndicator = { isReference: boolean; part: string }

const splitByReferencesMarker = (stringToParse: string): PartWithReferenceIndicator[] => {
  const regex = new RegExp(`${REFERENCE_PART}`, 'g')
  const parts: PartWithReferenceIndicator[] = []
  let lastIndex = 0

  stringToParse.replace(regex, (match, index) => {
    // Add the part of the string before the match
    parts.push({ isReference: false, part: stringToParse.slice(lastIndex, index) })
    parts.push({ isReference: true, part: match })
    lastIndex = index + match.length
    return match
  })

  // Add the remaining part of the string if any
  if (lastIndex < stringToParse.length) {
    parts.push({ isReference: false, part: stringToParse.slice(lastIndex) })
  }
  return parts
}

const createReferencesFromStringParts = (parts: PartWithReferenceIndicator[]): TemplatePart[] =>
  parts.map(part => {
    if (part.isReference) {
      // remove the ${ and }
      const refParts = part.part.split(/\${|}/)
      if (refParts.length !== 3) {
        log.warn(`refParts is invalid, received ${refParts.toString()}`)
        return part.part
      }
      const ref = createReferenceExpresion(refParts[1].trim())
      return ref instanceof IllegalReference ? part.part : ref
    }
    return part.part
  })

const parseBufferToTemplateExpression = (buffer: Buffer): TemplateExpression => {
  const parts = createReferencesFromStringParts(splitByReferencesMarker(buffer.toString()))
  const unescapedTemplateMarkerParts = parts.map(part =>
    isReferenceExpression(part) ? part : unescapeTemplateMarker(part),
  )

  return createTemplateExpression({ parts: unescapedTemplateMarkerParts })
}

export const templateExpressionToStaticFile = (expression: TemplateExpression, filepath: string): StaticFile => {
  const string = expression.parts
    .map(part => (isReferenceExpression(part) ? `\${ ${[part.elemID.getFullName()]} }` : escapeTemplateMarker(part)))
    .join('')
  return new StaticFile({ filepath, content: Buffer.from(string), isTemplate: true, encoding: 'utf8' })
}

export const staticFileToTemplateExpression = async (
  staticFile: StaticFile,
): Promise<TemplateExpression | undefined> => {
  if (staticFile.isTemplate !== true) {
    return undefined
  }
  const content = await staticFile.getContent()
  if (content === undefined) {
    log.warn(`content is undefined for staticFile with path ${staticFile.filepath}`)
    return undefined
  }
  return parseBufferToTemplateExpression(content)
}
