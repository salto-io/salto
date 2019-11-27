import _ from 'lodash'
import { Value, isExpression } from 'adapter-api'
import { HclDumpReturn, DumpedHclBlock } from '../types'

const O_BLOCK = '{'
const C_BLOCK = '}'
const O_OBJ = '{'
const C_OBJ = '}'
const O_ARR = '['
const C_ARR = ']'
const IDENT = '  '

const ident = (lines: string[]): string[] => lines.map(l => `${IDENT}${l}`)

const dumpWord = (word: string): string => (/^\D/.test(word) ? word : `"${word}"`)

const addTrailingComma = (lines: string[]): string[] => {
  const lastLine = lines.pop()
  return [
    ...lines,
    `${lastLine},`,
  ]
}

const seperateByCommas = (items: string[][]): string[][] => {
  const lastItem = items.pop()
  return [
    ...items.map(itemLines => addTrailingComma(itemLines)),
    lastItem || [],
  ]
}

const dumpPrimitive = (prim: Value): string => JSON.stringify(prim)

const dumpObject = (obj: Value): string[] => {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const attrLines = _.flatten(seperateByCommas(_.toPairs(obj).map(dumpAttr)))
  return [
    O_OBJ,
    ...ident(attrLines),
    C_OBJ,
  ]
}

const dumpArray = (arr: Value): string[] => {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const itemLines = _.flatten(seperateByCommas(arr.map(dumpValue)))
  return [
    O_ARR,
    ...ident(itemLines),
    C_ARR,
  ]
}

// const dumpExpresion = (exp: Value): string[] => {
//   // TODO Still not supported.
//   return []
// }

const dumpValue = (value: Value): string[] => {
  if (_.isArray(value)) return dumpArray(value)
  if (_.isPlainObject(value)) return dumpObject(value)
  // if (isExpression(value)) return dumpExpresion(value)
  return [dumpPrimitive(value)]
}

const dumpAttr = (attr: [string, Value]): string[] => {
  const [key, value] = attr
  const valueLines = dumpValue(value)
  const defLine = `${dumpWord(key)} = ${valueLines.shift()}`
  const lastLine = valueLines.pop()
  return [
    defLine,
    ...ident(valueLines),
    lastLine,
  ].filter(_.isString)
}

const createBlockDefLine = (block: DumpedHclBlock): string => {
  const type = dumpWord(block.type)
  const labels = block.labels.map(dumpWord)
  return [type, ...labels, O_BLOCK].join(' ')
}

const dumpBlock = (block: DumpedHclBlock): string[] => {
  const defLine = createBlockDefLine(block)
  const blockLines = _(block.blocks).map(dumpBlock).flatten().value()
  const attributeLines = _(block.attrs).toPairs().map(dumpAttr).flatten()
    .value()
  const closeLine = C_BLOCK
  return [
    defLine,
    ...ident(blockLines),
    ...ident(attributeLines),
    closeLine,
  ]
}

export const dump = async (body: DumpedHclBlock): Promise<HclDumpReturn> => {
  const attributesLines = _(body.attrs).toPairs().map(dumpAttr).flatten()
    .value()
  const blockLines = _(body.blocks).map(dumpBlock).flatten().value()
  return [
    ...attributesLines,
    ...blockLines,
    '\n',
  ].join('\n')
}
