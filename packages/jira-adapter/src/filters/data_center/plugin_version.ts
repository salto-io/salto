/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import Joi from 'joi'
import semver from 'semver'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'

const log = logger(module)
export const PLUGIN_VERSION_NUMBER = '1.0.6'

type InfoResponse = {
  version: string
}

const INFO_RESPONSE_SCHEME = Joi.object({
  version: Joi.string().required(),
})
  .unknown(true)
  .required()

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
      const response = await client.get({
        url: '/rest/salto/1.0/plugininfo',
      })
      if (!isInfoResonse(response.data)) {
        throw new Error('Invalid pluginInfo response')
      }
      if (semver.lt(response.data.version, PLUGIN_VERSION_NUMBER)) {
        const message = `Your Jira instance is running an old version ${response.data.version} of Salto Configuration Manager for Jira Data Center. Please update the app to the latest version from https://marketplace.atlassian.com/apps/1225356/salto-configuration-manager-for-jira.`
        return {
          errors: [
            {
              message,
              detailedMessage: message,
              severity: 'Warning',
            },
          ],
        }
      }
      return undefined
    } catch (e) {
      log.error('Failed to verify plugin version number, error is %o', e)
      const message =
        'Could not verify version number for Salto for Jira DC addon. Please make sure you are using the latest version of Salto Configuration Manager for Jira Data Center. You can download it from the Jira Marketplace: https://marketplace.atlassian.com/apps/1225356/salto-configuration-manager-for-jira?tab=overview&hosting=datacenter'
      return {
        errors: [
          {
            message,
            detailedMessage: message,
            severity: 'Warning',
          },
        ],
      }
    }
  },
})

export default filter
