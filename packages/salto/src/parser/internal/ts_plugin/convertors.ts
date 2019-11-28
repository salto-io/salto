import _ from 'lodash'
import { ParsedHclBlock, HclAttribute, HclExpression, SourceRange } from '../types'


let currentFilename: string

export interface NearleyError {
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
}

type HCLToken = ParsedHclBlock | HclAttribute | HclExpression

interface LexerToken {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
  text: string
  line: number
  lineBreaks: number
  col: number
  offset: number
}

type Token = HCLToken | LexerToken

const isLexerToken = (token: Token): token is LexerToken => 'value' in token
    && 'text' in token
    && 'line' in token
    && 'col' in token
    && 'offset' in token

export const setFilename = (filename: string): void => {
  currentFilename = filename
}

export const createSourceRange = (st: Token, et: Token): SourceRange => {
  const start = isLexerToken(st)
    ? { line: st.line, col: st.col, byte: st.offset }
    : (st as HCLToken).source.start
  const end = isLexerToken(et)
    ? {
      line: et.line + et.lineBreaks,
      col: et.lineBreaks === 0 ? et.col + et.text.length : et.text.length - et.text.lastIndexOf('\n'),
      byte: et.offset + et.text.length,
    }
    : (et as HCLToken).source.end
  return { filename: currentFilename, start, end }
}

const convertBlockItems = (
  blockItems: HclExpression[]
): Pick<ParsedHclBlock, 'attrs' | 'blocks'> => {
  const attrs: Record<string, HclAttribute> = {}
  const blocks: ParsedHclBlock[] = []
  blockItems.forEach(item => {
    if ('type' in item && item.type === 'map') {
      const key = item.expressions[0].value
      const value = item.expressions[1]
      if (attrs[key]) throw new Error('duplicated attribure name')
      attrs[key] = {
        expressions: [value],
        source: item.source,
      }
    }
    if ('blocks' in item) {
      blocks.push(item)
    }
  })
  return { attrs, blocks }
}

export const convertMain = (
  blockItems: HclExpression[]
): Pick<ParsedHclBlock, 'attrs' | 'blocks'> => ({
  ...convertBlockItems(blockItems),
})

export const convertBlock = (
  words: Token[],
  blockItems: HclExpression[],
  cb: LexerToken
): ParsedHclBlock => {
  const [type, ...labels] = words.map(l => {
    if (isLexerToken(l)) return l.text
    const exp = l as HclExpression
    if (exp.type === 'template' && exp.expressions.length === 1) {
      return exp.expressions[0].value
    }
    throw new Error('invalid block definition')
  })
  return {
    ...convertBlockItems(blockItems),
    type,
    labels,
    source: createSourceRange(words[0], cb),
  }
}

export const convertArray = (
  ob: LexerToken, arrayItems:
    HclExpression[], cb: LexerToken
): HclExpression => {
  if (arrayItems === undefined) {
    throw new Error(JSON.stringify(ob))
  }
  return {
    type: 'list',
    expressions: arrayItems,
    source: createSourceRange(ob, cb),
  }
}

export const convertObject = (
  ob: LexerToken,
  attrs: HclExpression[],
  cb: LexerToken
): HclExpression => {
  const res: Record<string, HclExpression[]> = {}
  attrs.forEach(attr => {
    const key = attr.expressions[0]
    if (res[key.value] !== undefined) {
      throw new Error('Oy we have this key')
    }
    res[key.value] = attr.expressions
  })
  return {
    type: 'map',
    expressions: _(res).values().flatten().value(), // TODO Is this correct?
    source: createSourceRange(ob, cb),
  }
}

export const convertReference = (reference: LexerToken): HclExpression => ({
  type: 'reference',
  value: reference.text.split('.'),
  expressions: [],
  source: createSourceRange(reference, reference),
})

export const convertString = (
  oq: LexerToken,
  contentTokens: LexerToken[],
  cq: LexerToken
): HclExpression => ({
  type: 'template',
  expressions: contentTokens.map(t => (t.type === 'reference'
    ? convertReference(t)
    : {
      type: 'literal',
      value: t && t.text ? JSON.parse(`"${t.text}"`) : '',
      expressions: [],
      source: createSourceRange(t, t),
    })),
  source: createSourceRange(oq, cq),
})

export const convertMultilineString = (
  mlStart: LexerToken,
  contentTokens: LexerToken[],
  mlEnd: LexerToken
): HclExpression => ({
  type: 'template',
  expressions: contentTokens.map(t => (t.type === 'reference'
    ? convertReference(t)
    : {
      type: 'literal',
      value: JSON.parse(`"${t.text}"`),
      expressions: [],
      source: createSourceRange(t, t),
    } as HclExpression)),
  source: createSourceRange(mlStart, mlEnd),
})

export const convertBoolean = (bool: LexerToken): HclExpression => ({
  type: 'literal',
  value: bool.text === 'true',
  expressions: [],
  source: createSourceRange(bool, bool), // LOL. This was unindented. Honest.
})

export const convertNumber = (num: LexerToken): HclExpression => ({
  type: 'literal',
  value: parseFloat(num.text),
  expressions: [],
  source: createSourceRange(num, num),
})

const convertAttrKey = (key: LexerToken): HclExpression => ({
  type: 'literal',
  value: key.type === 'string' ? JSON.parse(key.text) : key.text,
  expressions: [],
  source: createSourceRange(key, key),
})

export const convertAttr = (key: LexerToken, value: HclExpression): HclExpression => ({
  type: 'map',
  expressions: [convertAttrKey(key), value],
  value,
  source: createSourceRange(key, value),
})
