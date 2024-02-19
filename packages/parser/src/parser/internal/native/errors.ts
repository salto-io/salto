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
import { ParseError } from '../../types'
import { SourceRange } from '../types'

const createError = (range: SourceRange, summary: string, message?: string): ParseError => ({
  summary,
  subject: range,
  context: range,
  severity: 'Error',
  message: message || summary,
})

export const unknownPrimitiveTypeError = (range: SourceRange, token?: string): ParseError =>
  createError(
    range,
    'unknown primitive type',
    token ? `Unknown primitive type ${token}.` : 'Expected a primitive type definition.',
  )

export const invalidPrimitiveTypeDef = (range: SourceRange, token: string): ParseError =>
  createError(range, 'invalid type definition', `Expected inheritance operator 'is' found ${token} instead`)

export const invalidFieldsInPrimitiveType = (range: SourceRange): ParseError =>
  createError(
    range,
    'invalid fields in primitive type',
    'Unexpected field definition(s) in a primitive type. Expected no fields.',
  )

export const invalidBlocksInInstance = (range: SourceRange): ParseError =>
  createError(
    range,
    'invalid blocks in an instance',
    'Unexpected field or annotation type definition(s) in a primitive type. Expected only values.',
  )

export const ambigiousBlock = (range: SourceRange): ParseError => createError(range, 'Ambigious block definition')

export const missingLabelsError = (range: SourceRange, token: string): ParseError =>
  createError(range, 'Expected block labels', `Expected block labels, found ${token} instead.`)

export const invalidVarDefinition = (range: SourceRange): ParseError =>
  createError(range, 'Invalid variable definition')

export const invalidNestedBlock = (range: SourceRange): ParseError =>
  createError(range, 'Invalid nested block definition')

export const invalidAttrDefinitionInAnnotationBlock = (range: SourceRange): ParseError =>
  createError(range, 'Invalid annotations block', 'Invalid annotations block, unexpected attribute definition.')

export const multipleAnnotationBlocks = (range: SourceRange): ParseError =>
  createError(
    range,
    'Invalid annotations block',
    'Invalid annotations block, only one annotation block can be defined in a fragment.',
  )

export const multiplFieldDefinitions = (range: SourceRange, fieldName: string): ParseError =>
  createError(
    range,
    'Duplicated field name',
    `Duplicated field name ${fieldName}, a field can only be defined once in a source fragment.`,
  )

export const duplicatedAttribute = (range: SourceRange, key: string): ParseError =>
  createError(range, 'Duplicated attribute', `Duplicated attribute ${key}`)

export const invalidFieldAnnotationBlock = (range: SourceRange): ParseError =>
  createError(
    range,
    'Invalid annotation block in a field definition',
    'Can not define an annotation block inside a field definition',
  )

export const invalidBlockItem = (range: SourceRange): ParseError =>
  createError(range, 'Invalid block item', 'Invalid block item. Expected a new block or an attribute definition.')

export const missingEqualMark = (range: SourceRange): ParseError =>
  createError(range, 'Invalid attribute definition', 'Invalid attribute definition, expected an equal sign')

export const invalidAttrKey = (range: SourceRange): ParseError => createError(range, 'Invalid attribute key')

export const missingValue = (range: SourceRange): ParseError => createError(range, 'Expected a value')

export const missingNewline = (range: SourceRange): ParseError => createError(range, 'Expected a new line')

export const missingComma = (range: SourceRange): ParseError =>
  createError(range, 'Expected a comma', 'Expected a comma or an array termination')

export const unterminatedString = (range: SourceRange): ParseError => createError(range, 'Unterminated string literal')

export const invalidStringTemplate = (range: SourceRange): ParseError =>
  createError(range, 'Invalid string template expression')

export const unknownFunction = (range: SourceRange, funcName: string): ParseError =>
  createError(range, 'Unknown function', `Unknown function ${funcName}`)

export const unexpectedEndOfFile = (range: SourceRange): ParseError => createError(range, 'Unexpected end of file')

export const missingBlockOpen = (range: SourceRange): ParseError => createError(range, 'Expected {')

export const contentMergeConflict = (range: SourceRange): ParseError => createError(range, 'Unresolved merge conflict')

export const invalidSyntax = (range: SourceRange): ParseError => createError(range, 'Invalid syntax')

export const unknownParsingError = (range: SourceRange, message: string): ParseError => createError(range, message)

export const invalidStringChar = (stringRange: SourceRange, errMsg: string): ParseError => {
  const errMsgPosition = Number.parseInt(_.last(errMsg.split(' ')) || '', 10)
  const range = Number.isNaN(errMsgPosition)
    ? stringRange
    : {
        ...stringRange,
        start: {
          ...stringRange.start,
          byte: stringRange.start.byte + errMsgPosition - 1,
          col: stringRange.start.col + errMsgPosition - 1,
        },
        end: {
          ...stringRange.start,
          byte: stringRange.start.byte + errMsgPosition,
          col: stringRange.start.col + errMsgPosition,
        },
      }
  return createError(range, 'Invalid string character')
}

export const invalidElemIDType = (typeName: string, range: SourceRange): ParseError =>
  createError(range, 'Invalid type name', `"${typeName}" is invalid. Valid type names format is {adapter}.{type}`)
