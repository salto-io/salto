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
import { StepEmitter } from '@salto-io/core'
import { EOL } from 'os'
import { CliOutput } from './types'
import { formatStepStart, formatStepCompleted, formatStepFailed } from './formatter'

export const outputLine = (text: string, output: CliOutput): void => output.stdout.write(`${text}\n`)
export const progressOutputer = (
  startText: string,
  successText: string,
  defaultErrorText: string,
  output: CliOutput
) => (progress: StepEmitter) => {
  outputLine(EOL, output)
  outputLine(formatStepStart(startText), output)
  progress.on('completed', () => outputLine(formatStepCompleted(successText), output))
  progress.on('failed', (errorText?: string) => {
    outputLine(formatStepFailed(errorText ?? defaultErrorText), output)
    outputLine(EOL, output)
  })
}
