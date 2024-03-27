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
import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import ZendeskClient from '../client/client'
import { APP_INSTALLATION_TYPE_NAME } from '../constants'
import { isValidApp } from '../filters/utils'

const log = logger(module)
const { awu } = collections.asynciterable

const { isDefined } = lowerDashValues

const APPS_SECTION_URL = 'admin/apps-integrations/apps/support-apps'

export const createChangeError = (instanceElemId: ElemID, prefilledFields: string[], baseUrl: string): ChangeError => ({
  elemID: instanceElemId,
  severity: 'Info',
  message: 'App installation creation detected',
  detailedMessage: 'App installation creation detected',
  deployActions: {
    preAction: {
      title: 'Some App installation required fields will not be set',
      description: `App installation ${instanceElemId.name} will be deployed with the placeholder values for the following fields: ${prefilledFields.length === 1 ? prefilledFields[0] : prefilledFields.join(', ')}. Salto will guide you on modifying them post deploy`,
      subActions: [],
    },
    postAction: {
      title: 'Set app installation fields',
      description: `Please manually set the following fields for app installation ${instanceElemId.name} via the Zendesk UI: ${prefilledFields.length === 1 ? prefilledFields[0] : prefilledFields.join(', ')}`,
      showOnFailure: false,
      subActions: [
        `Go to Zendesk Apps panel at ${baseUrl}${APPS_SECTION_URL}`,
        'Hover over the created app',
        'Click on the Gear icon > Change Settings',
        'Edit the fields in the "App Installation" section',
        'Click "Update"',
      ],
    },
  },
})

/*
 * If we are creating an app installation, we need to make sure that we include all required fields.
 * If those fields are "secure", they wouldn't show up in nacls, and so if we duplicate another installation
 * the deployment would fail.
 */
export const appInstallationValidator: (client: ZendeskClient) => ChangeValidator = client => async changes => {
  const potentialChanges = changes
    .filter(isAdditionChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(
      changeData => changeData.elemID.typeName === APP_INSTALLATION_TYPE_NAME && changeData.value.app_id !== undefined,
    )

  const errors = await awu(potentialChanges)
    .flatMap(async changeData => {
      try {
        const res = (
          await client.get({
            url: `/api/support/apps/${changeData.value.app_id}/installations/new`,
            responseType: 'json',
          })
        ).data
        if (isValidApp(res) && res.installation !== undefined) {
          const prefilledFields = res.installation.settings
            .map(field =>
              field.secure === true && field.required === true && !(field.key in changeData.value.settings)
                ? field.key
                : undefined,
            )
            .filter(isDefined)
          if (prefilledFields.length > 0) {
            return [createChangeError(changeData.elemID, prefilledFields, client.getUrl().href)]
          }
        }
        return []
      } catch (e) {
        log.warn(`Failed to fetch app installation details. error: ${e}`)
        return []
      }
    })
    .filter(isDefined)
    .toArray()

  return errors
}
