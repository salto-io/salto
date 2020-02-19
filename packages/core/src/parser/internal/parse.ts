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
import * as nearley from 'nearley'
import _ from 'lodash'
import { startParse, convertMain, NearleyError, setErrorRecoveryMode } from './converters'
import { HclParseError, HclParseReturn, ParsedHclBlock, SourcePos, isSourceRange, HclExpression } from './types'
import { WILDCARD } from './lexer'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const grammar = require('./hcl')


const MAX_FILE_ERRORS = 20

const getStatePrintToken = (state: nearley.LexerState): string | undefined => {
  const symbol = state.rule.symbols[state.dot]
  return (typeof symbol === 'object' && symbol.type && symbol.type !== 'wildcard')
    ? symbol.type
    : undefined
}

const convertParserError = (
  err: NearleyError,
  filename: string,
  lastColumn: nearley.LexerState,
): HclParseError => {
  const expected = lastColumn.states
    .map(getStatePrintToken)
    .filter((s: string | undefined) => s !== undefined)
  const { token } = err
  const expectedMsg = expected.length > 1
    ? `${expected.slice(0, -1).join(', ')} or ${expected[expected.length - 1]}`
    : expected[0]
  const text = token.value || ''
  const summary = err.message.includes('\n') ? `Unexpected token: ${text}` : err.message

  const start = token?.source?.start
    ?? { line: token.line, col: token.col, byte: token.offset } as unknown as SourcePos
  const end = token?.source?.start
    ?? { line: token.line, col: token.col, byte: token.offset } as unknown as SourcePos
  return {
    summary,
    detail: `Expected ${expectedMsg} token but found: ${text} instead.`,
    subject: {
      filename,
      start,
      end,
    },
  }
}

const createEmptyBody = (src: string, filename: string): ParsedHclBlock => ({
  attrs: {},
  blocks: [],
  type: '',
  labels: [],
  source: {
    filename,
    start: { col: 0, line: 0, byte: 0 },
    end: {
      col: src.length - src.lastIndexOf('\n'),
      line: src.split('\n').length,
      byte: src.length,
    },
  },
})

const unexpectedEOFError = (src: string, filename: string): HclParseError => {
  const pos = {
    col: src.length - src.lastIndexOf('\n'),
    line: src.split('\n').length,
    byte: src.length,
  }
  return {
    summary: 'Unexpected end of file',
    detail: 'Unexpected end of file', // TODO - improve this
    subject: {
      filename,
      start: pos,
      end: pos,
    },
  }
}

const addLineOffset = (pos: SourcePos, wildcardPosition: SourcePos): SourcePos => (
  pos.line === wildcardPosition.line && pos.col > wildcardPosition.col
    ? { line: pos.line, col: pos.col - WILDCARD.length, byte: pos.byte }
    : pos
)

const restoreOrigRanges = (
  blockItems: HclExpression[],
  wildcardPosition: SourcePos
): HclExpression[] => (
  _.cloneDeepWith(blockItems, value => ((isSourceRange(value))
    ? {
      start: addLineOffset(value.start, wildcardPosition),
      end: addLineOffset(value.end, wildcardPosition),
      filename: value.filename,
    }
    : undefined))
)

export const parseBuffer = (
  src: string,
  hclParser: nearley.Parser,
  filename: string,
  prevErrors: HclParseError[] = []
): [HclExpression[], HclParseError[]] => {
  try {
    hclParser.feed(src)
  } catch (err) {
    // The next two lines recover the state of the parser before the bad token was
    // entered - so we can understand what token was needed, and so we can recover
    // the parsing using the wildcard token. We use _.get to overide a type issue
    // with nearley (the table is not defined, but documented)
    const parseTable = _.get(hclParser, 'table')
    const lastColumn = parseTable[parseTable.length - 2]
    const parserError = convertParserError(err, filename, lastColumn)
    // The is equal check is here to make sure we won't get into a "recovery loop" which
    // is a condition in which the error recovery does not change the state.
    if (prevErrors.length < MAX_FILE_ERRORS) {
      // Restoring the state to before the error took place
      hclParser.restore(lastColumn)
      // Adding the wildcard token to bypass the error and give the parser another change
      const restOfBuffer = WILDCARD + src.slice(parserError.subject.start.byte)
      setErrorRecoveryMode() // Allows the wildcard token to be parsed from now on in this file
      const [blockItems, errors] = parseBuffer(
        restOfBuffer,
        hclParser,
        filename,
        [...prevErrors, parserError]
      )
      return [restoreOrigRanges(blockItems, parserError.subject.start), errors]
    }
    return [[], [...prevErrors, parserError]]
  }
  const blockItems = hclParser.finish()[0]
  return [blockItems, prevErrors]
}

export const parse = (src: Buffer, filename: string): HclParseReturn => {
  const hclParser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
  startParse(filename)
  const [blockItems, errors] = parseBuffer(src.toString(), hclParser, filename)
  if (blockItems !== undefined) {
    return {
      body: convertMain(blockItems),
      errors,
    }
  }
  return {
    body: createEmptyBody(src.toString(), filename),
    errors: [unexpectedEOFError(src.toString(), filename)],
  }
}
