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
