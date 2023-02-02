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
import {
  AdditionChange,
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData, InstanceElement,
  isAdditionChange,
  isInstanceChange, isModificationChange, isReferenceExpression,
  isRemovalChange, ModificationChange, ReferenceExpression, RemovalChange, Value,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import { WEBHOOK_TYPE_NAME } from '../constants'


type ExternalSourceWithApp = {
    data: {
      // eslint-disable-next-line camelcase
        installation_id: ReferenceExpression
    }
}

const isExternalSourceWithApp = (externalSource: Value): externalSource is ExternalSourceWithApp =>
  isReferenceExpression(externalSource.data?.installation_id)

const createExternalSourceWebhookChangeWarning = (webhook: InstanceElement, appMessage: string): ChangeError => ({
  elemID: webhook.elemID,
  severity: 'Warning',
  message: 'Changing a webhook that was installed by an external app',
  detailedMessage: `${appMessage}, If you edit this webhook (${webhook.elemID.name}), the app that created it might not work as intended.`,
})

const createDeactivationWarning = (webhook: InstanceElement, appMessage: string): ChangeError => ({
  elemID: webhook.elemID,
  severity: 'Warning',
  message: 'Deactivating a webhook that was installed by an external app',
  detailedMessage: `${appMessage}, If you deactivate this webhook (${webhook.elemID.name}), the app that created it might not work as intended. You'll need to reactivate it to use it again.`,
})

const createExternalSourceChangeError = (webhook: InstanceElement): ChangeError => ({
  elemID: webhook.elemID,
  severity: 'Error',
  message: 'Illegal webhook modification',
  detailedMessage: `Cannot modify 'external_source' field of a webhook (${webhook.elemID.name})`,
})

const handleModificationChanges = (
  { change, appMessage }: {change: ModificationChange<InstanceElement>; appMessage: string}
) : ChangeError[] => {
  const errors: ChangeError[] = []
  const detailedChanges = detailedCompare(change.data.before, change.data.after)

  // It's impossible to change external_source field in a webhook using Zendesk's api
  if (detailedChanges.some(detailedChange => detailedChange.id.createTopLevelParentID().path[0] === 'external_source')) {
    errors.push(createExternalSourceChangeError(change.data.after))
  }

  const wasDeactivated = change.data.before.value.status === 'active' && change.data.after.value.status === 'inactive'
  if (wasDeactivated) {
    errors.push(createDeactivationWarning(change.data.after, appMessage))
  }

  // Filter all the changes we already handled, if there are any other - we have a different warning for them
  const otherChanges = detailedChanges.filter(detailedChange =>
    ['external_source', 'status'].every(field => detailedChange.id.createTopLevelParentID().path[0] !== field))
  if (otherChanges.length > 0) {
    errors.push(createExternalSourceWebhookChangeWarning(change.data.after, appMessage))
  }

  return errors
}

const getAppMessageFromChange = <T extends Change<InstanceElement>>(change: T): {change : T; appMessage: string} => {
  const webhook = getChangeData(change)
  const externalSource = webhook.value.external_source
  // If the external_source contains an installation_id, we can get the app name from it
  const appMessage = isExternalSourceWithApp(externalSource)
    ? `This webhook was installed by the external app '${externalSource.data.installation_id.elemID.name}'`
    : 'This webhook was installed an external app'
  return { change, appMessage }
}

const createAdditionError = ({ change, appMessage }: {change: AdditionChange<InstanceElement>; appMessage: string})
    : ChangeError => {
  const webhook = getChangeData(change)
  return {
    elemID: webhook.elemID,
    severity: 'Error',
    message: 'Installing a webhook that was installed by an external app',
    detailedMessage: `${appMessage}, In order to add it, please install that app.`,
  }
}

const createRemovalErrorMessage = ({ change, appMessage }: {change: RemovalChange<InstanceElement>; appMessage: string})
    : ChangeError => {
  const webhook = getChangeData(change)
  return {
    elemID: webhook.elemID,
    severity: 'Error',
    message: 'Removing a webhook that was installed by an external app',
    detailedMessage: `${appMessage}, In order to remove it, please uninstall that app.`,
  }
}

/**
 * Validated everything related to webhooks that were installed by an external app
 *  * They can't be created
 *  * They can't be removed
 *  * external_source field can't be changed
 *  * If they are deactivated, a warning is added
 *  * If they are modified, a warning is added
 */
export const externalSourceWebhook: ChangeValidator = async changes => {
  const externalSourceWebhookChanges = changes.filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === WEBHOOK_TYPE_NAME)
    .filter(change => getChangeData(change).value.external_source !== undefined)

  return [
    externalSourceWebhookChanges.filter(isAdditionChange).map(getAppMessageFromChange).map(createAdditionError),
    externalSourceWebhookChanges.filter(isRemovalChange).map(getAppMessageFromChange).map(createRemovalErrorMessage),
    externalSourceWebhookChanges.filter(isModificationChange).map(getAppMessageFromChange)
      .map(handleModificationChanges).flat(),
  ].flat()
}
