/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { findDuplicates } from '../../src/config/validation_utils'

describe('validation_utils', () => {
  describe('findDuplicates', () => {
    it('should return empty array when no duplicates are found', () => {
      expect(findDuplicates([])).toEqual([])
      expect(findDuplicates(['abc', 'def', 'abd', 'aaabbb'])).toEqual([])
    })

    it('should return sorted array with each duplicate appearing once when duplicates are found', () => {
      expect(findDuplicates(['def', 'abc', 'def', 'abd', 'aaa', 'def', 'abc'])).toEqual(['abc', 'def'])
    })
  })
})
