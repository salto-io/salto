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
const toContainColors: (received?: unknown) => { message(): string; pass: boolean } = received =>
  typeof received === 'string' && received.includes('\u001b[')
    ? { pass: true, message: () => `expected "${received}" not to contain colors` }
    : { pass: false, message: () => `expected "${received} to contain colors` }

// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars
declare namespace jest {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R, T> {
    toContainColors: typeof toContainColors
  }
}

expect.extend({ toContainColors })
