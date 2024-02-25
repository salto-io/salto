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
import { StepEmitter } from '@salto-io/core'
import { EOL } from 'os'
import { logger } from '@salto-io/logging'
import { CliOutput } from './types'
import { formatStepStart, formatStepCompleted, formatStepFailed } from './formatter'

const log = logger(module)

export const outputLine = (text: string, output: CliOutput): void => {
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
