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
import { isFullRegexMatch, isValidRegex } from '../src/regex'

describe('regex', () => {
  describe('isValidRegex', () => {
    it('should return false for an invalid regex string', () => {
      expect(isValidRegex('\\')).toBeFalsy()
    })

    it('should return true for a valid regex', () => {
      expect(isValidRegex('validRegex')).toBeTruthy()
    })
  })

  describe('isFullRegexMatch', () => {
    it('should return false if not full match', () => {
      expect(isFullRegexMatch('ab', 'b.*')).toBeFalsy()
    })

    it('should return true if full match', () => {
      expect(isFullRegexMatch('ab', 'ab.*')).toBeTruthy()
    })
  })
})
