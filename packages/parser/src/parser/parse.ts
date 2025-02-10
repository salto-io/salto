/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { Value } from '@salto-io/adapter-api'
import isPromise from 'is-promise'
import { SourceRange as InternalSourceRange } from './internal/types'
import { Functions } from './functions'
import PeekableLexer from './internal/native/lexer'
import { parseBuffer, processParseError } from './internal/native/parse'
import { ParseError, ParseResult } from './types'
import { SourceMap } from './source_map'
import { ConsumerReturnType, ParseContext } from './internal/native/types'
import { consumeValue } from './internal/native/consumers/values'
import { unexpectedPromise } from './internal/native/errors'

export { parseTopLevelID } from './internal/native/helpers'

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

/**
 * Parses a content string to extract its value and any parsing errors.
 * It doesn't support values that are asynchronously parsed
 *
 * @param content The content string to parse.
 * @param functions An optional set of helper functions used during parsing.
 * @param filename An optional name of the file from which the content was read, used for error context.
 * @returns An object containing:
 *          - `value`: The parsed value of the content.
 *          - `errors`: A list of errors encountered during parsing.
 */

export const parseValue = ({
  content,
  functions = {},
  filename = '',
}: {
  content: string
  functions?: Functions
  filename?: string
}): {
  value: Value
  errors: ParseError[]
} => {
  const context: ParseContext = {
    calcSourceMap: false,
    filename,
    functions,
    lexer: new PeekableLexer(content),
    errors: [],
    listTypes: {},
    mapTypes: {},
    sourceMap: new SourceMap(),
    valuePromiseWatchers: [],
  }
  let result: ConsumerReturnType<Value> | undefined
  try {
    result = consumeValue(context)
  } catch (e) {
    processParseError(context, e)
  }
  if (context.valuePromiseWatchers.length > 0 || isPromise(result?.value)) {
    context.errors.push(
      unexpectedPromise({
        ...(result?.range ?? { start: { line: 0, col: 0, byte: 0 }, end: { line: 0, col: 0, byte: 0 } }),
        filename,
      }),
    )
  }
  return {
    value: result?.value,
    errors: context.errors,
  }
}
