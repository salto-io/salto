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
import { getAdminUrl } from '../../src/client/admin'

describe('admin', () => {
  describe('getAdminUrl', () => {
    it('should return base url with -admin', () => {
      const baseUrl = 'https://dev-num1.okta.com/'
      const previewUrl = 'https://okta123.oktapreview.com/'
      const baseUrlOfPage = 'https://subdomain1.oktapreview.com/login/default'
      expect(getAdminUrl(baseUrl)).toEqual('https://dev-num1-admin.okta.com/')
      expect(getAdminUrl(previewUrl)).toEqual('https://okta123-admin.oktapreview.com/')
      expect(getAdminUrl(baseUrlOfPage)).toEqual('https://subdomain1-admin.oktapreview.com/login/default')
    })
    it('should not try to add another -admin suffix if it already exists', () => {
      const baseUrl = 'https://some-company-admin.okta.com/'
      expect(getAdminUrl(baseUrl)).toEqual(baseUrl)
    })
    it('should return undefined if base url is in unexpected format', () => {
      const baseUrl = 'https://dev-num1okta.com/'
      expect(getAdminUrl(baseUrl)).toEqual(undefined)
    })
  })
})
