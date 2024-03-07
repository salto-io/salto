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
import _ from 'lodash'
import {
  Change,
  createSaltoElementError,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { WEBHOOK_TYPE_NAME } from '../constants'

export const AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA: Record<string, unknown> = {
  bearer_token: { token: '123456' },
  basic_auth: { username: 'user@name.com', password: 'password' },
  api_key: { name: 'tempHeader', value: 'tempValue' },
}

/**
 * onFetch: On relevant webhooks, replace installation_id field with appInstallation reference
 * onDeploy: Removes the authentication data from webhook if it wasn't changed
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'webhookFilter',
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [webhookModificationChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === WEBHOOK_TYPE_NAME && isAdditionOrModificationChange(change),
    )
    const deployResult = await deployChanges(webhookModificationChanges, async change => {
      const clonedChange = await applyFunctionToChangeData(change, inst => inst.clone())
      const instance = getChangeData(clonedChange)
      if (isModificationChange(clonedChange)) {
        if (_.isEqual(clonedChange.data.before.value.authentication, clonedChange.data.after.value.authentication)) {
          delete instance.value.authentication
        } else if (instance.value.authentication === undefined) {
          instance.value.authentication = null
        }

        // Only verify the absence of custom headers if after webhook custom headers contains difference.
        // The PATCH which is a merge behaviour which relies on explicit null value to remove.
        if (!_.isEqual(clonedChange.data.before.value.custom_headers, instance.value.custom_headers)) {
          // Remove any custom headers which no longer needed in after webhook by setting value as null
          _.forEach(_.keys(clonedChange.data.before.value.custom_headers), key => {
            if (!_.has(instance.value.custom_headers, key)) {
              _.set(instance.value, ['custom_headers', key], null)
            }
          })
        }
      }

      if (instance.value.authentication) {
        const placeholder = AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[instance.value.authentication.type]
        if (placeholder === undefined) {
          throw createSaltoElementError({
            // caught by deployChanges
            message: `Unknown auth type was found for webhook: ${instance.value.authentication.type}`,
            severity: 'Error',
            elemID: getChangeData(change).elemID,
          })
        }
        instance.value.authentication.data = placeholder
      }
      // Ignore external_source because it is impossible to deploy, the user was warned at externalSourceWebhook.ts
      await deployChange(clonedChange, client, config.apiDefinitions, ['external_source'])
      getChangeData(change).value.id = getChangeData(clonedChange).value.id
    })
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
