/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import ZendeskClient from '../client/client'
import { WEBHOOK_TYPE_NAME } from '../constants'

const WEBHOOKS_SERVICE_URL = 'admin/apps-integrations/webhooks/webhooks'

export const createChangeError = (instanceElemId: ElemID, baseUrl: string): ChangeError => ({
  elemID: instanceElemId,
  severity: 'Info',
  message: 'Webhook authentication change detected',
  detailedMessage: 'Webhook authentication change detected',
  deployActions: {
    preAction: {
      title: "Webhook's authentication credentials will not be set",
      description: `Webhook ${instanceElemId.name} will be deployed with placeholder credentials. Salto will guide you on modifying it post deploy`,
      subActions: [],
    },
    postAction: {
      title: 'Set webhook authentication credentials',
      description: `Please manually set the authentication credentials for webhook ${instanceElemId.name} via the Zendesk UI`,
      showOnFailure: false,
      subActions: [
        `Go to Zendesk Webhooks panel at ${baseUrl}${WEBHOOKS_SERVICE_URL}`,
        'Click on the modified webhook',
        'Click on Actions > Edit',
        'Enter the authentication data',
        'Click "Update"',
      ],
    },
  },
})

export const webhookAuthDataValidator: (client: ZendeskClient) => ChangeValidator = client => async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === WEBHOOK_TYPE_NAME)
    .filter(change => ['bearer_token', 'basic_auth'].includes(getChangeData(change).value.authentication?.type))
    .filter(
      change =>
        isAdditionChange(change) ||
        change.data.before.value.authentication?.type !== change.data.after.value.authentication?.type,
    )
    .map(getChangeData)
    .flatMap(instance => [createChangeError(instance.elemID, client.getUrl().href)])
