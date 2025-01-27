/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ERROR_MESSAGES } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { Keywords } from '../../language'
import { ParseError } from '../../types'
import { SourceRange } from '../types'

const createError = (range: SourceRange, summary: string, message?: string): ParseError => ({
  summary,
  subject: range,
  context: range,
  severity: 'Error',
  message: ERROR_MESSAGES.INVALID_NACL_CONTENT,
  detailedMessage: message || summary,
})

export const unknownPrimitiveTypeError = (range: SourceRange, token?: string): ParseError =>
  createError(
    range,
    'Unknown primitive type',
    token ? `Unknown primitive type '${token}'.` : 'Expected a primitive type definition, using unknown.',
  )

export const primitiveSettingsError = (range: SourceRange): ParseError =>
  createError(range, 'Primitive settings type', 'Settings types cannot be primitive.')

export const invalidMetaTypeError = (range: SourceRange, token: string): ParseError =>
  createError(range, 'Invalid meta type', `Meta type ${token} is invalid, must be an object type.`)

export const invalidFieldsInPrimitiveType = (range: SourceRange): ParseError =>
  createError(
    range,
    'Invalid fields in primitive type',
    'Unexpected field definition(s) in a primitive type. Expected no fields.',
  )

export const invalidBlocksInInstance = (range: SourceRange): ParseError =>
  createError(
    range,
    'Invalid blocks in an instance',
    'Unexpected field or annotation type definition(s) in a primitive type. Expected only values.',
  )

export const invalidDefinition = (range: SourceRange, labels: string[]): ParseError => {
  if (labels.length === 0) {
    return createError(range, 'Missing block definition')
  }

  if (labels[0] === Keywords.TYPE_DEFINITION) {
    return createError(
      range,
      'Invalid type definition',
      "Type definition must be of the form 'type <name>' or 'type <name> is <category>'.",
    )
  }

  if (labels[0] === Keywords.SETTINGS_DEFINITION) {
    return createError(
      range,
      'Invalid settings type definition',
      "Settings type definition must be of the form 'settings <name>'.",
    )
  }

  return createError(
    range,
    'Invalid instance definition',
    "Instance definition must be of the form '<type> name' or '<settings type>'.",
  )
}

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

export const multipleFieldDefinitions = (range: SourceRange, fieldName: string): ParseError =>
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

export const unexpectedPromise = (range: SourceRange): ParseError => createError(range, 'Received unexpected promise')
