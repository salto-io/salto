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
import { publish } from '../../../src/filters/guide_themes/publish'

describe('create', () => {
  let client: ZendeskClient
  let mockPost: jest.SpyInstance

  beforeEach(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockPost = jest.spyOn(client, 'post')
  })

  describe('successful flow', () => {
    describe('no errors', () => {
      beforeEach(() => {
        mockPost.mockResolvedValue({
          status: 200,
        })
      })

      it('returns no errors when successful', async () => {
        expect(await publish('1', client)).toEqual([])
        expect(mockPost).toHaveBeenCalledTimes(1)
        expect(mockPost).toHaveBeenCalledWith({
          url: '/api/v2/guide/theming/themes/1/publish',
        })
      })
    })

    describe('with errors', () => {
      beforeEach(() => {
        mockPost.mockResolvedValue({
          status: 400,
        })
      })

      it('returns an errors', async () => {
        expect(await publish('1', client)).toEqual(['Failed to publish theme 1. Received status code 400'])
      })
    })
  })
})
