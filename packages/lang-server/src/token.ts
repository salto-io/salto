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
import os from 'os'
import { parser } from '@salto-io/workspace'
import { EditorPosition } from './context'

export type Token = {
  value: string
  type: string
}

export const getToken = (fileContent: string, position: EditorPosition):
  Token | undefined => {
  const lines = fileContent.split(os.EOL)
  if (lines.length <= position.line) {
    return undefined
  }
  const line = lines[position.line]

  const lexer = new parser.PeekableLexer(line)
  try {
    while (true) {
      const token = lexer.next()
      const col = token.col - 1
      if (col <= position.col && position.col < col + token.value.length) {
        return { value: token.value, type: token.type }
      }
      if (col > position.col) {
        return undefined
      }
    }
  // eslint-disable-next-line no-empty
  } catch (e) {
  }
  return undefined
}
