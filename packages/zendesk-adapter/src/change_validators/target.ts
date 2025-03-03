/*
 * Copyright 2025 Salto Labs Ltd.
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
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import ZendeskClient from '../client/client'
import { TARGET_TYPE_NAME } from '../constants'
import { Options } from '../definitions/types'

export const createAuthenticationChangeError = (
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

const createInvalidTypeChangeError = (instanceElemId: ElemID, instanceTitle: string): ChangeError => ({
  elemID: instanceElemId,
  severity: 'Error',
  message: 'Invalid target type detected',
  detailedMessage: `The target ${instanceTitle} has an invalid type.
Targets besides email target types have been deprecated.
See more here: https://support.zendesk.com/hc/en-us/articles/6468124845210-Announcing-the-deprecation-of-URL-targets-and-branded-targets`,
})

export const targetValidator: (
  client: ZendeskClient,
  definitions: definitionsUtils.ApiDefinitions<Options>,
) => ChangeValidator = (client, definitions) => async changes => {
  const targetChanges = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === TARGET_TYPE_NAME)

  const defQuery = definitionsUtils.queryWithDefault(definitions.fetch?.instances ?? {})
  const serviceUrl = defQuery.query(TARGET_TYPE_NAME)?.element?.topLevel?.serviceUrl?.path

  const targetChangesWithAuthData = targetChanges
    .filter(change => change.data.after.value.username || change.data.after.value.password)
    .filter(
      change =>
        isAdditionChange(change) ||
        change.data.before.value.username !== change.data.after.value.username ||
        change.data.before.value.password !== change.data.after.value.password,
    )
    .map(getChangeData)
    .flatMap(instance => [
      createAuthenticationChangeError(instance.elemID, instance.value.title, client.getUrl().href, serviceUrl),
    ])

  const targetChangesWithInvalidTypes = targetChanges
    .map(getChangeData)
    .filter(element => element.value.type !== 'email_target')
    .map(element => createInvalidTypeChangeError(element.elemID, element.value.title))

  return targetChangesWithAuthData.concat(targetChangesWithInvalidTypes)
}
