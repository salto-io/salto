import * as nearley from 'nearley'
import _ from 'lodash'
import { setFilename, convertMain } from './converters'
import { HclParseError, HclParseReturn, ParsedHclBlock } from '../types'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const grammar = require('./hcl')

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

const convertParserError = (err: NearleyError, filename: string, hclParser: nearley.Parser): HclParseError => {
  const table = _.get(hclParser, 'table')
  console.log(table[table.length - 2].wants['blockLabels$ebnf$1'][1].rule)
  const [key, want] = _(table[table.length - 2].wants)
    .toPairs()
    .filter(([v, w]) => v.indexOf('$') === -1  && w[0].rule.name.indexOf('$') === -1)
    .sortBy(([_v, w]) => -w[0].dot )
    .value()[0]
  const rule = want[0].rule
  const token = err.token;
  return {
    severity: 1,
    summary:  `Unexpected ${rule.name}`,
    detail: `Expected a ${key} token but found ${token} instead.`,
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
  try {
    setFilename(filename)
    hclParser.feed(src.toString())
    const blockItems = hclParser.finish()[0]
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
    //const table = _.get(hclParser, 'table')
    //const wants = table[table.length - 2].wants
    //console.log(table[table.length - 2].wants)
    return { body: createEmptyBody(src.toString(), filename),
      errors: [convertParserError(err as NearleyError, filename, hclParser)] }
  }
}
