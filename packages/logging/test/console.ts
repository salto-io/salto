/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { DestinationStream } from 'pino'

export type MockWritableStream = DestinationStream & {
  contents(): string
  isTTY: true
  getColorDepth: () => number
  supportsColor: boolean
}

export const mockConsoleStream = (supportsColor: boolean): MockWritableStream => {
  let contents = ''
  return {
    write: s => {
      contents += s
    },
    supportsColor,
    isTTY: true,
    getColorDepth(): number {
      return this.supportsColor ? 16 : 0
    },
    contents(): string {
      return contents
    },
  }
}
