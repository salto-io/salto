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
import { ReferenceExpression, ElemID, Value, TypeElement, ListType, ObjectType, PrimitiveTypes, MapType, VariableExpression } from '@salto-io/adapter-api'
import isPromise from 'is-promise'
import { LexerToken } from './lexer'
import { SourcePos, IllegalReference, SourceRange } from '../types'
import { ParseContext } from './types'
import { Keywords } from '../../language'

export const positionAtStart = (token: LexerToken): SourcePos => ({
  col: token.col,
  line: token.line,
  byte: token.offset,
})

export const positionAtEnd = (token: LexerToken): SourcePos => ({
  byte: token.offset + token.text.length,
  line: token.line + token.lineBreaks,
  col: token.lineBreaks > 0
    ? token.text.slice(token.text.lastIndexOf('\n')).length
    : token.col + token.text.length,
})

export const parseElemID = (fullname: string): ElemID => {
  const separatorIdx = fullname.indexOf(Keywords.NAMESPACE_SEPARATOR)
  const adapter = (separatorIdx >= 0) ? fullname.slice(0, separatorIdx) : ''
  const name = fullname.slice(separatorIdx + Keywords.NAMESPACE_SEPARATOR.length)
  return new ElemID(adapter, name)
}

export const createReferenceExpresion = (ref: string): ReferenceExpression | IllegalReference => {
  try {
    const elemId = ElemID.fromFullName(ref)
    return elemId.adapter === ElemID.VARIABLES_NAMESPACE
      ? new VariableExpression(elemId)
      : new ReferenceExpression(elemId)
  } catch (e) {
    return new IllegalReference(ref, e.message)
  }
}

export const unescapeTemplateMarker = (text: string): string =>
  text.replace(/\\\$\{/gi, '${',)

export const registerRange = (
  context: ParseContext,
  id: ElemID,
  range: Omit<SourceRange, 'filename'>
): void => {
  if (context.calcSourceMap) {
    context.sourceMap.push(id.getFullName(), { ...range, filename: context.filename })
  }
}

export const addValuePromiseWatcher = (
  context: ParseContext,
  parent: Value,
  key: string | number
): void => {
  if (isPromise(parent[key])) {
    context.valuePromiseWatchers.push({ parent, key })
  }
}

export const replaceValuePromises = async (context: ParseContext): Promise<void> => {
  await Promise.all(context.valuePromiseWatchers.map(async watcher => {
    const { parent, key } = watcher
    parent[key] = await parent[key]
  }))
}

export const createFieldType = (context: ParseContext, blockType: string): TypeElement => {
  if (blockType.startsWith(Keywords.LIST_PREFIX)
        && blockType.endsWith(Keywords.GENERICS_SUFFIX)) {
    const listType = new ListType(createFieldType(
      context,
      blockType.substring(
        Keywords.LIST_PREFIX.length,
        blockType.length - Keywords.GENERICS_SUFFIX.length
      )
    ))
    context.listTypes[listType.elemID.getFullName()] = listType
    return listType
  }
  if (blockType.startsWith(Keywords.MAP_PREFIX) && blockType.endsWith(Keywords.GENERICS_SUFFIX)) {
    const mapType = new MapType(createFieldType(
      context,
      blockType.substring(
        Keywords.MAP_PREFIX.length,
        blockType.length - Keywords.GENERICS_SUFFIX.length
      )
    ))
    context.mapTypes[mapType.elemID.getFullName()] = mapType
    return mapType
  }
  return new ObjectType({ elemID: parseElemID(blockType) })
}

export const primitiveType = (typeName: string): PrimitiveTypes | undefined => {
  if (typeName === Keywords.TYPE_STRING) {
    return PrimitiveTypes.STRING
  }
  if (typeName === Keywords.TYPE_NUMBER) {
    return PrimitiveTypes.NUMBER
  }
  if (typeName === Keywords.TYPE_UNKNOWN) {
    return PrimitiveTypes.UNKNOWN
  }
  if (typeName === Keywords.TYPE_BOOL) {
    return PrimitiveTypes.BOOLEAN
  }
  return undefined
}
