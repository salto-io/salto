import * as nearley from 'nearley'
import { setFilename, convertMain } from './convertors'
import { HclParseError, HclParseReturn, ParsedHclBlock } from '../types'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const grammar = require('./hcl')

interface NearleyError {
  token: {
    type: string
    value: unknown
    text: string
    offset: number
    lineBreaks: number
    line: number
    col: number
  }
  offset: number
}

const convertParserError = (err: NearleyError, filename: string): HclParseError => ({
  severity: 1,
  summary: `Unexpected token: ${err.token.text}`,
  detail: `Unexpected token: ${err.token.text}`, // TODO - improve this
  subject: {
    filename,
    start: {
      col: err.token.col,
      line: err.token.line,
      byte: err.token.offset,
    },
    end: {
      col: err.token.col,
      line: err.token.line,
      byte: err.token.offset,
    },
  },
})

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
  try {
    setFilename(filename)
    const HclParser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar))
    HclParser.feed(src.toString())
    const blockItems = HclParser.finish()[0]
    if (blockItems !== undefined) {
      return {
        body: blockItems ? convertMain(blockItems) : createEmptyBody(src.toString(), filename),
        errors: [],
      }
    }
    return {
      body: createEmptyBody(src.toString(), filename),
      errors: [unexpectedEOFError(src.toString(), filename)],
    }
  } catch (err) {
    return { body: createEmptyBody(src.toString(), filename),
      errors: [convertParserError(err as NearleyError, filename)] }
  }
}
