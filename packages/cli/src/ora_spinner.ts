/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import ora from 'ora'
import { Spinner, SpinnerCreator, SpinnerOptions } from './types'

type Dependencies = {
  outputStream: NodeJS.WritableStream
}

const oraSpinnerCreator =
  (deps: Dependencies): SpinnerCreator =>
  (startText: string, { color, prefixText, hideCursor, indent }: SpinnerOptions): Spinner => {
    const oraSpinner = ora({
      stream: deps.outputStream,
      color,
      prefixText,
      hideCursor,
      indent,
    }).start(startText)
    return {
      succeed: (text: string): void => {
        oraSpinner.succeed(text)
      },
      fail: (text: string): void => {
        oraSpinner.fail(text)
      },
    }
  }

export default oraSpinnerCreator
