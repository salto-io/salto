import * as nearley from 'nearley'
import { setFilename, NearleyError, convertMain } from './convertors'
import { HclParseError, HclParseReturn, ParsedHclBlock } from '../types'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const grammar = require('./hcl')

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
    const res = HclParser.finish()
    if (res.length === 0) {
      return {
        body: createEmptyBody(src.toString(), filename),
        errors: [unexpectedEOFError(src.toString(), filename)],
      }
    }
    return { body: convertMain(res[0]), errors: [] }
  } catch (err) {
    return { body: createEmptyBody(src.toString(), filename),
      errors: [convertParserError(err as NearleyError, filename)] }
  }
}
