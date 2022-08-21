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
import { Element } from '@salto-io/adapter-api'
import { flattenElementStr } from '@salto-io/adapter-utils'
import { ParseResult } from '../../types'
import { Keywords } from '../../language'
import { Functions } from '../../functions'
import Lexer, { TOKEN_TYPES, NoSuchElementError, UnresolvedMergeConflictError } from './lexer'
import { SourceMap } from '../../source_map'
import { contentMergeConflict, invalidStringChar, unexpectedEndOfFile } from './errors'
import { ParseContext } from './types'
import { replaceValuePromises, positionAtStart } from './helpers'
import { consumeVariableBlock, consumeElement } from './consumers/top_level'

const isVariableDef = (context: ParseContext): boolean => (
  context.lexer.peek()?.type === TOKEN_TYPES.WORD
  && context.lexer.peek()?.value === Keywords.VARIABLES_DEFINITION
)

export async function parseBuffer(
  content: string,
  filename: string,
  functions: Functions,
  calcSourceMap: true,
): Promise<Required<ParseResult>>
export async function parseBuffer(
  content: string,
  filename: string,
  functions: Functions,
  calcSourceMap: boolean,
): Promise<ParseResult>

export async function parseBuffer(
  content: string,
  filename: string,
  functions: Functions,
  calcSourceMap: boolean,
): Promise<ParseResult> {
  const context: ParseContext = {
    calcSourceMap,
    filename,
    functions,
    lexer: new Lexer(content),
    errors: [],
    listTypes: {},
    mapTypes: {},
    sourceMap: new SourceMap(),
    valuePromiseWatchers: [],
  }
  const elements: Element[] = []
  try {
    while (context.lexer.peek()) {
      if (isVariableDef(context)) {
        const consumedVariables = consumeVariableBlock(context)
        elements.push(...consumedVariables.value)
      // Everything else is an element (we don't support top level attributes)
      // if its not an element - consume element will create the errors.
      } else {
        const consumedElement = consumeElement(context)
        if (consumedElement.value) {
          elements.push(consumedElement.value)
        }
      }
    }
  } catch (e) {
    // Catch the EOF error that is thrown by the lexer if the next function
    // is called after all of the token were processed. This error is thrown
    // since it should interrupt the flow of the code.
    if (e instanceof NoSuchElementError && e.lastValidToken) {
      const pos = positionAtStart(e.lastValidToken)
      context.errors.push(unexpectedEndOfFile({ start: pos, end: pos, filename }))
    // Catch the beginning string of a merge conflict and verify it by catching
    // the middle and ending strings. In case they aren't found, raise an invalid
    // sting error.
    } else if (e instanceof UnresolvedMergeConflictError && e.lastValidToken) {
      const pos = positionAtStart(e.lastValidToken)
      try {
        // Having the beginning string of a merge conflict, Salto verifies if the
        // middle and end strings exist as well. In case they aren't exist salto
        // raises an invalid error token, without covering the rest of the file.
        // This is a trade off for creating a regex merge conflict token, which
        // seems to work slowly.
        context.lexer.recover([TOKEN_TYPES.MERGE_CONFLICT_MID], true)
        context.lexer.recover([TOKEN_TYPES.MERGE_CONFLICT_END], true)
        context.errors = [contentMergeConflict({ start: pos, end: pos, filename })]
      } catch {
        context.errors.push(invalidStringChar(
          { start: pos, end: pos, filename },
          TOKEN_TYPES.MERGE_CONFLICT,
        ))
      }
    }
  }

  // Adding the list types so they will be accesible during merge.
  elements.push(...Object.values(context.listTypes), ...Object.values(context.mapTypes))
  await replaceValuePromises(context.valuePromiseWatchers)
  return {
    // Elements string are flatten to solve a memory leak
    elements: elements.map(flattenElementStr),
    errors: context.errors,
    sourceMap: calcSourceMap ? context.sourceMap : undefined,
  }
}
