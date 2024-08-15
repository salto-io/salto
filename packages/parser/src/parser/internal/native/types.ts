/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Value, ListType, MapType } from '@salto-io/adapter-api'
import { ParseError } from '../../types'
import { SourceRange } from '../types'
import Lexer from './lexer'
import { Functions } from '../../functions'
import { SourceMap } from '../../source_map'

export type ValuePromiseWatcher = {
  parent: Value
  key: string | number
}

export type ConsumerReturnType<T> = {
  value: T
  range: Omit<SourceRange, 'filename'>
}

export type ParseContext = {
  filename: string
  lexer: Lexer
  errors: ParseError[]
  listTypes: Record<string, ListType>
  mapTypes: Record<string, MapType>
  functions: Functions
  sourceMap: SourceMap
  calcSourceMap: boolean
  valuePromiseWatchers: ValuePromiseWatcher[]
}

export type Consumer<T> = (context: ParseContext) => ConsumerReturnType<T>
