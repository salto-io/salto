/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

// We ignore the use before define lint rule in some cases here since we really do
// have a circular recursion (value -> object/array -> value) and we don't
// want all of the functions to be defined inside consume value since its icky.

import { Value, TemplateExpression, ElemID, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { Token } from 'moo'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Consumer, ParseContext, ConsumerReturnType } from '../types'
import {
  createReferenceExpression,
  addValuePromiseWatcher,
  registerRange,
  positionAtStart,
  positionAtEnd,
} from '../helpers'
import { unescapeTemplateMarker } from '../../utils'
import { TOKEN_TYPES, LexerToken, TRUE, FALSE, stringLexer } from '../lexer'
import {
  missingComma,
  unknownFunction,
  unterminatedString,
  invalidStringTemplate,
  missingValue,
  invalidAttrKey,
  missingEqualMark,
  duplicatedAttribute,
  missingNewline,
  invalidStringChar,
} from '../errors'

import { IllegalReference } from '../../types'

export const MISSING_VALUE = '****dynamic****'

const log = logger(module)

export class UnknownCharacter extends Error {
  constructor(public readonly token: LexerToken) {
    super(`Unknown character: ${token.text}`)
  }
}

const consumeWord: Consumer<string> = context => {
  const wordToken = context.lexer.next()
  return {
    value: wordToken.value,
    range: { start: positionAtStart(wordToken), end: positionAtEnd(wordToken) },
  }
}

const createSimpleStringValue = (
  context: Pick<ParseContext, 'errors' | 'filename'>,
  tokens: Required<Token>[],
): string => {
  try {
    return JSON.parse(
      `"${unescapeTemplateMarker(tokens.map(token => token.text).join(''), { unescapeStrategy: 'markerOnly' })}"`,
    )
  } catch (e) {
    context.errors.push(
      invalidStringChar(
        {
          start: positionAtStart(tokens[0]),
          end: positionAtEnd(tokens[tokens.length - 1]),
          filename: context.filename,
        },
        e.message,
      ),
    )
    return ''
  }
}

const createTemplateExpressions = (
  context: Pick<ParseContext, 'errors' | 'filename'>,
  tokens: Required<Token>[],
  createSimpleStringValueFunc: (
    context: Pick<ParseContext, 'errors' | 'filename'>,
    tokens: Required<Token>[],
    isNextPartReference?: boolean,
  ) => string,
): TemplateExpression =>
  createTemplateExpression({
    parts: tokens.map((token, idx) => {
      if (token.type === TOKEN_TYPES.REFERENCE) {
        const ref = createReferenceExpression(token.value)
        return ref instanceof IllegalReference ? token.text : ref
      }
      const isNextPartReference = tokens[idx + 1]?.type === TOKEN_TYPES.REFERENCE
      return createSimpleStringValueFunc(context, [token], isNextPartReference)
    }),
  })

export const createStringValue = (
  context: Pick<ParseContext, 'errors' | 'filename'>,
  tokens: Required<Token>[],
  createSimpleStringValueFunc = createSimpleStringValue,
): string | TemplateExpression => {
  const isSimpleString = _.every(tokens, token =>
    [TOKEN_TYPES.CONTENT, TOKEN_TYPES.ESCAPE, TOKEN_TYPES.NEWLINE].includes(token.type),
  )
  return isSimpleString
    ? createSimpleStringValueFunc(context, tokens)
    : createTemplateExpressions(context, tokens, createSimpleStringValueFunc)
}

