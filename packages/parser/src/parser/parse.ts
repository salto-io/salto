/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Value } from '@salto-io/adapter-api'
import { SourceRange as InternalSourceRange } from './internal/types'
import { Functions } from './functions'
import PeekableLexer from './internal/native/lexer'
import { parseBuffer } from './internal/native/parse'
import { ParseError, ParseResult } from './types'
import { SourceMap } from './source_map'
import { ParseContext } from './internal/native/types'
import { consumeValue } from './internal/native/consumers/values'

export { parseTopLevelID } from './internal/native/helpers'
export { IllegalReference } from './internal/types'

const log = logger(module)

// Re-export these types because we do not want code outside the parser to import hcl
export type SourceRange = InternalSourceRange

/**
 * Parse a Nacl file
 *
 * @param naclFile A buffer the contains the Nacl file to parse
 * @param filename The name of the file from which the Nacl file was read
 * @param functions
 * @returns elements: Type elements found in the Nacl file
 *          errors: Errors encountered during parsing
 */
export async function parse(
  naclFile: Buffer,
  filename: string,
  functions?: Functions,
  calcSourceMap?: true,
): Promise<Required<ParseResult>>
export async function parse(
  naclFile: Buffer,
  filename: string,
  functions: Functions,
  calcSourceMap: boolean,
): Promise<ParseResult>

export async function parse(
  naclFile: Buffer,
  filename: string,
  functions: Functions = {},
  calcSourceMap = true,
): Promise<ParseResult> {
  const srcString = naclFile.toString()
  return parseBuffer(srcString, filename, functions, calcSourceMap)
}

export type Token = {
  value: string
  type: string
  col: number
  line: number
}

// I don't return LexerToken because it would require the workspace package to
// add @types/moo to the dependencies (instead of dev dependencies)
export function* tokenizeContent(content: string): IterableIterator<Token> {
  const lexer = new PeekableLexer(content)
  try {
    while (lexer.peek()) {
      const token = lexer.next()
      yield _.pick(token, ['value', 'type', 'col', 'line'])
    }
  } catch (e) {
    log.error('Error occured while getting token: %o', e)
  }
}

export const parseValue = (
  content: string,
  functions?: Functions,
): {
  value: Value
  errors: ParseError[]
} => {
  const context: ParseContext = {
    calcSourceMap: false,
    filename: 'unknown',
    functions: functions ?? {},
    lexer: new PeekableLexer(content),
    errors: [],
    listTypes: {},
    mapTypes: {},
    sourceMap: new SourceMap(),
    valuePromiseWatchers: [],
  }
  const result = consumeValue(context)
  if (context.valuePromiseWatchers.length > 0) {
    throw new Error('Unexpected promise')
  }
  return {
    value: result.value,
    errors: context.errors,
  }
}
