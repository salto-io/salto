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
import os from 'os'
import wu from 'wu'
import _ from 'lodash'
import { parser } from '@salto-io/parser'
import { EditorPosition } from './context'

export type Token = Pick<parser.Token, 'value' | 'type'>

export const getToken = (fileContent: string, position: EditorPosition): Token | undefined => {
  const lines = fileContent.split(os.EOL)
  if (lines.length <= position.line) {
    return undefined
  }
  // This is done to avoid parsing the entire file
  // and cause us to not support multiline tokens
  const line = lines[position.line]
  const lexerToken = wu(parser.tokenizeContent(line)).find(
    token => token.col - 1 <= position.col && position.col < token.col + token.value.length,
  )
  if (lexerToken === undefined) {
    return undefined
  }
  return _.pick(lexerToken, ['value', 'type'])
}
