/*
*                      Copyright 2022 Salto Labs Ltd.
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
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  isModificationChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { APP_INSTALLATION_TYPE_NAME } from './app'
import { WEBHOOK_TYPE_NAME } from '../constants'

export const AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA: Record<string, unknown> = {
  bearer_token: { token: '123456' },
  basic_auth: { username: 'user@name.com', password: 'password' },
}

/**
 * onFetch: On relevant webhooks, replace installation_id field with appInstallation reference
 * onDeploy: Removes the authentication data from webhook if it wasn't changed
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  onFetch: async (elements: Element[]) => {
    const instanceElements = elements.filter(isInstanceElement)
    const webhooks = instanceElements.filter(e => e.elemID.typeName === WEBHOOK_TYPE_NAME)
    const appInstallations = instanceElements.filter(e => e.elemID.typeName === APP_INSTALLATION_TYPE_NAME)

    webhooks.forEach(webhook => {
      const installationId = webhook.value.external_source?.data?.installation_id

      // If the webhook was installed by an external source (an app), put a reference to it in the webhook's data
      if (installationId !== undefined) {
        const webhookAppInstallation = appInstallations.find(installation => installation.value.id === installationId)

        if (webhookAppInstallation) {
          const installationReference = new ReferenceExpression(webhookAppInstallation.elemID, webhookAppInstallation)
          webhook.value.external_source.data.installation_id = installationReference
        }
      }
    })
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [webhookModificationChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        (getChangeData(change).elemID.typeName === WEBHOOK_TYPE_NAME)
        && isAdditionOrModificationChange(change),
    )
    const deployResult = await deployChanges(
      webhookModificationChanges,
      async change => {
        const clonedChange = await applyFunctionToChangeData(
          change, inst => inst.clone()
        )
        const instance = getChangeData(clonedChange)
        if (isModificationChange(clonedChange)) {
          if (_.isEqual(
            clonedChange.data.before.value.authentication,
            clonedChange.data.after.value.authentication,
          )) {
            delete instance.value.authentication
          } else if (instance.value.authentication === undefined) {
            instance.value.authentication = null
          }
        }
        if (instance.value.authentication) {
          const placeholder = AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[
            instance.value.authentication.type
          ]
          if (placeholder === undefined) {
            throw new Error(
              `Unknown auth type was found for webhook ${instance.elemID.getFullName()}: ${
                instance.value.authentication.type}`,
            )
          }
          instance.value.authentication.data = placeholder
        }
        // Ignore external_source because it is impossible to deploy, the user was warned at externalSourceWebhook.ts
        await deployChange(clonedChange, client, config.apiDefinitions, ['external_source'])
        getChangeData(change).value.id = getChangeData(clonedChange).value.id
      },
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
