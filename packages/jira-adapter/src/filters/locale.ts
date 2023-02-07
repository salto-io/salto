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
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { getCurrentUserInfo } from '../users'

const log = logger(module)

/**
 * Check whether user locale is en_US to make sure we're only pulling Jira information in English
 */
const filter: FilterCreator = ({ client }) => ({
  name: 'localeFilter',
  onFetch: async () => {
    if (!client.isDataCenter) {
      return undefined
    }

    try {
      const userInfo = await getCurrentUserInfo(client)

      if (userInfo?.locale === undefined) {
        log.error('Failed to get current user locale')
        return undefined
      }

      if (userInfo?.locale !== 'en_US') {
        return {
          errors: [
            {
              message: 'Your Jira Data Center instance is not set to English-US language. Salto currently only supports accessing Jira DC through users with their default language set to English-US. Please change the user’s language, or create another user with English as its Jira language, and change Salto\'s credentials to use it. After doing that, make sure you re-fetch your environment using an advanced fetch, with “Regenerate Salto IDs” turned on. You only need to do this once. For help on how to change Jira users\' language, go to https://confluence.atlassian.com/adminjiraserver/choosing-a-default-language-938847001.html',
              severity: 'Warning',
            },
          ],
        }
      }
      return undefined
    } catch (e) {
      log.error('Filter failure on locale: %o', e)
      return undefined
    }
  },
})

export default filter
