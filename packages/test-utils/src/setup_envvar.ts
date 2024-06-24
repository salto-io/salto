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
export const setupEnvVar = (
  name: string,
  valueOrFactory:
    | string
    | number
    | undefined
    | (() => string | number | undefined | Promise<string | number | undefined>) = undefined,
  setupType: 'each' | 'all' = 'each',
): void => {
  const [setupFunc, teardownFunc] = setupType === 'all' ? [beforeAll, afterAll] : [beforeEach, afterEach]

  let savedValue: string | undefined
  setupFunc(async () => {
    const value = typeof valueOrFactory === 'function' ? await valueOrFactory() : valueOrFactory

    savedValue = process.env[name]
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = String(value)
    }
  })

  teardownFunc(() => {
    if (savedValue === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = savedValue
    }
  })
}
