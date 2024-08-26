/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { parse as parseStack } from 'stacktrace-parser'

export const extractCallerFilename = (error: Error, caleePartialFilename: string): string | undefined => {
  const { stack } = error
  if (stack === undefined) {
    return undefined
  }

  const frames = parseStack(stack)
  let prevFilename: string | undefined
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const { file } = frames[i]
    // istanbul ignore else
    if (file) {
      if (file.includes(caleePartialFilename)) {
        return prevFilename
      }
      prevFilename = file
    }
  }
  return undefined
}
