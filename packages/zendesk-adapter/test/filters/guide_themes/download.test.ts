/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { safeJsonStringify } from '@salto-io/adapter-utils'
import ZendeskClient from '../../../src/client/client'
import * as exportModule from '../../../src/filters/guide_themes/api/createThemeJob'
import * as pollModule from '../../../src/filters/guide_themes/api/pollJobStatus'
import { download } from '../../../src/filters/guide_themes/download'
import { downloadJobResponse } from './helpers'

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
    mockCreateThemeExportJob = jest.spyOn(exportModule, 'createThemeJob')
    mockGetResource = jest.spyOn(client, 'getResource')
  })

  describe('successful flow', () => {
    beforeEach(() => {
      mockCreateThemeExportJob.mockResolvedValue({
        job: downloadJobResponse('pending', 'this is actually a URL').job,
        errors: [],
      })
      mockPollJobStatus.mockResolvedValue({ success: true, errors: [] })
    })

    it('sends the correct request', async () => {
      mockGetResource.mockResolvedValue({ status: 202, data: 1234 })
      await download('11', client)
      expect(mockGetResource).toHaveBeenCalledWith({ url: 'this is actually a URL', responseType: 'arraybuffer' })
    })

    it('returns Buffer of data on string response', async () => {
      mockGetResource.mockResolvedValue({ status: 202, data: 'much data, so good' })
      expect(await download('11', client)).toEqual({ content: Buffer.from('much data, so good'), errors: [] })
    })

    it('returns response data on Buffer response', async () => {
      mockGetResource.mockResolvedValue({ status: 202, data: Buffer.from('much data, so good') })
      expect(await download('11', client)).toEqual({ content: Buffer.from('much data, so good'), errors: [] })
    })

    it('returns undefined on other response data types', async () => {
      mockGetResource.mockResolvedValue({ status: 202, data: 1234 })
      expect(await download('11', client)).toEqual({ content: undefined, errors: [safeJsonStringify(1234)] })
    })
  })

  describe('flow failure', () => {
    it('returns undefined when createThemeExportJob fails', async () => {
      mockCreateThemeExportJob.mockResolvedValue({ job: undefined, errors: ['error1'] })
      expect(await download('11', client)).toEqual({ content: undefined, errors: ['error1'] })
    })

    it('returns undefined when pollJobStatus returns false', async () => {
      mockCreateThemeExportJob.mockResolvedValue({ job: downloadJobResponse('pending').job, errors: [] })
      mockPollJobStatus.mockResolvedValue({ success: false, errors: ['error1'] })
      expect(await download('11', client)).toEqual({ content: undefined, errors: ['error1'] })
    })
  })
})
