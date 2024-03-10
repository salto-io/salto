/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { Value, isExpression, ReferenceExpression, TemplateExpression } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { DumpedHclBlock, DumpedHclBody } from './types'
import { isFunctionExpression } from './functions'
import { rules } from './native/lexer'
import { escapeTemplateMarker } from './utils'

const O_BLOCK = '{'
const C_BLOCK = '}'
const O_OBJ = '{'
const C_OBJ = '}'
const O_ARR = '['
const C_ARR = ']'
const O_PAREN = '('
const C_PAREN = ')'
export const INDENTATION = '  '
export const MULTILINE_STRING_PREFIX = "'''\n"
export const MULTILINE_STRING_SUFFIX = "\n'''"

const createIndentation = (indentationLevel: number): string => INDENTATION.repeat(indentationLevel)

const dumpWord = (word: string, indentationLevel = 0): string => {
  // word needs to be escaped if it will not be parsed back as a single word token
  const [match] = (rules.main.word as RegExp).exec(word) ?? []
  const escapedWord = match === word ? word : `"${word}"`
  return `${createIndentation(indentationLevel)}${escapedWord}`
}

const separateByCommas = (items: string[][]): string[][] => {
  items.forEach(itemLines => {
    itemLines[itemLines.length - 1] += ','
  })
  return items
}

const isMultilineString = (prim: string): boolean => _.isString(prim) && prim.includes('\n')

// Double escaping happens when we stringify after escaping.
const fixDoubleTemplateMarkerEscaping = (prim: string): string => prim.replace(/\\\\\$\{/g, '\\${')

const escapeMultilineMarker = (prim: string): string => prim.replace(/'''/g, "\\'''")

const dumpMultilineString = (prim: string): string =>
  [MULTILINE_STRING_PREFIX, escapeMultilineMarker(prim), MULTILINE_STRING_SUFFIX].join('')

const dumpString = (prim: string, indentationLevel = 0): string => {
  const dumpedString = isMultilineString(prim)
    ? dumpMultilineString(prim)
    : fixDoubleTemplateMarkerEscaping(safeJsonStringify(prim))
  return `${createIndentation(indentationLevel)}${dumpedString}`
}

const dumpPrimitive = (prim: Value, indentationLevel = 0): string =>
  `${createIndentation(indentationLevel)}${safeJsonStringify(prim)}`

const dumpObject = (obj: Value, indentationLevel = 0): string[] => {
  const attributes = _.toPairs(obj).map(
    // eslint-disable-next-line no-use-before-define
    attr => dumpAttr(attr, indentationLevel + 1),
  )
  const res = [`${createIndentation(indentationLevel)}${O_OBJ}`]
  attributes.forEach(attrLines => attrLines.forEach((l: string) => res.push(l)))
  res.push(`${createIndentation(indentationLevel)}${C_OBJ}`)
  return res
}

const dumpArray = (arr: Value, indentationLevel = 0): string[] => {
  const items = separateByCommas(
    arr.map(
      // eslint-disable-next-line no-use-before-define
      (val: Value) => dumpValue(val, indentationLevel + 1),
    ),
  )
  const res = [`${createIndentation(indentationLevel)}${O_ARR}`]
  items.forEach(itemLines => itemLines.forEach(l => res.push(l)))
  res.push(`${createIndentation(indentationLevel)}${C_ARR}`)
  return res
}

const dumpExpression = (exp: Value, indentationLevel = 0): string[] => {
  if (exp instanceof ReferenceExpression) {
    return [`${createIndentation(indentationLevel)}${[exp.elemID.getFullName()]}`]
  }
  const { parts } = exp as TemplateExpression
  return [
    dumpString(
      parts
        .map(part => (isExpression(part) ? `\${ ${dumpExpression(part).join('\n')} }` : escapeTemplateMarker(part)))
        .join(''),
      indentationLevel,
    ),
  ]
}

export const dumpValue = (value: Value, indentationLevel = 0): string[] => {
  if (_.isArray(value)) {
    return dumpArray(value, indentationLevel)
  }
  if (isFunctionExpression(value)) {
    const { parameters, funcName } = value
    const dumpedParams = parameters.map(param => dumpValue(param, indentationLevel + 1))
    if (dumpedParams.length === 1 && dumpedParams[0].length === 1) {
      return [`${createIndentation(indentationLevel)}${funcName}${O_PAREN}${dumpedParams[0][0].trimLeft()}${C_PAREN}`]
    }
    const paramsForDump = _.flatten(separateByCommas(dumpedParams))

    return [
      `${createIndentation(indentationLevel)}${funcName}${O_PAREN}`,
      ...paramsForDump,
      `${createIndentation(indentationLevel)}${C_PAREN}`,
    ]
  }

  if (_.isPlainObject(value)) {
    return dumpObject(value, indentationLevel)
  }
  if (isExpression(value)) return dumpExpression(value, indentationLevel)
  if (_.isString(value)) return [dumpString(escapeTemplateMarker(value), indentationLevel)]

  return [dumpPrimitive(value, indentationLevel)]
}

const dumpAttr = (attr: [string, Value], indentationLevel = 0): string[] => {
  const [key, value] = attr
  const valueLines = dumpValue(value, indentationLevel)
  valueLines[0] = `${dumpWord(key, indentationLevel)} = ${valueLines[0].trimLeft()}`
  return valueLines
}

const createBlockDefLine = (block: DumpedHclBlock, indentationLevel = 0): string => {
  const type = dumpWord(block.type, indentationLevel)
  const labels = block.labels.map(word => dumpWord(word, 0))
  return [type, ...labels, O_BLOCK].join(' ')
}

const dumpBlock = (block: DumpedHclBlock, indentationLevel = 0): string[] => {
  const defLine = createBlockDefLine(block, indentationLevel)
  const blocks = block.blocks.map(subBlock => dumpBlock(subBlock, indentationLevel + 1))
  const attributes = _(block.attrs)
    .toPairs()
    .map(attr => dumpAttr(attr, indentationLevel + 1))
    .value()
  const res = [defLine]
  blocks.forEach(blockLines => blockLines.forEach(b => res.push(b)))
  attributes.forEach(attributeLines => attributeLines.forEach(a => res.push(a)))
  res.push(`${createIndentation(indentationLevel)}${C_BLOCK}`)
  return res
}

export const dump = (body: DumpedHclBody, indentationLevel = 0): string => {
  const attributesLines = _(body.attrs)
    .toPairs()
    .map(line => dumpAttr(line, indentationLevel))
    .flatten()
    .value()
  const blockLines = _(body.blocks)
    .map(block => dumpBlock(block, indentationLevel))
    .flatten()
    .value()
  return [...attributesLines, ...blockLines].join('\n').concat('\n')
}
