/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { Change, SaltoError, SaltoElementError, createSaltoElementError, getChangeData } from '@salto-io/adapter-api'
import JiraClient from './client/client'
import { JiraConfig } from './config/config'

const log = logger(module)
type WorkspaceResponse = {
  values: {
    workspaceId: string
  }[]
}

const WORKSPACE_RESPONSE_SCHEME = Joi.object({
  values: Joi.array()
    .items(
      Joi.object({
        workspaceId: Joi.string().required(),
      }),
    )
    .min(1)
    .required(),
})
  .unknown(true)
  .required()

const isWorkspaceResponse = createSchemeGuard<WorkspaceResponse>(
  WORKSPACE_RESPONSE_SCHEME,
  'Received invalid workspace response',
)

export const getWorkspaceId = async (client: JiraClient, config: JiraConfig): Promise<string | undefined> => {
  try {
    if (!config.fetch.enableJSM) {
      return undefined
    }
    const response = await client.get({
      url: '/rest/servicedeskapi/assets/workspace',
    })
    if (!isWorkspaceResponse(response.data)) {
      log.debug('Received invalid workspace response %o', response.data)
      return undefined
    }
    return response.data.values[0].workspaceId
  } catch (e) {
    log.debug(`Failed to get workspace id: ${e}`)
    return undefined
  }
}

export const getWorkspaceIdMissingErrors = (changes: Change[]): (SaltoError | SaltoElementError)[] =>
  changes.map(change => {
    const message = `The following changes were not deployed, due to error with the workspaceId: ${changes.map(c => getChangeData(c).elemID.getFullName()).join(', ')}`
    return createSaltoElementError({
      message,
      detailedMessage: message,
      severity: 'Error',
      elemID: getChangeData(change).elemID,
    })
  })
