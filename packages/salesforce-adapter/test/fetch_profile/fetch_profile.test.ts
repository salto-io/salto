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

import { validateFetchParameters } from '../../src/fetch_profile/fetch_profile'

describe('Fetch Profile', () => {
  describe('validateFetchParameters', () => {
    describe('when additional important values contain duplicate definitions', () => {
      it('should throw an error', () => {
        const params = {
          additionalImportantValues: [
            { value: 'fullName', highlighted: true, indexed: false },
            { value: 'fullName', highlighted: true, indexed: true },
          ],
        }
        expect(() => validateFetchParameters(params, [])).toThrow()
      })
    })
    describe('when additional important values are valid', () => {
      it('should not throw an error', () => {
        const params = {
          additionalImportantValues: [
            { value: 'fullName', highlighted: true, indexed: false },
            { value: 'label', highlighted: true, indexed: true },
          ],
        }
        expect(() => validateFetchParameters(params, [])).not.toThrow()
      })
    })
  })
})
