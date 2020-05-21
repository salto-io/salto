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
import { Element, Value, Values, TypeMap } from '@salto-io/adapter-api'
import { SourceMap } from '../../source_map'
import { SourceRange } from '../types'

export type Token = LexerToken | InternalParseRes<Value>

export type NearleyErrorToken = Partial<InternalParseRes<Value> & LexerToken>

export class NearleyError extends Error {
  constructor(
    public token: NearleyErrorToken,
    public offset: number,
    message: string
  ) {
    super(message)
  }
}

export class IllegalReference {
  constructor(public ref: string, public message: string) {}
}

export interface FuncWatcher {
    parent: Value
    key: string | number
  }

export interface InternalParseRes<T> {
    value: T
    source: SourceRange
    sourceMap?: SourceMap
  }

export type AttrData = [string, Value]

export type FieldData = {
    annotations: Values
    type: string
    name: string
  }

export type TopLevelElementData = {
    elements: Element[]
    sourceMap: SourceMap
  }

export type ElementItem = AttrData | FieldData | TypeMap

export interface LexerToken {
    type: string
    value: string
    text: string
    line: number
    lineBreaks: number
    col: number
    offset: number
}


export const isLexerToken = (token: Token): token is LexerToken => 'value' in token
    && 'text' in token
    && 'line' in token
    && 'col' in token
    && 'offset' in token