const consumeStringData = (context: ParseContext): ConsumerReturnType<Required<Token>[]> => {
  // Getting the position for the opening double quote
  const start = positionAtStart(context.lexer.next())
  const tokens = []

  // We start by collecting all of the tokens until the line ends
  // (its a single line string!) or the " char is met
  while (
    context.lexer.peek(false)?.type !== TOKEN_TYPES.DOUBLE_QUOTES &&
    context.lexer.peek(false)?.type !== TOKEN_TYPES.NEWLINE
  ) {
    tokens.push(context.lexer.next(false))
  }

  // Getting the position for the closing double quote.
  // We don't collect it here since a value consumer should not process
  // the newline char at the end of it, since this is handled and *verified*
  // by the consumeValue method, so we check and consume only if its the valid " char.
  const closingQuote = context.lexer.peek(false)
  const lastTokenEndPos = tokens.length > 0 ? positionAtEnd(tokens[tokens.length - 1]) : start
  const end = closingQuote ? positionAtEnd(closingQuote) : lastTokenEndPos
  if (closingQuote?.type === TOKEN_TYPES.DOUBLE_QUOTES) {
    context.lexer.next()
  } else {
    context.errors.push(
      unterminatedString({
        start,
        end: lastTokenEndPos,
        filename: context.filename,
      }),
    )
  }
  const stringTokens = stringLexer(tokens, start)
  return {
    range: { start, end },
    value: stringTokens,
  }
}

const isSimpleString = (tokens: Required<Token>[]): boolean =>
  _.every(tokens, token => token.type === TOKEN_TYPES.CONTENT)

const consumeSimpleString = (context: ParseContext): ConsumerReturnType<string> => {
  const stringData = consumeStringData(context)
  if (!isSimpleString(stringData.value)) {
    context.errors.push(
      ...stringData.value
        .filter(token => token.type === TOKEN_TYPES.REFERENCE)
        .map(token =>
          invalidStringTemplate({
            start: positionAtStart(token),
            end: positionAtEnd(token),
            filename: context.filename,
          }),
        ),
    )
  }
  const value = createSimpleStringValue(context, stringData.value)
  return {
    range: stringData.range,
    value,
  }
}

const consumeString = (context: ParseContext): ConsumerReturnType<string | TemplateExpression> => {
  const stringData = consumeStringData(context)
  const value = createStringValue(context, stringData.value)
  return {
    value,
    range: stringData.range,
  }
}

export const consumeWords: Consumer<string[]> = context => {
  const labels: ConsumerReturnType<string>[] = []
  while (context.lexer.peek()?.type === TOKEN_TYPES.WORD || context.lexer.peek()?.type === TOKEN_TYPES.DOUBLE_QUOTES) {
    if (context.lexer.peek()?.type === TOKEN_TYPES.DOUBLE_QUOTES) {
      labels.push(consumeSimpleString(context))
    } else {
      labels.push(consumeWord(context))
    }
  }
  if (labels.length > 0) {
    const { start } = labels[0].range
    const { end } = labels[labels.length - 1].range
    return {
      value: labels.map(l => l.value || ''),
      range: { start, end },
    }
  }
  return {
    value: [],
    range: {
      start: positionAtStart(context.lexer.peek() as LexerToken),
      end: positionAtStart(context.lexer.peek() as LexerToken),
    },
  }
}

const consumeArrayItems = (context: ParseContext, closingTokenType: string, idPrefix?: ElemID): Value[] => {
  const items = []
  while (context.lexer.peek()?.type !== closingTokenType) {
    const itemIndex = items.length
    const itemId = idPrefix?.createNestedID(itemIndex.toString())
    // eslint-disable-next-line no-use-before-define
    const consumedValue = consumeValue(context, itemId, TOKEN_TYPES.COMMA)
    if (context.lexer.peek()?.type === TOKEN_TYPES.COMMA) {
      context.lexer.next()
    } else if (context.lexer.peek()?.type !== closingTokenType) {
      const token = context.lexer.next()
      context.errors.push(
        missingComma({
          start: positionAtStart(token),
          end: positionAtEnd(token),
          filename: context.filename,
        }),
      )
      context.lexer.recover([TOKEN_TYPES.COMMA, closingTokenType], false)
      if (context.lexer.peek()?.type === TOKEN_TYPES.COMMA) {
        context.lexer.next()
      }
    }
    items.push(consumedValue.value)
    addValuePromiseWatcher(context.valuePromiseWatchers, items, itemIndex)
    if (itemId) {
      registerRange(context, itemId, consumedValue.range)
    }
  }
  return items
}

