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
import ZendeskClient from '../../../src/client/client'
import * as exportModule from '../../../src/filters/guide_themes/api/createThemeExportJob'
import * as pollModule from '../../../src/filters/guide_themes/api/pollJobStatus'
import { download } from '../../../src/filters/guide_themes/download'
import { jobResponse } from './utils'

describe('download', () => {
  let client: ZendeskClient
  let mockCreateThemeExportJob: jest.SpyInstance
  let mockPollJobStatus: jest.SpyInstance
  let mockGetResource: jest.SpyInstance

  beforeEach(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockPollJobStatus = jest.spyOn(pollModule, 'pollJobStatus')
    mockCreateThemeExportJob = jest.spyOn(exportModule, 'createThemeExportJob')
    mockGetResource = jest.spyOn(client, 'getResource')
  })

  describe('successful flow', () => {
    beforeEach(() => {
      mockCreateThemeExportJob.mockResolvedValue(jobResponse('pending', 'this is actually a URL').job)
      mockPollJobStatus.mockResolvedValue(true)
    })

    it('sends the correct request', async () => {
      mockGetResource.mockResolvedValue({ status: 202, data: 1234 })
      await download('11', client)
      expect(mockGetResource).toHaveBeenCalledWith({ url: 'this is actually a URL', responseType: 'arraybuffer' })
    })

    it('returns Buffer of data on string response', async () => {
      mockGetResource.mockResolvedValue({ status: 202, data: 'much data, so good' })
      expect(await download('11', client)).toEqual(Buffer.from('much data, so good'))
    })

    it('returns response data on Buffer response', async () => {
      mockGetResource.mockResolvedValue({ status: 202, data: Buffer.from('much data, so good') })
      expect(await download('11', client)).toEqual(Buffer.from('much data, so good'))
    })

    it('returns undefined on other response data types', async () => {
      mockGetResource.mockResolvedValue({ status: 202, data: 1234 })
      expect(await download('11', client)).toEqual(undefined)
    })
  })

  describe('flow failure', () => {
    it('returns undefined when createThemeExportJob fails', async () => {
      mockCreateThemeExportJob.mockResolvedValue(undefined)
      expect(await download('11', client)).toEqual(undefined)
    })

    it('returns undefined when pollJobStatus returns false', async () => {
      mockCreateThemeExportJob.mockResolvedValue(jobResponse('pending').job)
      mockPollJobStatus.mockResolvedValue(false)
      expect(await download('11', client)).toEqual(undefined)
    })
  })
})
