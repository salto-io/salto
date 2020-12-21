/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  SourceRange as InternalSourceRange,
} from './internal/types'
import { parseBufferAndFixErrors } from './internal/nearly/parse'
import {
  Functions,
} from './functions'
import PeekableLexer from './internal/native/lexer'
import { parseBuffer } from './internal/native/parse'
import { ParseResult } from './types'

export { parseElemID } from './internal/nearly/converter/elements'
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
export const parse = async (
  naclFile: Buffer,
  filename: string,
  functions: Functions = {},
): Promise<Required<ParseResult>> => {
  const srcString = naclFile.toString()
  return process.env.SALTO_USE_LEGACY_PARSER
    ? parseBufferAndFixErrors(srcString, filename, functions)
    : parseBuffer(srcString, filename, functions)
}

export type Token = {
  value: string
  type: string
  col: number
  line: number
}

// I don't return LexerToken because it would require the workspace package to
// add @types/moo to the dependencies (instead of dev dependencies)
export function *tokenizeContent(content: string): IterableIterator<Token> {
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