const unescapeMultilineMarker = (prim: string): string => prim.replace(/\\'''/g, "'''")

const createMultilineSimpleStringValue = (
  _context: unknown,
  tokens: Required<Token>[],
  isNextPartReference?: boolean,
): string =>
  unescapeMultilineMarker(unescapeTemplateMarker(tokens.map(token => token.text).join(''), { isNextPartReference }))

const consumeMultilineString: Consumer<string | TemplateExpression> = context => {
  // Getting the position of the start marker
  const start = positionAtStart(context.lexer.next())
  const tokens = []
  while (context.lexer.peek()?.type !== TOKEN_TYPES.MULTILINE_END) {
    tokens.push(context.lexer.next())
  }
  if (tokens.length > 0) {
    // We get rid of the trailing newline
    tokens[tokens.length - 1].value = tokens[tokens.length - 1].value.slice(0, -1)
    tokens[tokens.length - 1].text = tokens[tokens.length - 1].text.slice(0, -1)
  }

  // Getting the position of the end marker
  const end = positionAtEnd(context.lexer.next())
  const stringTokens = stringLexer(tokens, start)
  const value = createStringValue(context, stringTokens, createMultilineSimpleStringValue)
  return {
    value,
    range: { start, end },
  }
}

const consumeBoolean: Consumer<boolean> = context => {
  const token = context.lexer.next()
  const start = positionAtStart(token)
  const end = positionAtEnd(token)
  return {
    value: token.value === TRUE,
    range: { start, end },
  }
}

const consumeNumber: Consumer<number> = context => {
  const token = context.lexer.next()
  const start = positionAtStart(token)
  const end = positionAtEnd(token)
  return {
    value: parseFloat(token.value),
    range: { start, end },
  }
}

const consumeMissingValue: Consumer<Value> = context => {
  const token = context.lexer.peek(false) as LexerToken
  const range = {
    start: positionAtStart(token),
    end: positionAtStart(token),
  }
  context.errors.push(missingValue({ ...range, filename: context.filename }))
  return {
    value: MISSING_VALUE,
    range,
  }
}

const consumeParams: Consumer<Value[]> = context => {
  const start = positionAtStart(context.lexer.next())
  const params = consumeArrayItems(context, TOKEN_TYPES.RIGHT_PAREN)
  const end = positionAtEnd(context.lexer.next())
  return {
    value: params,
    range: { start, end },
  }
}

const consumeFunctionOrReferenceOrBoolean: Consumer<Value> = context => {
  const nextValue = context.lexer.peek()?.value
  if (nextValue !== undefined && [TRUE, FALSE].includes(nextValue)) {
    return consumeBoolean(context)
  }

  const firstToken = context.lexer.next()
  const start = positionAtStart(firstToken)
  if (context.lexer.peek()?.type === TOKEN_TYPES.LEFT_PAREN) {
    const params = consumeParams(context)
    const funcName = firstToken.value
    const func = context.functions[funcName]
    if (func === undefined) {
      context.errors.push(
        unknownFunction(
          {
            start: positionAtStart(firstToken),
            end: positionAtEnd(firstToken),
            filename: context.filename,
          },
          funcName,
        ),
      )
    }
    return {
      value: func ? func.parse(params.value) : MISSING_VALUE,
      range: { start, end: params.range.end },
    }
  }
  return {
    value: createReferenceExpression(firstToken.value),
    range: { start, end: positionAtEnd(firstToken) },
  }
}

const consumeArray = (context: ParseContext, idPrefix?: ElemID): ConsumerReturnType<Value[]> => {
  const start = positionAtStart(context.lexer.next())
  const arr = consumeArrayItems(context, TOKEN_TYPES.ARR_CLOSE, idPrefix)
  const end = positionAtEnd(context.lexer.next())
  return {
    value: arr,
    range: { start, end },
  }
}

const consumeObject = (context: ParseContext, idPrefix?: ElemID): ConsumerReturnType<Values> => {
  const obj: Values = {}
  const start = positionAtStart(context.lexer.next())

  const consumeObjectItem = (): void => {
    const tokens = consumeWords(context)
    if (tokens.value?.length !== 1) {
      context.errors.push(invalidAttrKey({ ...tokens.range, filename: context.filename }))
      context.lexer.recover([TOKEN_TYPES.NEWLINE, TOKEN_TYPES.CCURLY])
      return
    }
    const key = tokens.value[0]
    const attrId = idPrefix?.createNestedID(key)
    const eq = context.lexer.peek()
    if (eq?.type !== TOKEN_TYPES.EQUAL) {
      context.errors.push(
        missingEqualMark({
          start: tokens.range.end,
          end: tokens.range.end,
          filename: context.filename,
        }),
      )
      context.lexer.recover([TOKEN_TYPES.NEWLINE, TOKEN_TYPES.CCURLY])
      return
    }
    // consume the token
    context.lexer.next()
    // eslint-disable-next-line no-use-before-define
    const consumedValue = consumeValue(context, attrId)
    if (obj[key] === undefined) {
      obj[key] = consumedValue.value
    } else {
      context.errors.push(duplicatedAttribute({ ...tokens.range, filename: context.filename }, key))
    }
    addValuePromiseWatcher(context.valuePromiseWatchers, obj, key)
    if (attrId) {
      registerRange(context, attrId, { start: tokens.range.start, end: consumedValue.range.end })
    }
    if (
      context.lexer.peek(false)?.type !== TOKEN_TYPES.NEWLINE &&
      context.lexer.peek(false)?.type !== TOKEN_TYPES.CCURLY
    ) {
      const nonNewlineToken = context.lexer.peek(false) as LexerToken
      if (!nonNewlineToken) {
        // If we don't have another token we will use next to trigger the EOF logic
        context.lexer.next()
      }
      context.errors.push(
        missingNewline({
          start: positionAtStart(nonNewlineToken),
          end: positionAtStart(nonNewlineToken),
          filename: context.filename,
        }),
      )
      context.lexer.recover([TOKEN_TYPES.NEWLINE, TOKEN_TYPES.CCURLY])
    }
  }

  while (context.lexer.peek() && context.lexer.peek()?.type !== TOKEN_TYPES.CCURLY) {
    consumeObjectItem()
  }

  const end = positionAtEnd(context.lexer.next())
  return {
    value: obj,
    range: { start, end },
  }
}

export const consumeValue = (
  context: ParseContext,
  idPrefix?: ElemID,
  valueSeparator: string = TOKEN_TYPES.NEWLINE,
): ConsumerReturnType<Value> => {
  // We force the value to be in the same line if the separator is a newline by
  // ignoring newlines if the separator is not a new line...
  const token = context.lexer.peek(valueSeparator !== TOKEN_TYPES.NEWLINE)
  switch (token?.type) {
    case TOKEN_TYPES.OCURLY:
      return consumeObject(context, idPrefix)
    case TOKEN_TYPES.ARR_OPEN:
      return consumeArray(context, idPrefix)
    case TOKEN_TYPES.DOUBLE_QUOTES:
      return consumeString(context)
    case TOKEN_TYPES.MULTILINE_START:
      return consumeMultilineString(context)
    case TOKEN_TYPES.WORD:
      return consumeFunctionOrReferenceOrBoolean(context)
    case TOKEN_TYPES.NUMBER:
      return consumeNumber(context)
    case valueSeparator:
      return consumeMissingValue(context)
    default:
      if (token !== undefined) {
        throw new UnknownCharacter(token)
      }
      log.error('Received an undefined token in `consumeValue`')
      throw new Error('Unknown value')
  }
}
