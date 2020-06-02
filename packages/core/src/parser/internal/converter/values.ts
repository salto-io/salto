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
import { Values, Value, ElemID, ReferenceExpression, VariableExpression, TemplateExpression, isReferenceExpression, TemplatePart } from '@salto-io/adapter-api'
import _ from 'lodash'
import { SourceMap } from '../../source_map'
import { InternalParseRes, AttrData, NearleyError, LexerToken } from './types'
import { HclExpression } from '../types'
import { evaluateFunction } from '../../functions'
import { addValuePromiseWatcher, createSourceRange, getAllowWildcard, getCurrentFunctions } from './context'

export class IllegalReference {
  constructor(public ref: string, public message: string) {}
}

export const convertAttributes = (
  attrs: InternalParseRes<AttrData>[]
): Omit<InternalParseRes<Values>, 'source'> => {
  const value: Record<string, Value> = {}
  const sourceMap = new SourceMap()
  attrs.forEach(attr => {
    const [attrKey, attrValue] = attr.value
    if (value[attrKey] !== undefined) {
      throw new NearleyError(attr, attr.source.start.byte, 'Attribute redefined')
    }
    value[attrKey] = attrValue
    addValuePromiseWatcher(value, attrKey)
    if (attr.sourceMap) {
      sourceMap.mount(attrKey, attr.sourceMap)
    }
    sourceMap.push(attrKey, attr.source)
  })
  return {
    value,
    sourceMap,
  }
}

export const convertArray = (
  openingBracket: LexerToken,
  arrayItems: InternalParseRes<Value>[],
  closingBracket: LexerToken
): InternalParseRes<Value[]> => {
  const sourceMap = new SourceMap()
  const value: Value[] = []
  arrayItems.forEach((item, index) => {
    value.push(item.value)
    addValuePromiseWatcher(value, index)
    if (item.sourceMap) {
      sourceMap.mount(index.toString(), item.sourceMap)
    }
    sourceMap.push(index.toString(), item.source)
  })
  return {
    value,
    source: createSourceRange(openingBracket, closingBracket),
    sourceMap,
  }
}

export const convertObject = (
  openingBracket: LexerToken,
  attrs: InternalParseRes<AttrData>[],
  closingBracket: LexerToken
): InternalParseRes<Values> => ({
  ...convertAttributes(attrs),
  source: createSourceRange(openingBracket, closingBracket),
})

export const convertReference = (
  reference: LexerToken
): InternalParseRes<ReferenceExpression | IllegalReference> => {
  const ref = reference.value
  const source = createSourceRange(reference, reference)
  try {
    const elemId = ElemID.fromFullName(ref)
    return elemId.adapter === ElemID.VARIABLES_NAMESPACE
      ? { value: new VariableExpression(elemId), source }
      : { value: new ReferenceExpression(elemId), source }
  } catch (e) {
    return { value: new IllegalReference(ref, e.message), source }
  }
}

const unescapeTemplateMarker = (text: string): string =>
  text.replace(/\\\$\{/gi, '${',)

export const convertString = (
  openingQuotationMark: LexerToken,
  contentTokens: LexerToken[],
  closingQuotationMark: LexerToken
): InternalParseRes<string | TemplateExpression> => {
  const source = createSourceRange(openingQuotationMark, closingQuotationMark)
  const convertedTokens = contentTokens.map(t => (isReferenceExpression(t)
    ? convertReference(t)
    : JSON.parse(`"${unescapeTemplateMarker(t.text)}"`)))
  if (_.some(convertedTokens, isReferenceExpression)) {
    return {
      value: new TemplateExpression({ parts: convertedTokens }),
      source,
    }
  }
  return {
    value: convertedTokens.join(''),
    source,
  }
}

export const convertMultilineString = (
  mlStart: LexerToken,
  contentTokens: LexerToken[],
  mlEnd: LexerToken
): InternalParseRes<string | TemplateExpression> => {
  const expressions = contentTokens.map((token, index) => {
    const withoutEscaping = unescapeTemplateMarker(token.text)
    const value = index === contentTokens.length - 1
      ? withoutEscaping.slice(0, withoutEscaping.length - 1) // Remove the last \n
      : withoutEscaping
    return token.type === 'reference'
      ? convertReference(token).value
      : value
  })
  const source = createSourceRange(mlStart, mlEnd)
  return _.some(expressions, exp => isReferenceExpression(exp))
    ? { value: new TemplateExpression({ parts: expressions as TemplatePart[] }), source }
    : { value: expressions.join(''), source }
}

export const convertBoolean = (bool: LexerToken): InternalParseRes<boolean> => ({
  value: bool.text === 'true',
  source: createSourceRange(bool), // LOL. This was unindented. Honest.
})

export const convertNumber = (num: LexerToken): InternalParseRes<number> => ({
  value: parseFloat(num.text),
  source: createSourceRange(num),
})

const convertAttrKey = (key: LexerToken): string => (key.type === 'string'
  ? JSON.parse(key.text)
  : key.text)

export const convertAttr = (
  attrKey: LexerToken,
  attrValue: InternalParseRes<Value>
): InternalParseRes<AttrData> => {
  const key = convertAttrKey(attrKey)
  const value = [key, attrValue.value] as AttrData
  const source = createSourceRange(attrKey, attrValue)
  return { value, source, sourceMap: attrValue.sourceMap }
}

export const convertWildcard = (wildcard: LexerToken): HclExpression => {
  const exp = {
    type: 'dynamic',
    expressions: [],
    source: createSourceRange(wildcard),
  } as HclExpression
  if (getAllowWildcard()) return exp
  throw new NearleyError(exp, wildcard.offset, 'Invalid wildcard token')
}

export const convertFunction = (
  funcName: LexerToken,
  parameters: InternalParseRes<Value>[],
  funcEnd: LexerToken
): InternalParseRes<Promise<Value>> => {
  const source = createSourceRange(funcName, funcEnd)
  const value = evaluateFunction(
    funcName.value,
    parameters.map(p => p.value),
    getCurrentFunctions()
  )
  return { source, value }
}
