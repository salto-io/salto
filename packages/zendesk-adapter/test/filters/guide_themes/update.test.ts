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
import * as updateModule from '../../../src/filters/guide_themes/api/createThemeUpdateJob'
import * as pollModule from '../../../src/filters/guide_themes/api/pollJobStatus'
import { update } from '../../../src/filters/guide_themes/update'
import * as utilsModule from '../../../src/filters/guide_themes/utils'
import { uploadJobResponse } from './helpers'

describe('update', () => {
  let client: ZendeskClient
  let mockUpdateThemeUpdateJob: jest.SpyInstance
  let mockPollJobStatus: jest.SpyInstance
  let mockUpdateAndUploadThemePackage: jest.SpyInstance

  const staticFiles = [
    { filename: 'a.txt', content: Buffer.from('a') },
    { filename: 'b.txt', content: Buffer.from('b') },
  ]

  beforeEach(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockPollJobStatus = jest.spyOn(pollModule, 'pollJobStatus')
    mockUpdateThemeUpdateJob = jest.spyOn(updateModule, 'createThemeUpdateJob')
    mockUpdateAndUploadThemePackage = jest.spyOn(utilsModule, 'createAndUploadThemePackage')
  })

  describe('successful flow', () => {
    describe('no errors', () => {
      beforeEach(() => {
        mockUpdateThemeUpdateJob.mockResolvedValue({
          job: uploadJobResponse('pending', 'this is actually a URL').job, errors: [],
        })
        mockUpdateAndUploadThemePackage.mockResolvedValue({ errors: [] })
        mockPollJobStatus.mockResolvedValue({ success: true, errors: [] })
      })

      it('returns empty errors', async () => {
        expect(await update({ staticFiles, themeId: '11' }, client)).toEqual({ errors: [] })
      })
    })

    describe('with errors', () => {
      beforeEach(() => {
        mockUpdateThemeUpdateJob.mockResolvedValue({
          job: uploadJobResponse('pending', 'this is actually a URL').job, errors: ['error1'],
        })
        mockUpdateAndUploadThemePackage.mockResolvedValue({ errors: ['error2'] })
        mockPollJobStatus.mockResolvedValue({ success: true, errors: ['error3'] })
      })

      it('returns the aggregated errors', async () => {
        expect(await update({ staticFiles, themeId: '11' }, client)).toEqual({ errors: ['error1', 'error2', 'error3'] })
      })
    })
  })

  describe('flow failure', () => {
    it('returns undefined when updateThemeImportJob fails', async () => {
      mockUpdateThemeUpdateJob.mockResolvedValue({ job: undefined, errors: ['error1'] })
      expect(await update({ staticFiles, themeId: '11' }, client))
        .toEqual({ content: undefined, errors: ['error1'] })
    })
  })
})
