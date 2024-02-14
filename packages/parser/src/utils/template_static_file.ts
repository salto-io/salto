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
import _ from 'lodash'
import { dumpValue, MULTILINE_STRING_PREFIX, MULTILINE_STRING_SUFFIX } from '../parser/internal/dump'
import { unescapeMultilineMarker } from '../parser/internal/native/consumers/values'
import { createReferenceExpresion, unescapeTemplateMarker } from '../parser/internal/native/helpers'
import { IllegalReference } from '../parser'

const log = logger(module)

const isMultilineBuffer = (stringBuffer: string): boolean =>
  stringBuffer.startsWith(MULTILINE_STRING_PREFIX) && stringBuffer.endsWith(MULTILINE_STRING_SUFFIX)

const removeMultilineStringPrefixAndSuffix = (prim: string): string =>
  _.trimStart(_.trimEnd(prim, MULTILINE_STRING_SUFFIX), MULTILINE_STRING_PREFIX)


const returnDoubleTemplateMarkerEscaping = (prim: string): string => prim.replace(/\\\$\{/g, '\\\\${')


const splitByReferencesMarker = (stringBuffer: string): string[] => {
  const regex = /(?<!\\)\$\{[^}]+\}/g
  const parts: string[] = []
  let lastIndex = 0

  stringBuffer.replace(regex, (match, index) => {
    // Add the part of the string before the match
    parts.push(stringBuffer.slice(lastIndex, index))
    parts.push(match)
    lastIndex = index + match.length
    return match
  })

  // Add the remaining part of the string if any
  if (lastIndex < stringBuffer.length) {
    parts.push(stringBuffer.slice(lastIndex))
  }
  return parts
}

const createReferencesFromStringParts = (parts: string[]): TemplatePart[] => parts.map(part => {
  if (part.startsWith('${') && part.endsWith('}')) {
    // remove the ${ and }
    const refParts = part.split(/\${|}/)
    if (refParts.length !== 3) {
      // add log
      return part
    }
    const ref = createReferenceExpresion(refParts[1].replace(/\s+/g, ''))
    return ref instanceof IllegalReference ? part : ref
  }
  return part
})


const parseBufferToTemplateExpression = (buffer: Buffer): TemplateExpression => {
  const stringBuffer = buffer.toString()
  const removed = removeMultilineStringPrefixAndSuffix(stringBuffer)
  const finalString = isMultilineBuffer(stringBuffer)
    ? unescapeMultilineMarker(removed)
    : JSON.parse(returnDoubleTemplateMarkerEscaping(stringBuffer))
  const parts = createReferencesFromStringParts(splitByReferencesMarker(finalString))
  const unescapedTemplateMarkerParts = parts.map(part =>
    (isReferenceExpression(part) ? part : unescapeTemplateMarker(part)))

  return createTemplateExpression({ parts: unescapedTemplateMarkerParts })
}


export const templateExpressionToStaticFile = (expression: TemplateExpression, filepath: string): StaticFile => {
  const string = dumpValue(expression).toString()
  return new StaticFile({ filepath, content: Buffer.from(string), isTemplate: true })
}

export const staticFileToTemplateExpression = async (staticFile: StaticFile)
  : Promise<TemplateExpression | undefined> => {
  if (staticFile.isTemplate !== true) {
    return undefined
  }
  const content = await staticFile.getContent()
  if (content === undefined) {
    log.warn(`content is undefined for staticFile with path ${staticFile.filepath}`)
    return undefined // maybe return an empty template expression
  }
  return parseBufferToTemplateExpression(content)
}
