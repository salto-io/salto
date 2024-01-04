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
import { getServerInfoTitle } from '../src/jsm_utils'
import { mockClient } from './utils'

describe('jsm utils', () => {
  let client: JiraClient
  let connection: MockInterface<clientUtils.APIConnection>

  describe('getServerInfoTitle', () => {
    beforeEach(() => {
      const { client: cli, connection: conn } = mockClient(false)
      client = cli
      connection = conn
      connection.get.mockImplementation(async url => {
        if (url === '/rest/api/3/serverInfo') {
          return {
            status: 200,
            data: {
              serverTitle: 'test',
            },
          }
        }
        throw new Error(`unexpected url: ${url}`)
      })
    })
    it('should return the server title', async () => {
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: {
          serverTitle: 'test',
        },
      })
      expect(await getServerInfoTitle(client)).toEqual('test')
    })
    it('should return \'Jira\' if api thorws an error', async () => {
      connection.get.mockRejectedValueOnce(new Error('test'))
      expect(await getServerInfoTitle(client)).toEqual('Jira')
    })
  })
})
