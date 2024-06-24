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
import ZendeskClient from '../../../src/client/client'
import * as importModule from '../../../src/filters/guide_themes/api/createThemeJob'
import * as pollModule from '../../../src/filters/guide_themes/api/pollJobStatus'
import { create } from '../../../src/filters/guide_themes/create'
import * as createModule from '../../../src/filters/guide_themes/utils'
import { uploadJobResponse } from './helpers'

describe('create', () => {
  let client: ZendeskClient
  let mockCreateThemeImportJob: jest.SpyInstance
  let mockPollJobStatus: jest.SpyInstance
  let mockCreateAndUploadThemePackage: jest.SpyInstance

  const staticFiles = [
    { filename: 'a.txt', content: Buffer.from('a') },
    { filename: 'b.txt', content: Buffer.from('b') },
  ]

  beforeEach(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockPollJobStatus = jest.spyOn(pollModule, 'pollJobStatus')
    mockCreateThemeImportJob = jest.spyOn(importModule, 'createThemeJob')
    mockCreateAndUploadThemePackage = jest.spyOn(createModule, 'createAndUploadThemePackage')
  })

  describe('successful flow', () => {
    describe('no errors', () => {
      beforeEach(() => {
        mockCreateThemeImportJob.mockResolvedValue({
          job: uploadJobResponse('pending', 'this is actually a URL').job,
          errors: [],
        })
        mockCreateAndUploadThemePackage.mockResolvedValue({ errors: [] })
        mockPollJobStatus.mockResolvedValue({ success: true, errors: [] })
      })

      it('returns the created themeId', async () => {
        expect(await create({ staticFiles, brandId: 11 }, client)).toEqual({ themeId: 'abc', errors: [] })
        expect(mockCreateThemeImportJob).toHaveBeenCalledTimes(1)
        expect(mockCreateAndUploadThemePackage).toHaveBeenCalledTimes(1)
        expect(mockPollJobStatus).toHaveBeenCalledTimes(1)
      })
    })

    describe('with errors', () => {
      beforeEach(() => {
        mockCreateThemeImportJob.mockResolvedValue({
          job: uploadJobResponse('pending', 'this is actually a URL').job,
          errors: ['error1'],
        })
        mockCreateAndUploadThemePackage.mockResolvedValue({ errors: ['error2'] })
        mockPollJobStatus.mockResolvedValue({ success: true, errors: ['error3'] })
      })

      it('returns the aggregated errors', async () => {
        expect(await create({ staticFiles, brandId: 11 }, client)).toEqual({
          themeId: 'abc',
          errors: ['error1', 'error2', 'error3'],
        })
      })
    })
  })

  describe('flow failure', () => {
    it('returns undefined when createThemeImportJob fails', async () => {
      mockCreateThemeImportJob.mockResolvedValue({ job: undefined, errors: ['error1'] })
      expect(await create({ staticFiles, brandId: 11 }, client)).toEqual({ content: undefined, errors: ['error1'] })
    })
  })
})
