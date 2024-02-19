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
import { createThemeJob, JobType } from '../../../../src/filters/guide_themes/api/createThemeJob'
import { downloadJobResponse } from '../helpers'

describe('createThemeJob', () => {
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
      await createThemeJob('11', client, JobType.EXPORTS)
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
      expect(mockPost).toHaveBeenCalledTimes(1)
    })

    describe('successful response', () => {
      it('returns a job on a correct response structure', async () => {
        mockPost.mockResolvedValue({ status: 202, data: downloadJobResponse('pending') })
        expect(await createThemeJob('11', client, JobType.EXPORTS)).toEqual({
          job: downloadJobResponse('pending').job,
          errors: [],
        })
      })

      it('returns undefined job on non-pending job', async () => {
        mockPost.mockResolvedValue({ status: 202, data: downloadJobResponse('completed') })
        expect(await createThemeJob('11', client, JobType.EXPORTS)).toEqual({ job: undefined, errors: [] })
      })

      it('returns undefined job on wrong response structure', async () => {
        mockPost.mockResolvedValue({ status: 202, data: { nope: 'yup' } })
        expect(await createThemeJob('11', client, JobType.EXPORTS)).toEqual({ job: undefined, errors: [] })
      })
    })

    describe('response failure', () => {
      it('returns error response on wrong status code', async () => {
        mockPost.mockResolvedValue({ status: 400, data: downloadJobResponse('pending') })
        expect(await createThemeJob('11', client, JobType.EXPORTS)).toEqual({
          job: undefined,
          errors: [safeJsonStringify(downloadJobResponse('pending'))],
        })
      })
    })
  })
  describe('createThemeImportJob', () => {
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
      await createThemeJob((11).toString(), client, JobType.IMPORTS)
      expect(mockPost).toHaveBeenCalledWith({
        url: '/api/v2/guide/theming/jobs/themes/imports',
        data: {
          job: {
            attributes: {
              brand_id: '11',
              format: 'zip',
            },
          },
        },
      })
      expect(mockPost).toHaveBeenCalledTimes(1)
    })

    describe('successful response', () => {
      it('returns a job on a correct response structure', async () => {
        mockPost.mockResolvedValue({ status: 202, data: downloadJobResponse('pending') })
        expect(await createThemeJob((11).toString(), client, JobType.IMPORTS)).toEqual({
          job: downloadJobResponse('pending').job,
          errors: [],
        })
      })

      it('returns undefined job on non-pending job', async () => {
        mockPost.mockResolvedValue({ status: 202, data: downloadJobResponse('completed') })
        expect(await createThemeJob((11).toString(), client, JobType.IMPORTS)).toEqual({ job: undefined, errors: [] })
      })

      it('returns undefined job on wrong response structure', async () => {
        mockPost.mockResolvedValue({ status: 202, data: { nope: 'yup' } })
        expect(await createThemeJob((11).toString(), client, JobType.IMPORTS)).toEqual({ job: undefined, errors: [] })
      })
    })

    describe('response failure', () => {
      it('returns error response on wrong status code', async () => {
        mockPost.mockResolvedValue({ status: 400, data: downloadJobResponse('pending') })
        expect(await createThemeJob((11).toString(), client, JobType.IMPORTS)).toEqual({
          job: undefined,
          errors: [safeJsonStringify(downloadJobResponse('pending'))],
        })
      })
    })
  })
})
