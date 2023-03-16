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
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import JiraClient from '../../src/client/client'
import { getFilterParams, mockClient } from '../utils'
import localeFilter from '../../src/filters/locale'

describe('localeFilter', () => {
  describe('When running on Jira DC', () => {
    let filter: filterUtils.FilterWith<'onFetch'>
    let client: JiraClient
    let connection: MockInterface<clientUtils.APIConnection>
    beforeEach(async () => {
      const { connection: conn, client: cli } = mockClient(true)
      client = cli
      connection = conn

      filter = localeFilter(getFilterParams({
        client,
      })) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>


      connection.get.mockResolvedValue({
        status: 200,
        data: {
          key: 'key',
          name: 'name',
          displayName: 'displayName',
          locale: 'es_ES',
        },
      })
    })

    it('should work when email is an empty string', async () => {
      connection.get.mockResolvedValue({
        status: 200,
        data: {
          key: 'key',
          name: 'name',
          displayName: 'displayName',
          locale: 'es_ES',
          emailAddress: '',
        },
      })
      const filterRes = await filter.onFetch([])
      expect(filterRes).toEqual({
        errors: [{
          message: 'Your Jira Data Center instance is not set to English-US language. Salto currently only supports accessing Jira DC through users with their default language set to English-US. Please change the user’s language, or create another user with English as its Jira language, and change Salto\'s credentials to use it. After doing that, make sure you re-fetch your environment using an advanced fetch, with “Regenerate Salto IDs” turned on. You only need to do this once. For help on how to change Jira users\' language, go to https://confluence.atlassian.com/adminjiraserver/choosing-a-default-language-938847001.html',
          severity: 'Warning',
        }],
      })
    })

    it('should raise error when language is not English', async () => {
      const filterRes = await filter.onFetch([])
      expect(filterRes).toEqual({
        errors: [{
          message: 'Your Jira Data Center instance is not set to English-US language. Salto currently only supports accessing Jira DC through users with their default language set to English-US. Please change the user’s language, or create another user with English as its Jira language, and change Salto\'s credentials to use it. After doing that, make sure you re-fetch your environment using an advanced fetch, with “Regenerate Salto IDs” turned on. You only need to do this once. For help on how to change Jira users\' language, go to https://confluence.atlassian.com/adminjiraserver/choosing-a-default-language-938847001.html',
          severity: 'Warning',
        }],
      })
    })

    it('When an error is thrown, it should return nothing', async () => {
      connection.get.mockRejectedValue(new Error('Async error'))
      const filterRes = await filter.onFetch([])
      expect(filterRes).toEqual(undefined)
    })

    it('When locale is not returned, it should return nothing', async () => {
      connection.get.mockResolvedValue({
        status: 200,
        data: {
          key: 'key',
          name: 'name',
          displayName: 'displayName',
        },
      })

      const filterRes = await filter.onFetch([])
      expect(filterRes).toEqual(undefined)
    })
  })

  describe('When running on Jira Cloud', () => {
    let filter: filterUtils.FilterWith<'onFetch'>
    let client: JiraClient
    let connection: MockInterface<clientUtils.APIConnection>
    beforeEach(async () => {
      const { connection: conn, client: cli } = mockClient(false)
      client = cli
      connection = conn

      filter = localeFilter(getFilterParams({
        client,
      })) as filterUtils.FilterWith<'onFetch'>

      connection.get.mockResolvedValue({
        status: 200,
        data: {
          locale: 'es_ES',
        },
      })
    })

    it('should return nothing', async () => {
      expect(await filter.onFetch([])).toEqual(undefined)
    })
  })
})
