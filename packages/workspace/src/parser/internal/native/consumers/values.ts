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


// We ignore the use before define lint rule in some cases here since we really do
// have a circular recursion (value -> object/array -> value) and we don't
// want all of the functions to be defined inside consume value since its icky.

import { Value, TemplateExpression, ReferenceExpression, ElemID, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { Consumer, ParseContext, ConsumerReturnType } from '../types'
import { getPosition, createReferenceExpresion, unescapeTemplateMarker, addValuePromiseWatcher, registerRange } from '../helpers'
import { TOKEN_TYPES, LexerToken } from '../lexer'
import { missingComma, unknownFunction, unterminatedString, invalidStringTemplate, missingValue, invalidAttrKey, missingEqualMark, duplicatedAttribute, missingNewline } from '../errors'

import { IllegalReference } from '../../types'

export const MISSING_VALUE = '****dynamic****'

const consumeWord: Consumer<string> = context => {
  const wordToken = context.lexer.next()
  return {
    value: wordToken.value,
    range: { start: getPosition(wordToken), end: getPosition(wordToken, false) },
  }
}

const consumeString = (
  context: ParseContext,
  allowExpressions = true
): ConsumerReturnType<string | TemplateExpression> => {
  // Getting the position for the opening double quote
  const start = getPosition(context.lexer.next())
  const tokens = []

  // We start by collecting all of the tokens until the line ends
  // (its a single line string!) or the " char is met
  while (
        context.lexer.peak(false)?.type !== TOKEN_TYPES.DOUBLE_QUOTES
        && context.lexer.peak(false)?.type !== TOKEN_TYPES.NEWLINE
  ) {
    tokens.push(context.lexer.next(false))
  }

  // Getting the position for the closing double quote.
  // We don't collect it here since a value consumer should not process
  // the newline char at the end of it, since this is handled and *verified*
  // by the consumeValue method, so we check and consume only if its the valid " char.
  const closingQuate = context.lexer.peak(false)
  const lastTokenEndPos = getPosition(tokens[tokens.length - 1], false)
  const end = closingQuate ? getPosition(closingQuate, false) : lastTokenEndPos
  if (closingQuate?.type === TOKEN_TYPES.DOUBLE_QUOTES) {
    context.lexer.next()
  } else {
    context.errors.push(unterminatedString({
      start,
      end: lastTokenEndPos,
      filename: context.filename,
    }))
  }

  // Now we transform the tokens to a single string if there are no references. If there
  // are references, we will create a template expression (If its allowed in this string.
  // template expressions are only allowed in values.)
  const simpleString = _.every(tokens, token => token.type === TOKEN_TYPES.CONTENT)
  if (!simpleString && !allowExpressions) {
    context.errors.push(
      ...tokens.filter(token => token.type === TOKEN_TYPES.REFERENCE)
        .map(token => invalidStringTemplate({
          start: getPosition(token),
          end: getPosition(token, false),
          filename: context.filename,
        }))
    )
  }

  // If we are trying to create a simple string and we found references we will
  // treat them as strings. we need the text and not value of the token since the
  // value attr does not contain the ${ and } chars.
  const value = simpleString || !allowExpressions
    ? tokens.map(token => unescapeTemplateMarker(token.text)).join('')
    : new TemplateExpression({ parts: tokens.map(token => (token.type === TOKEN_TYPES.REFERENCE
      // TODO HANDLE invalid elemID
      ? new ReferenceExpression(ElemID.fromFullName(token.value))
      : unescapeTemplateMarker(token.value))) })
  return {
    value,
    range: { start, end },
  }
}

export const consumeWords: Consumer<string[]> = context => {
  const labels: ConsumerReturnType<string>[] = []
  while (context.lexer.peak()?.type === TOKEN_TYPES.WORD
    || context.lexer.peak()?.type === TOKEN_TYPES.DOUBLE_QUOTES) {
    if (context.lexer.peak()?.type === TOKEN_TYPES.DOUBLE_QUOTES) {
      labels.push(consumeString(context, false) as ConsumerReturnType<string>)
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
      start: getPosition(context.lexer.peak() as LexerToken),
      end: getPosition(context.lexer.peak() as LexerToken),
    },
  }
}

const consumeArrayItems = (
  context: ParseContext,
  closingTokenType: string,
  idPrefix?: ElemID
): Value[] => {
  const items = []
  while (context.lexer.peak()?.type !== closingTokenType) {
    const itemIndex = items.length
    const itemId = idPrefix?.createNestedID(itemIndex.toString())
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const consumedValue = consumeValue(context, itemId, TOKEN_TYPES.COMMA)
    if (context.lexer.peak()?.type === TOKEN_TYPES.COMMA) {
      context.lexer.next()
    } else if (context.lexer.peak()?.type !== closingTokenType) {
      const token = context.lexer.next()
      context.errors.push(missingComma({
        start: getPosition(token),
        end: getPosition(token),
        filename: context.filename,
      }))
      context.lexer.recover([TOKEN_TYPES.COMMA, closingTokenType])
      if (context.lexer.peak()?.type === TOKEN_TYPES.COMMA) {
        context.lexer.next()
      }
    }
    items.push(consumedValue.value)
    addValuePromiseWatcher(context, items, itemIndex)
    if (itemId) {
      registerRange(context, itemId, consumedValue.range)
    }
  }
  return items
}

const consumeParams: Consumer<Value[]> = context => {
  const start = getPosition(context.lexer.next())
  const params = consumeArrayItems(context, TOKEN_TYPES.RIGHT_PAREN)
  const end = getPosition(context.lexer.next(), false)
  return {
    value: params,
    range: { start, end },
  }
}

const consumeFunctionOrReference: Consumer<Value> = context => {
  const firstToken = context.lexer.next()
  const start = getPosition(firstToken)
  if (context.lexer.peak()?.type === TOKEN_TYPES.LEFT_PAREN) {
    const params = consumeParams(context)
    const funcName = firstToken.value
    const func = context.functions[funcName]
    if (func === undefined) {
      context.errors.push(unknownFunction({
        start: getPosition(firstToken),
        end: getPosition(firstToken, false),
        filename: context.filename,
      }, funcName))
    }
    return {
      value: func ? func.parse(params.value) : MISSING_VALUE,
      range: { start, end: params.range.end },
    }
  }
  return {
    value: createReferenceExpresion(firstToken.value),
    range: { start, end: getPosition(firstToken, false) },
  }
}

const consumeMultilineString: Consumer<string | TemplateExpression> = context => {
  // Getting the position of the start marker
  const start = getPosition(context.lexer.next())
  const tokens = []
  while (context.lexer.peak()?.type !== TOKEN_TYPES.MULTILINE_END) {
    tokens.push(context.lexer.next())
  }
  tokens[tokens.length - 1].value = tokens[tokens.length - 1].value.slice(0, -1)
  // We get rid of the traiilng newline
  // Getting the position of the end marker
  const end = getPosition(context.lexer.next(), false)
  const simpleString = _.every(tokens, token => token.type === TOKEN_TYPES.CONTENT)
  const value = simpleString
    ? tokens.map(token => unescapeTemplateMarker(token.value)).join('')
    : new TemplateExpression({ parts: tokens.map(token => {
      if (token.type === TOKEN_TYPES.REFERENCE) {
        const ref = createReferenceExpresion(token.value)
        return ref instanceof IllegalReference ? token.text : ref
      }
      return unescapeTemplateMarker(token.value)
    }) })
  return {
    value,
    range: { start, end },
  }
}

const consumeBoolean: Consumer<boolean> = context => {
  const token = context.lexer.next()
  const start = getPosition(token)
  const end = getPosition(token, false)
  return {
    value: token.value === 'true',
    range: { start, end },
  }
}

const consumeNumber: Consumer<number> = context => {
  const token = context.lexer.next()
  const start = getPosition(token)
  const end = getPosition(token, false)
  return {
    value: parseFloat(token.value),
    range: { start, end },
  }
}

const consumeMissingValue: Consumer<Value> = context => {
  const token = context.lexer.peak(false) as LexerToken
  const range = {
    start: getPosition(token),
    end: getPosition(token),
  }
  context.errors.push(missingValue({ ...range, filename: context.filename }))
  return {
    value: MISSING_VALUE,
    range,
  }
}

const consumeArray = (context: ParseContext, idPrefix?: ElemID): ConsumerReturnType<Value[]> => {
  const start = getPosition(context.lexer.next())
  const arr = consumeArrayItems(context, TOKEN_TYPES.ARR_CLOSE, idPrefix)
  const end = getPosition(context.lexer.next(), false)
  return {
    value: arr,
    range: { start, end },
  }
}

const consumeObject = (context: ParseContext, idPrefix?: ElemID): ConsumerReturnType<Values> => {
  const obj: Values = {}
  const start = getPosition(context.lexer.next())

  const consumeObjectItem = (): void => {
    const tokens = consumeWords(context)
    if (tokens.value?.length !== 1) {
      context.errors.push(invalidAttrKey({ ...tokens.range, filename: context.filename }))
      context.lexer.recover([TOKEN_TYPES.NEWLINE, TOKEN_TYPES.CCURLY])
      return
    }
    const key = tokens.value[0]
    const attrId = idPrefix?.createNestedID(key)
    const eq = context.lexer.peak()
    if (eq?.type !== TOKEN_TYPES.EQUAL) {
      context.errors.push(missingEqualMark({
        start: tokens.range.end,
        end: tokens.range.end,
        filename: context.filename,
      }))
      context.lexer.recover([TOKEN_TYPES.NEWLINE, TOKEN_TYPES.CCURLY])
      return
    }
    // consume the token
    context.lexer.next()
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const consumedValue = consumeValue(context, attrId)
    if (obj[key] === undefined) {
      obj[key] = consumedValue.value
    } else {
      context.errors.push(duplicatedAttribute({ ...tokens.range, filename: context.filename }, key))
    }
    addValuePromiseWatcher(context, obj, key)
    if (attrId) {
      registerRange(context, attrId, { start: tokens.range.start, end: consumedValue.range.end })
    }
    if (context.lexer.peak(false)?.type !== TOKEN_TYPES.NEWLINE
        && context.lexer.peak(false)?.type !== TOKEN_TYPES.CCURLY) {
      const nonNewlineToken = context.lexer.peak(false) as LexerToken
      context.errors.push(missingNewline({
        start: getPosition(nonNewlineToken),
        end: getPosition(nonNewlineToken),
        filename: context.filename,
      }))
      context.lexer.recover([TOKEN_TYPES.NEWLINE, TOKEN_TYPES.CCURLY])
    }
  }

  while (context.lexer.peak() && context.lexer.peak()?.type !== TOKEN_TYPES.CCURLY) {
    consumeObjectItem()
  }

  const end = getPosition(context.lexer.next(), false)
  return {
    value: obj,
    range: { start, end },
  }
}

export const consumeValue = (
  context: ParseContext,
  idPrefix?: ElemID,
  valueSeperator: string = TOKEN_TYPES.NEWLINE
): ConsumerReturnType<Value> => {
  // We force the value to be in the same line if the seperator is a newline by
  // ignoring newlines if the seperator is not a new line...
  switch (context.lexer.peak(valueSeperator !== TOKEN_TYPES.NEWLINE)?.type) {
    case TOKEN_TYPES.OCURLY:
      return consumeObject(context, idPrefix)
    case TOKEN_TYPES.ARR_OPEN:
      return consumeArray(context, idPrefix)
    case TOKEN_TYPES.DOUBLE_QUOTES:
      return consumeString(context)
    case TOKEN_TYPES.MULTILINE_START:
      return consumeMultilineString(context)
    case TOKEN_TYPES.WORD:
      return consumeFunctionOrReference(context)
    case TOKEN_TYPES.NUMBER:
      return consumeNumber(context)
    case TOKEN_TYPES.BOOLEAN:
      return consumeBoolean(context)
    case valueSeperator:
      return consumeMissingValue(context)
    default:
      // Linter Mincha
      throw new Error('Unknown value')
  }
}
