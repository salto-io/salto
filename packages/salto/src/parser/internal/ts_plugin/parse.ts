import * as nearley from 'nearley'
import _ from 'lodash'
import { setFilename, convertMain } from './converters'
import { HclParseError, HclParseReturn, ParsedHclBlock } from '../types'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const grammar = require('./hcl')
const WILDCARD = '####'
const MAX_ERRORS = 20
interface NearleyError {
  token: {
    type: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any
    text: string
    offset: number
    lineBreaks: number
    line: number
    col: number
  }
  offset: number
  message: string
}

const getStateSymbol = (state: nearley.LexerState) : string => {
  const symbol = state.rule.symbols[state.dot]
  const type = typeof symbol;
  if (type === "string") {
      return symbol;
  } else if (type === "object" && symbol.literal) {
      return JSON.stringify(symbol.literal);
  } else if (type === "object" && symbol instanceof RegExp) {
      return 'character matching ' + symbol;
  } else if (type === "object" && symbol.type) {
      return symbol.type + ' token';
  } else {
      return JSON.stringify(symbol)
  }
}

const getExpectedSymbols = (hclParser: nearley.Parser): string[] => {
  const printableToken = (token: string): boolean => {
    const allowed = ['value', 'newline', 'whitespace', 'word', ]
    return allowed.indexOf(token) >= 0
  }
  const table = _.get(hclParser, 'table')
  const lastColumnIndex = table.length - 2;
  const lastColumn = table[lastColumnIndex];
  return lastColumn.states.map(getStateSymbol).filter(printableToken)
}
const convertParserError = (err: NearleyError, filename: string, hclParser: nearley.Parser): HclParseError => {
  const expected = getExpectedSymbols(hclParser)
  const token = err.token;
  return {
    severity: 1,
    summary:  `Unexpected ${token}`,
    detail: `Expected ${
      expected.length > 1 
      ? `${expected.slice(0, -1).join(', ')} or ${expected[expected.length -1]}`
      : expected[0]
    } token but found: ${token} instead.`,
    subject: {
      filename,
      start: { col: token.col, line: token.line, byte: token.offset },
      end: { col: token.col, line: token.line, byte: token.offset },
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
    severity: 1,
    summary: 'Unexpected end of file',
    detail: 'Unexpected end of file', // TODO - improve this
    subject: {
      filename,
      start: pos,
      end: pos,
    },
  }
}

export const parse = (src: Buffer, filename: string): HclParseReturn => {
  const hclParser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
  setFilename(filename)
  const words = src.toString().split(' ').map(w => `${w} `)
  const errors = []
  let savedState = hclParser.save()
  for (const word of words) {
    try {
      hclParser.feed(word)
    }
    catch(e) {
      errors.push(convertParserError(e as NearleyError, filename, hclParser))
      if (errors.length > MAX_ERRORS) break
      hclParser.restore(savedState)
      hclParser.feed(WILDCARD)
      hclParser.feed(word)
    }
    savedState = hclParser.save()
  }
  const blockItems = hclParser.finish()[0]
  if (blockItems !== undefined) {
    return {
      body: blockItems ? convertMain(blockItems) : createEmptyBody(src.toString(), filename),
      errors,
    }
  }
  return {
    body: createEmptyBody(src.toString(), filename),
    errors: [unexpectedEOFError(src.toString(), filename)],
  }
}
