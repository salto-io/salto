/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ReferenceExpression,
  ElemID,
  Value,
  ListType,
  PrimitiveTypes,
  MapType,
  VariableExpression,
  TypeReference,
} from '@salto-io/adapter-api'
import isPromise from 'is-promise'
import { LexerToken, WILDCARD } from './lexer'
import { SourcePos, IllegalReference, SourceRange } from '../types'
import { ParseContext, ValuePromiseWatcher } from './types'
import { Keywords, keywordToPrimitiveType } from '../../language'
import { invalidElemIDType } from './errors'

export const INVALID_ELEM_ID = new ElemID(WILDCARD)

export const positionAtStart = (token: LexerToken): SourcePos => ({
  col: token.col,
  line: token.line,
  byte: token.offset,
})

export const positionAtEnd = (token: LexerToken): SourcePos => ({
  byte: token.offset + token.text.length,
  line: token.line + token.lineBreaks,
  col: token.lineBreaks > 0 ? token.text.slice(token.text.lastIndexOf('\n')).length : token.col + token.text.length,
})

export const parseTopLevelID = (context: ParseContext, fullName: string, range: SourceRange): ElemID => {
  const parts = fullName.split(Keywords.NAMESPACE_SEPARATOR)
  if (parts.length > 2) {
    context.errors.push(invalidElemIDType(fullName, range))
    return INVALID_ELEM_ID
  }
  const adapter = parts.length > 1 ? parts[0] : ''
  const name = parts.length > 1 ? parts[1] : parts[0]
  return new ElemID(adapter, name)
}

export const createReferenceExpression = (ref: string): ReferenceExpression | IllegalReference => {
  try {
    const elemId = ElemID.fromFullName(ref)
    return elemId.adapter === ElemID.VARIABLES_NAMESPACE
      ? new VariableExpression(elemId)
      : new ReferenceExpression(elemId)
  } catch (e) {
    return new IllegalReference(ref, e.message)
  }
}

export const registerRange = (context: ParseContext, id: ElemID, range: Omit<SourceRange, 'filename'>): void => {
  if (context.calcSourceMap) {
    context.sourceMap.push(id.getFullName(), { ...range, filename: context.filename })
  }
}

export const addValuePromiseWatcher = (
  valuePromiseWatchers: ValuePromiseWatcher[],
  parent: Value,
  key: string | number,
): void => {
  if (isPromise(parent[key])) {
    valuePromiseWatchers.push({ parent, key })
  }
}

export const replaceValuePromises = async (valuePromiseWatchers: ValuePromiseWatcher[]): Promise<void> => {
  await Promise.all(
    valuePromiseWatchers.map(async watcher => {
      const { parent, key } = watcher
      parent[key] = await parent[key]
    }),
  )
}

export const createFieldRefType = (context: ParseContext, blockType: string, range: SourceRange): TypeReference => {
  if (blockType.startsWith(Keywords.LIST_PREFIX) && blockType.endsWith(Keywords.GENERICS_SUFFIX)) {
    const listType = new ListType(
      createFieldRefType(
        context,
        blockType.substring(Keywords.LIST_PREFIX.length, blockType.length - Keywords.GENERICS_SUFFIX.length),
        range,
      ),
    )
    const listRefType = new TypeReference(listType.elemID)
    context.listTypes[listType.elemID.getFullName()] = listType
    return listRefType
  }
  if (blockType.startsWith(Keywords.MAP_PREFIX) && blockType.endsWith(Keywords.GENERICS_SUFFIX)) {
    const mapType = new MapType(
      createFieldRefType(
        context,
        blockType.substring(Keywords.MAP_PREFIX.length, blockType.length - Keywords.GENERICS_SUFFIX.length),
        range,
      ),
    )
    const mapRefType = new TypeReference(mapType.elemID)
    context.mapTypes[mapType.elemID.getFullName()] = mapType
    return mapRefType
  }
  return new TypeReference(parseTopLevelID(context, blockType, range))
}

export const primitiveType = (typeName: string): PrimitiveTypes | undefined => keywordToPrimitiveType[typeName]
