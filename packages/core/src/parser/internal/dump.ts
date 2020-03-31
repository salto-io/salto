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
import _ from 'lodash'
import {
  Value, isExpression, ReferenceExpression,
  TemplateExpression,
} from '@salto-io/adapter-api'
import { DumpedHclBlock, DumpedHclBody } from './types'
import { isFunctionExpression } from './functions'
import { rules } from './lexer'

const O_BLOCK = '{'
const C_BLOCK = '}'
const O_OBJ = '{'
const C_OBJ = '}'
const O_ARR = '['
const C_ARR = ']'
const O_PAREN = '('
const C_PAREN = ')'
const IDENT = '  '

const ident = (lines: string[]): string[] => {
  // Using the good ol` for i syntax here for memory effeciancy.
  // (to avoid creating new copies of the lines)
  if (lines.length <= 2) return lines
  lines.forEach((_l, index) => {
    if (index > 0 && index < lines.length - 1) {
      lines[index] = `${IDENT}${lines[index]}`
    }
  })
  return lines
}

const dumpWord = (word: string): string => {
  // word needs to be escaped if it will not be parsed back as a single word token
  const [match] = (rules.main.word as RegExp).exec(word) ?? []
  return match === word ? word : `"${word}"`
}

const separateByCommas = (items: string[][]): string[][] => {
  items.forEach(itemLines => {
    itemLines[itemLines.length - 1] += ','
  })
  return items
}

const dumpPrimitive = (prim: Value): string => JSON.stringify(prim)

const dumpObject = (obj: Value): string[] => {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const attributes = _.toPairs(obj).map(dumpAttr)
  const res = [O_OBJ]
  attributes.forEach(attrLines => attrLines.forEach((l: string) => res.push(l)))
  res.push(C_OBJ)
  return ident(res)
}

const dumpArray = (arr: Value): string[] => {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const items = separateByCommas(arr.map(dumpValue))
  const res = [O_ARR]
  items.forEach(itemLines => itemLines.forEach(l => res.push(l)))
  res.push(C_ARR)
  return ident(res)
}

const dumpExpression = (exp: Value): string[] => {
  if (exp instanceof ReferenceExpression) return [exp.traversalParts.join('.')]
  const { parts } = exp as TemplateExpression
  return [
    dumpPrimitive(parts
      .map(part => (isExpression(part)
        ? `\${ ${dumpExpression(part).join('\n')} }`
        : part)).join('')),
  ]
}

const dumpValue = (value: Value): string[] => {
  if (_.isArray(value)) return dumpArray(value)
  if (isFunctionExpression(value)) {
    const { parameters, funcName } = value
    const dumpedParams = parameters.map(dumpValue)
    if (dumpedParams.length === 1 && dumpedParams[0].length === 1) {
      return [`${funcName}${O_PAREN}${dumpedParams[0][0]}${C_PAREN}`]
    }
    const paramsForDump = _.flatten(separateByCommas(dumpedParams))

    return [`${funcName}${O_PAREN}`, ...paramsForDump, C_PAREN]
  }

  if (_.isPlainObject(value)) return dumpObject(value)
  if (isExpression(value)) return dumpExpression(value)

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

export const dump = (body: DumpedHclBody): string => {
  const attributesLines = _(body.attrs).toPairs().map(dumpAttr).flatten()
    .value()
  const blockLines = _(body.blocks).map(dumpBlock).flatten().value()
  return [
    ...attributesLines,
    ...blockLines,
  ].join('\n').concat('\n')
}
