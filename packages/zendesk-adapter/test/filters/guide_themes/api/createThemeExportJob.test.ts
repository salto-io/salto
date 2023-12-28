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
import { createThemeExportJob } from '../../../../src/filters/guide_themes/api/createThemeExportJob'
import ZendeskClient from '../../../../src/client/client'
import { jobResponse } from '../utils'

describe('createThemeExportJob', () => {
  let client: ZendeskClient
  let mockPost: jest.SpyInstance

  beforeEach(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockPost = jest.spyOn(client, 'post')
  })

  it('should call the correct endpoint', async () => {
    mockPost.mockResolvedValue({ status: 202 })
    await createThemeExportJob('11', client)
    expect(mockPost).toHaveBeenCalledWith({
      url: '/api/v2/guide/theming/jobs/themes/exports',
      data: {
        job: {
          attributes: {
            theme_id: '11',
            format: 'zip',
          },
        },
      },
    })
  })

  describe('successful response', () => {
    it('returns a job on a correct response structure', async () => {
      mockPost.mockResolvedValue({ status: 202, data: jobResponse('pending') })
      expect(await createThemeExportJob('11', client)).toEqual(jobResponse('pending').job)
    })

    it('returns false on non-pending job', async () => {
      mockPost.mockResolvedValue({ status: 202, data: jobResponse('completed') })
      expect(await createThemeExportJob('11', client)).toBeFalsy()
    })

    it('returns false on wrong response structure', async () => {
      mockPost.mockResolvedValue({ status: 202, data: { nope: 'yup' } })
      expect(await createThemeExportJob('11', client)).toBeFalsy()
    })
  })

  describe('response failure', () => {
    it('returns false on wrong status code', async () => {
      mockPost.mockResolvedValue({ status: 400, data: jobResponse('pending') })
      expect(await createThemeExportJob('11', client)).toBeFalsy()
    })
  })
})
