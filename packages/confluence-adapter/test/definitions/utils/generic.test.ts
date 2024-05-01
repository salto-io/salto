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

import { validateValue } from '../../../src/definitions/utils'

describe('generic definitions utils', () => {
  describe('validateValue', () => {
    it('should return the value if it is an object', () => {
      const value = { key: 'value' }
      expect(validateValue(value)).toEqual(value)
    })

    it('should throw an error if the value is not an object', () => {
      expect(() => validateValue('not an object')).toThrow()
    })
  })
})
