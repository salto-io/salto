/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { ZendeskApiConfig } from '../user_config'
import ZendeskClient from '../client/client'
import { TARGET_TYPE_NAME } from '../constants'

export const createChangeError = (
  instanceElemId: ElemID,
  instanceTitle: string,
  baseUrl: string,
  serviceUrl?: string,
): ChangeError => ({
  elemID: instanceElemId,
  severity: 'Info',
  message: 'Target authentication change detected',
  detailedMessage: 'Target authentication change detected',
  deployActions: {
    preAction: {
      title: 'Current authentication data for a target will be overridden',
      description: `Current authentication data for the target ${instanceElemId.name} will be overridden.
You will have to re-enter it after deployment;  please make sure you have the appropriate authentication data`,
      subActions: [],
    },
    postAction: {
      title: 'Change target authentication data',
      description: `Please change the authentication data for the target ${instanceElemId.name} in the service`,
      showOnFailure: false,
      subActions: [
        `In Zendesk, open the Targets panel at ${baseUrl}${serviceUrl?.slice(1)}`,
        `Click on the edit button of the modified target, ${instanceTitle}`,
        'In the "Basic Authentication" dialog, enter the correct authentication data',
        'Choose "Update target" in the select box',
        'Click "Submit"',
      ],
    },
  },
})

export const targetAuthDataValidator: (client: ZendeskClient, apiConfig: ZendeskApiConfig) => ChangeValidator =
  (client, apiConfig) => async changes =>
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === TARGET_TYPE_NAME)
      .filter(change => change.data.after.value.username || change.data.after.value.password)
      .filter(
        change =>
          isAdditionChange(change) ||
          change.data.before.value.username !== change.data.after.value.username ||
          change.data.before.value.password !== change.data.after.value.password,
      )
      .map(getChangeData)
      .flatMap(instance => [
        createChangeError(
          instance.elemID,
          instance.value.title,
          client.getUrl().href,
          apiConfig.types.target.transformation?.serviceUrl,
        ),
      ])
