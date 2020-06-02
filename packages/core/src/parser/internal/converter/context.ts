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
import { types } from 'util'
import { Value } from '@salto-io/adapter-api'
import { Functions } from '../../functions'
import { ValuePromiseWatcher, isLexerToken, InternalParseRes, Token } from './types'
import { SourceRange } from '../types'

let currentFilename: string
let currentFunctions: Functions
let allowWildcard = false
let valuePromiseWatchers: ValuePromiseWatcher[] = []


export const startParse = (filename: string, functions: Functions): void => {
  currentFilename = filename
  currentFunctions = functions
  allowWildcard = false
}

export const getCurrentFunctions = (): Functions => currentFunctions

export const getAllowWildcard = (): boolean => allowWildcard

export const replaceValuePromises = async (): Promise<void> => {
  await Promise.all(valuePromiseWatchers.map(async watcher => {
    const { parent, key } = watcher
    parent[key] = await parent[key]
  }))
  valuePromiseWatchers = []
}

export const setErrorRecoveryMode = (): void => {
  allowWildcard = true
}

export const addValuePromiseWatcher = (parent: Value, key: string | number): void => {
  if (types.isPromise(parent[key])) {
    valuePromiseWatchers.push({ parent, key })
  }
}

export const createSourceRange = (startToken: Token, endToken?: Token): SourceRange => {
  const actualEndToken = endToken ?? startToken
  const start = isLexerToken(startToken)
    ? { line: startToken.line, col: startToken.col, byte: startToken.offset }
    : (startToken as InternalParseRes<Value>).source.start
  const end = isLexerToken(actualEndToken)
    ? {
      line: actualEndToken.line + actualEndToken.lineBreaks,
      col: actualEndToken.lineBreaks === 0 ? actualEndToken.col + actualEndToken.text.length : actualEndToken.text.length - actualEndToken.text.lastIndexOf('\n'),
      byte: actualEndToken.offset + actualEndToken.text.length,
    }
    : (actualEndToken as InternalParseRes<Value>).source.end
  return { filename: currentFilename, start, end }
}
