/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isReferenceExpression, StaticFile, TemplateExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import type { Token } from 'moo'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { escapeTemplateMarker, unescapeTemplateMarker } from '../parser/internal/utils'
import { stringLexerFromString } from '../parser/internal/native/lexer'
import { createStringValue } from '../parser/internal/native/consumers/values'
import { ParseError } from '../parser'

const log = logger(module)

const createSimpleStringValue = (_context: unknown, tokens: Required<Token>[], isNextPartReference?: boolean): string =>
  unescapeTemplateMarker(tokens.map(token => token.text).join(''), { isNextPartReference })

const parseBufferToTemplateExpression = (
  buffer: Buffer,
): { templateExpression: TemplateExpression; errors: string[] } => {
  const tokens = stringLexerFromString(buffer.toString())
  const context = { errors: [] as ParseError[], filename: '' }
  const value = createStringValue(context, tokens, createSimpleStringValue)
  const errors = context.errors.map(err => err.detailedMessage)
  if (typeof value === 'string') {
    log.trace('Template static file is a string. Creating a TemplateExpression from it')
    return {
      templateExpression: createTemplateExpression({ parts: [value] }),
      errors,
    }
  }
  return { templateExpression: value, errors }
}

export const templateExpressionToStaticFile = (expression: TemplateExpression, filepath: string): StaticFile => {
  const string = expression.parts
    .map((part, idx) =>
      isReferenceExpression(part)
        ? `\${ ${[part.elemID.getFullName()]} }`
        : escapeTemplateMarker(part, { isNextPartReference: isReferenceExpression(expression.parts[idx + 1]) }),
    )
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
  const { templateExpression, errors } = parseBufferToTemplateExpression(content)
  if (errors.length > 0) {
    log.warn(`Failed to parse template static file with path ${staticFile.filepath}. Errors: ${errors}`)
  }

  return templateExpression
}
