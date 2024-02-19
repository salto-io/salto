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
