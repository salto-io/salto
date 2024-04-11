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

import { validateItemValue } from '../../../src/definitions/fetch/transforms/validators'

describe('validateItemValue', () => {
  it('should throw an error when the value is not an object', () => {
    expect(() => validateItemValue([])).toThrow('Unexpected item value: [], expected object')
  })

  it('should throw an error when the value is undefined', () => {
    expect(() => validateItemValue(undefined)).toThrow('Unexpected item value: undefined, expected object')
  })

  it('should throw an error when the value is null', () => {
    expect(() => validateItemValue(null)).toThrow('Unexpected item value: null, expected object')
  })

  it('should not throw an error when the value is an object', () => {
    expect(() => validateItemValue({})).not.toThrow()
  })
})
