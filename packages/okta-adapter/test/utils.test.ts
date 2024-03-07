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
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { mockClient } from './utils'
import OktaClient from '../src/client/client'
import { extractIdFromUrl, isClassicEngineOrg, validateOktaBaseUrl } from '../src/utils'

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
  describe('isClassicEngineOrg', () => {
    let mockConnection: MockInterface<clientUtils.APIConnection>
    let client: OktaClient

    beforeEach(() => {
      jest.clearAllMocks()
      const { client: cli, connection } = mockClient()
      mockConnection = connection
      client = cli
    })
    it('should return true for classic engine org', async () => {
      mockConnection.get.mockResolvedValue({ status: 200, data: { pipeline: 'v1' } })
      expect(await isClassicEngineOrg(client)).toBeTruthy()
    })
    it('should return false for identity engine org', async () => {
      mockConnection.get.mockResolvedValue({ status: 200, data: { pipeline: 'idx' } })
      expect(await isClassicEngineOrg(client)).toBeFalsy()
    })
    it('should return false for invalid response', async () => {
      mockConnection.get.mockResolvedValue({ status: 200, data: { org: 'org' } })
      expect(await isClassicEngineOrg(client)).toBeFalsy()
    })
    it('should return false for error', async () => {
      mockConnection.get.mockRejectedValue(new Error('error'))
      expect(await isClassicEngineOrg(client)).toBeFalsy()
    })
  })
  describe('validateOktaBaseUrl', () => {
    it('should throw error for invalid url', () => {
      expect(() => validateOktaBaseUrl('http://some.okta.com')).toThrow()
      expect(() => validateOktaBaseUrl('https://some-account.salesforce.com')).toThrow()
      expect(() => validateOktaBaseUrl('https://localhost:8080')).toThrow()
    })
    it('should not throw error for valid url', () => {
      expect(() => validateOktaBaseUrl('https://oktaDomain.okta.com/')).not.toThrow()
      expect(() => validateOktaBaseUrl('https://o-k-t-a.oktapreview.com')).not.toThrow()
    })
  })
})
