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
import { Value } from '@salto-io/adapter-api'
import { Functions } from '../../functions'
import { FuncWatcher, isLexerToken, InternalParseRes, Token } from './types'
import { SourceRange } from '../types'

let currentFilename: string
let currentFunctions: Functions
let allowWildcard = false
let funcWatchers: FuncWatcher[] = []


export const startParse = (filename: string, functions: Functions): void => {
  currentFilename = filename
  currentFunctions = functions
  allowWildcard = false
}

export const getCurrentFunctions = (): Functions => currentFunctions

export const getAllowWildcard = (): boolean => allowWildcard

export const replaceFunctionValues = async (): Promise<void> => {
  await Promise.all(funcWatchers.map(async watcher => {
    const { parent, key } = watcher
    parent[key] = await parent[key]
  }))
  funcWatchers = []
}

export const setErrorRecoveryMode = (): void => {
  allowWildcard = true
}

export const addFuncWatcher = (parent: Value, key: string | number): void => {
  if (parent[key].then) {
    funcWatchers.push({ parent, key })
  }
}

export const createSourceRange = (st: Token, et: Token): SourceRange => {
  const start = isLexerToken(st)
    ? { line: st.line, col: st.col, byte: st.offset }
    : (st as InternalParseRes<Value>).source.start
  const end = isLexerToken(et)
    ? {
      line: et.line + et.lineBreaks,
      col: et.lineBreaks === 0 ? et.col + et.text.length : et.text.length - et.text.lastIndexOf('\n'),
      byte: et.offset + et.text.length,
    }
    : (et as InternalParseRes<Value>).source.end
  return { filename: currentFilename, start, end }
}
