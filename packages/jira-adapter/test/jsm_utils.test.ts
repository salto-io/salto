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

import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import JiraClient from '../src/client/client'
import { hasSoftwareProject } from '../src/jsm_utils'
import { mockClient } from './utils'

describe('jsm utils', () => {
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>

  describe('hasSoftwareProject', () => {
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient(false)
      client = cli
      connection = conn
      connection.get.mockImplementation(async url => {
        if (url === '/rest/api/3/project/search') {
          return {
            status: 200,
            data: {
              values: [
                {
                  projectTypeKey: 'service_desk',
                },
                {
                  projectTypeKey: 'software',
                },
              ],
            },
          }
        }
        throw new Error(`unexpected url: ${url}`)
      })
    })
    it('should return true if there is software project', async () => {
      expect(await hasSoftwareProject(client)).toEqual(true)
    })
    it('should return true if api thorws an error', async () => {
      connection.get.mockRejectedValueOnce(new Error('test'))
      expect(await hasSoftwareProject(client)).toEqual(true)
    })
    it('should return false if there is no software project', async () => {
      connection.get.mockImplementation(async url => {
        if (url === '/rest/api/3/project/search') {
          return {
            status: 200,
            data: {
              values: [
                {
                  projectTypeKey: 'service_desk',
                },
                {
                  projectTypeKey: 'service_desk',
                },
              ],
            },
          }
        }
        throw new Error(`unexpected url: ${url}`)
      })
      expect(await hasSoftwareProject(client)).toEqual(false)
    })
  })
})
