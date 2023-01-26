/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { extractIdFromUrl } from '../src/utils'

describe('okta utils', () => {
  describe('extractIdFromUrl', () => {
    it('should return correct id', () => {
      const link = 'https://oktaDomain.okta.com/1/2/1234567'
      const link2 = 'https://oktaDomain.okta.com/1/2/1234567/okta/a/abc123'
      const invalidLink = '123123'
      expect(extractIdFromUrl(link)).toEqual('1234567')
      expect(extractIdFromUrl(link2)).toEqual('abc123')
      expect(extractIdFromUrl(invalidLink)).toBeUndefined()
    })
  })
})
