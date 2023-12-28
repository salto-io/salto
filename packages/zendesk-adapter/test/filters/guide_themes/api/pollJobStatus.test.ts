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
import ZendeskClient from '../../../../src/client/client'
import { pollJobStatus } from '../../../../src/filters/guide_themes/api/pollJobStatus'
import { jobResponse } from '../utils'

describe('pollJobStatus', () => {
  let client: ZendeskClient
  let mockGet: jest.SpyInstance

  beforeEach(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockGet = jest.spyOn(client, 'getSinglePage')
  })

  describe('successful response', () => {
    it('returns true on a correct response structure', async () => {
      mockGet.mockResolvedValue({ status: 202, data: jobResponse('completed') })
      expect(await pollJobStatus('11', client, 200, 1)).toBeTruthy()
    })

    it('returns true and retries on pending job', async () => {
      mockGet.mockResolvedValueOnce({ status: 202, data: jobResponse('pending') })
      mockGet.mockResolvedValueOnce({ status: 202, data: jobResponse('completed') })
      expect(await pollJobStatus('11', client, 200, 2)).toBeTruthy()
      expect(mockGet).toHaveBeenCalledTimes(2)
    })

    it('returns false on failed job', async () => {
      mockGet.mockResolvedValue({ status: 202, data: { job: { id: '1', status: 'failed', errors: [] } } })
      expect(await pollJobStatus('11', client, 200, 1)).toBeFalsy()
    })

    it('returns false on wrong response structure', async () => {
      mockGet.mockResolvedValue({ status: 202, data: { nope: 'yup' } })
      expect(await pollJobStatus('11', client, 200, 1)).toBeFalsy()
    })
  })

  describe('response failure', () => {
    it('throws on wrong status code after retries', async () => {
      mockGet.mockResolvedValue({ status: 400, data: jobResponse('pending') })
      await expect(pollJobStatus('11', client, 200, 1)).rejects.toThrow(new Error('Error while waiting: max retries 1 exceeded'))
    })
  })
})
