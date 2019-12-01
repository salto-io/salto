import _ from 'lodash'
import { Value } from 'adapter-api'
import { HclDumpReturn, DumpedHclBlock } from '../types'

const O_BLOCK = '{'
const C_BLOCK = '}'
const O_OBJ = '{'
const C_OBJ = '}'
const O_ARR = '['
const C_ARR = ']'
const IDENT = '  '

const ident = (lines: string[]): string[] => {
  // Using the good ol` for i syntax here for memory effeciancy.
  // (to avoid creating new copies of the lines)
  if (lines.length <= 2) return lines
  for (let i = 0; i < lines.length; i += 1) {
    if (i > 0 && i < lines.length - 1) {
      lines[i] = `${IDENT}${lines[i]}`
    }
  }
  return lines
}

const dumpWord = (word: string): string => (/^\D/.test(word) ? word : `"${word}"`)

const seperateByCommas = (items: string[][]): string[][] => {
  items.forEach(itemLines => {
    itemLines[itemLines.length - 1] += ','
  })
  return items
}

const dumpPrimitive = (prim: Value): string => JSON.stringify(prim)

const dumpObject = (obj: Value): string[] => {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const attributes = seperateByCommas(_.toPairs(obj).map(dumpAttr))
  const res = [O_OBJ]
  attributes.forEach(attrLines => attrLines.forEach((l: string) => res.push(l)))
  res.push(C_OBJ)
  return ident(res)
}

const dumpArray = (arr: Value): string[] => {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const items = seperateByCommas(arr.map(dumpValue))
  const res = [O_ARR]
  items.forEach(itemLines => itemLines.forEach(l => res.push(l)))
  res.push(C_ARR)
  return ident(res)
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
  valueLines[0] = `${dumpWord(key)} = ${valueLines[0]}`
  return ident(valueLines)
}

const createBlockDefLine = (block: DumpedHclBlock): string => {
  const type = dumpWord(block.type)
  const labels = block.labels.map(dumpWord)
  return [type, ...labels, O_BLOCK].join(' ')
}

const dumpBlock = (block: DumpedHclBlock): string[] => {
  const defLine = createBlockDefLine(block)
  const blocks = block.blocks.map(dumpBlock)
  const attributes = _(block.attrs).toPairs().map(dumpAttr).value()
  const res = [defLine]
  blocks.forEach(blockLines => blockLines.forEach(b => res.push(b)))
  attributes.forEach(attributeLines => attributeLines.forEach(a => res.push(a)))
  res.push(C_BLOCK)
  return ident(res)
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
