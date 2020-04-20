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
import { HclParseError, HclParseReturn, ParsedHclBlock, SourcePos, isSourceRange, HclExpression, SourceRange } from './types'
import { WILDCARD } from './lexer'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const grammar = require('./hcl')

const SURROUNDING_LINE_CONTEXT = 2
const MAX_FILE_ERRORS = 20
// This value was set for the longest minimal length of an empty non-literal
// in the grammer.
const MAX_ALLOWED_DYNAMIC_TOKEN = 3
const getStatePrintToken = (state: nearley.LexerState): string | undefined => {
  const symbol = state.rule.symbols[state.dot]
  return (typeof symbol === 'object' && symbol.type && symbol.type !== 'wildcard')
    ? symbol.type
    : undefined
}

const lineToOffset = (src: string, line: number, untilEol = false): number => src
  .split('\n')
  .slice(0, untilEol ? line : line - 1)
  .map(l => l.length + 1) // Add 1 for the \n removed
  .reduce((sum, current) => sum + current, 0)

const getContextSourceRange = (filename: string, line: number, src: string): SourceRange => ({
  start: {
    line: line - SURROUNDING_LINE_CONTEXT,
    col: 0,
    byte: lineToOffset(src, line - SURROUNDING_LINE_CONTEXT),
  },
  end: {
    line: line + SURROUNDING_LINE_CONTEXT,
    col: lineToOffset(src, line + SURROUNDING_LINE_CONTEXT, true)
      - lineToOffset(src, line + SURROUNDING_LINE_CONTEXT),
    byte: lineToOffset(src, line + SURROUNDING_LINE_CONTEXT, true) - 1, // Remove the last \n
  },
  filename,
})

const EmptyContext = (): SourceRange => (
  { start: { line: 0, col: 0, byte: 0 }, end: { line: 0, col: 0, byte: 0 }, filename: '' }
)

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
  const errorLength = text.length
  const errorOffset = token.offset ?? 0
  const summary = err.message.includes('\n') ? `Unexpected token: ${
    text === '\n' ? '\\n' : text}` : err.message
  const start = token?.source?.start
    ?? { line: token.line,
      col: token.col,
      byte: errorOffset } as unknown as SourcePos
  const end = token?.source?.end
    ?? { line: token.line,
      col: token.col + errorLength,
      byte: errorOffset + errorLength } as unknown as SourcePos

  return {
    summary,
    detail: `Expected ${expectedMsg} token but found: ${text === '\n' ? '\\n' : text} instead.`,
    subject: {
      filename,
      start,
      end,
    },
    context: EmptyContext(), // Will be filled later in flow with unpatched source for context
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
    context: { filename, start: pos, end: pos },
  }
}

const addLineOffset = (pos: SourcePos, wildcardPosition: SourcePos): SourcePos => (
  pos.line === wildcardPosition.line && pos.col > wildcardPosition.col
    ? { line: pos.line, col: pos.col - WILDCARD.length, byte: pos.byte - WILDCARD.length }
    : pos
)

const restoreOrigBlockRanges = (
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

const hasFatalError = (src: string): boolean => src.includes(
  _.repeat(WILDCARD, MAX_ALLOWED_DYNAMIC_TOKEN)
)

export const parseBuffer = (
  src: string,
  filename: string,
  prevErrors: HclParseError[] = []
): [string, HclExpression[], HclParseError[]] => {
  const hclParser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
  let fixedBuffer = src
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
    if (prevErrors.length < MAX_FILE_ERRORS && !hasFatalError(src)) {
      // Adding the wildcard token to bypass the error and give the parser another change
      fixedBuffer = [
        src.slice(0, parserError.subject.start.byte),
        WILDCARD,
        src.slice(parserError.subject.start.byte),
      ].join('')
      setErrorRecoveryMode() // Allows the wildcard token to be parsed from now on in this file

      const [finalFixedBuffer, blockItems, errors] = parseBuffer(
        fixedBuffer,
        filename,
        [...prevErrors, parserError]
      )
      return [finalFixedBuffer,
        restoreOrigBlockRanges(blockItems, parserError.subject.start), errors]
    }
    return [fixedBuffer, [], [...prevErrors, parserError]]
  }
  const blockItems = hclParser.finish()[0]
  return [fixedBuffer, blockItems, prevErrors]
}

const isWildcardToken = (error: HclParseError): boolean => error.summary.includes(WILDCARD)

// This function removes all errors that are generated because of wildcard use
const filterErrors = (errors: HclParseError[], src: string): HclParseError[] => {
  if (errors === []) {
    return errors
  }

  let prevError = errors[0]
  return errors
    .filter(error => !isWildcardToken(error))
    .filter(error => {
      if (src.slice(prevError.subject.start.byte, error.subject.start.byte) === WILDCARD) {
        prevError = error
        return false
      }
      prevError = error
      return true
    })
}

const generateErrorContext = (src: string, error: HclParseError): HclParseError => {
  error.context = getContextSourceRange(error.subject.filename, error.subject.start.line, src)
  return error
}

const subtractWildcardOffset = (pos: SourcePos, amountWildcards: number): SourcePos => (
  { line: pos.line, col: pos.col, byte: pos.byte - amountWildcards * WILDCARD.length })

const calculateAmountWildcards = (patchedSrc: string, error: HclParseError): number => {
  let sum = 0
  return patchedSrc
    .split(WILDCARD)
    .map(value => value.length + WILDCARD.length)
    .map(value => {
      sum += value
      return sum
    }) // Until Here produces an array with the indexes of wildcards
    .reduce((amountWildcards, current) =>
      (current < error.subject.start.byte ? amountWildcards + 1 : amountWildcards), 0)
}

const restoreErrorOrigRanges = (patchedSrc: string, error: HclParseError): HclParseError => {
  const amountWildcardsBefore = calculateAmountWildcards(patchedSrc, error)
  error.subject.start = subtractWildcardOffset(
    error.subject.start, amountWildcardsBefore
  )
  error.subject.end = subtractWildcardOffset(
    error.subject.end, amountWildcardsBefore
  )
  return error
}

const recalibrateErrors = (
  errors: HclParseError[], patchedSrc: string, src: string
): HclParseError[] => filterErrors(errors, patchedSrc)
  .map(error => generateErrorContext(src, error))
  .map(error => restoreErrorOrigRanges(patchedSrc, error))

export const parse = (src: Buffer, filename: string): HclParseReturn => {
  startParse(filename)
  const srcString = src.toString()
  const [patchedSrc, blockItems, errors] = parseBuffer(srcString, filename)
  if (blockItems !== undefined) {
    return {
      body: convertMain(blockItems),
      errors: recalibrateErrors(errors, patchedSrc, srcString),
    }
  }
  return {
    body: createEmptyBody(srcString, filename),
    errors: [unexpectedEOFError(srcString, filename)],
  }
}
