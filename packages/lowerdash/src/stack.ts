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
