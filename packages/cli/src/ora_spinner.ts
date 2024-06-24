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
import ora from 'ora'
import { Spinner, SpinnerCreator, SpinnerOptions } from './types'

export type Dependencies = {
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
