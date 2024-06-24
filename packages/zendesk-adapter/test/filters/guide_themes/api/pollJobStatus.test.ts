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
import ZendeskClient from '../../../../src/client/client'
import { pollJobStatus } from '../../../../src/filters/guide_themes/api/pollJobStatus'
import { downloadJobResponse } from '../helpers'

describe('pollJobStatus', () => {
  let client: ZendeskClient
  let mockGet: jest.SpyInstance

  beforeEach(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockGet = jest.spyOn(client, 'get')
  })

  describe('successful response', () => {
    it('returns true on a correct response structure', async () => {
      mockGet.mockResolvedValue({ status: 202, data: downloadJobResponse('completed') })
      expect(await pollJobStatus('11', client, 200, 1)).toBeTruthy()
    })

    it('returns true and retries on pending job', async () => {
      mockGet.mockResolvedValueOnce({ status: 202, data: downloadJobResponse('pending') })
      mockGet.mockResolvedValueOnce({ status: 202, data: downloadJobResponse('completed') })
      expect(await pollJobStatus('11', client, 200, 2)).toBeTruthy()
      expect(mockGet).toHaveBeenCalledTimes(2)
    })

    it('returns false on failed job', async () => {
      mockGet.mockResolvedValue({
        status: 202,
        data: {
          job: {
            id: '1',
            status: 'failed',
            errors: [{ title: 'error1', code: 'code1', message: 'message1', meta: {} }],
          },
        },
      })
      expect(await pollJobStatus('11', client, 200, 1)).toEqual({
        success: false,
        errors: ['code1 - message1'],
      })
    })

    it('returns false on wrong response structure', async () => {
      mockGet.mockResolvedValue({ status: 202, data: { nope: 'yup' } })
      expect(await pollJobStatus('11', client, 200, 1)).toEqual({
        success: false,
        errors: ['Got an invalid response for Guide Theme job status. Job ID: 11'],
      })
    })
  })

  describe('response failure', () => {
    it('throws on wrong status code after retries', async () => {
      mockGet.mockResolvedValue({ status: 400, data: downloadJobResponse('pending') })
      expect(await pollJobStatus('11', client, 200, 1)).toEqual({
        success: false,
        errors: ['Error while waiting: max retries 1 exceeded'],
      })
    })
  })
})
