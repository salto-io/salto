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
import Joi from 'joi'
import semver from 'semver'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'

const log = logger(module)
export const PLUGIN_VERSION_NUMBER = '1.0.4'

type InfoResponse = {
  version: string
}

const INFO_RESPONSE_SCHEME = Joi.object({
  version: Joi.string().required(),
}).unknown(true).required()

const isInfoResonse = createSchemeGuard<InfoResponse>(INFO_RESPONSE_SCHEME, 'Failed to get plugin info')

/**
 * Filter to verfiy plugin version is up to date
 */
const filter: FilterCreator = ({ client }) => ({
  name: 'jiraDcPluginVerionNumberFilter',
  onFetch: async () => {
    if (!client.isDataCenter) {
      return undefined
    }
    try {
      const response = await client.getSinglePage({
        url: '/rest/salto/1.0/plugininfo',
      })
      if (!isInfoResonse(response.data)) {
        throw new Error('Invalid pluginInfo response')
      }
      if (semver.gt(response.data.version, PLUGIN_VERSION_NUMBER)) {
        return {
          errors: [
            {
              message: 'The Salto for Jira DC addon version number is higher than expected. You may be running an outdated Salto CLI; please update it to the latest version from https://github.com/salto-io/salto/releases',
              severity: 'Info',
            },
          ],
        }
      }
      if (semver.lt(response.data.version, PLUGIN_VERSION_NUMBER)) {
        return {
          errors: [
            {
              message: `Your Jira instance is running an old version ${response.data.version} of Salto Configuration Manager for Jira Data Center. Please update the app to the latest version from https://marketplace.atlassian.com/apps/1225356/salto-configuration-manager-for-jira.`,
              severity: 'Warning',
            },
          ],
        }
      }
      return undefined
    } catch (e) {
      log.error('Failed to verify plugin version number, error is %o', e)
      return {
        errors: [
          {
            message: 'Could not verify version number for Salto for Jira DC addon. Please make sure you are using the latest version of Salto Configuration Manager for Jira Data Center. You can download it from the Jira Marketplace: https://marketplace.atlassian.com/apps/1225356/salto-configuration-manager-for-jira?tab=overview&hosting=datacenter',
            severity: 'Warning',
          },
        ],
      }
    }
  },
})

export default filter
