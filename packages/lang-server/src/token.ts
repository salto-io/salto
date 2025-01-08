/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
