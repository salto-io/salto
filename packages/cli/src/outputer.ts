/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { StepEmitter } from '@salto-io/core'
import { EOL } from 'os'
import { logger } from '@salto-io/logging'
import { CliOutput } from './types'
import { formatStepStart, formatStepCompleted, formatStepFailed } from './formatter'

const log = logger(module)

export const outputLine = (text: string, output: CliOutput): void => {
  if (text === '') {
    return
  }

  output.stdout.write(`${text}\n`)
  log.debug(text)
}
export const errorOutputLine = (text: string, output: CliOutput): void => {
  output.stderr.write(`${text}\n`)
  log.debug(text)
}
export const progressOutputer =
  <T>(startText: string, successCallback: (params: T) => string, defaultErrorText: string, output: CliOutput) =>
  (progress: StepEmitter<T>) => {
    outputLine(EOL, output)
    outputLine(formatStepStart(startText), output)
    progress.on('completed', (params: T) => outputLine(formatStepCompleted(successCallback(params)), output))
    progress.on('failed', (errorText?: string) => {
      outputLine(formatStepFailed(errorText ?? defaultErrorText), output)
      outputLine(EOL, output)
    })
  }
