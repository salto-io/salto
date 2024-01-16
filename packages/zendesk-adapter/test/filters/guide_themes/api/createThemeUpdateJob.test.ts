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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import ZendeskClient from '../../../../src/client/client'
import { createThemeUpdateJob } from '../../../../src/filters/guide_themes/api/createThemeUpdateJob'
import { downloadJobResponse } from '../helpers'

describe('createThemeUpdateJob', () => {
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
    await createThemeUpdateJob('11', true, client)
    expect(mockPost).toHaveBeenCalledWith({
      url: '/api/v2/guide/theming/jobs/themes/updates',
      data: {
        job: {
          attributes: {
            theme_id: '11',
            replace_settings: true,
            format: 'zip',
          },
        },
      },
    })
  })

  describe('successful response', () => {
    it('returns a job on a correct response structure', async () => {
      mockPost.mockResolvedValue({ status: 202, data: downloadJobResponse('pending') })
      expect(await createThemeUpdateJob('11', true, client)).toEqual({ job: downloadJobResponse('pending').job, errors: [] })
    })

    it('returns false on non-pending job', async () => {
      mockPost.mockResolvedValue({ status: 202, data: downloadJobResponse('completed') })
      expect(await createThemeUpdateJob('11', true, client)).toEqual({ job: undefined, errors: [] })
    })

    it('returns false on wrong response structure', async () => {
      mockPost.mockResolvedValue({ status: 202, data: { nope: 'yup' } })
      expect(await createThemeUpdateJob('11', true, client)).toEqual({ job: undefined, errors: [] })
    })
  })

  describe('response failure', () => {
    it('returns error response on wrong status code', async () => {
      mockPost.mockResolvedValue({ status: 400, data: downloadJobResponse('pending') })
      expect(await createThemeUpdateJob('11', true, client)).toEqual({ job: undefined, errors: [safeJsonStringify(downloadJobResponse('pending'))] })
    })
  })
})
