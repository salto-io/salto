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
    if (!(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium)) {
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
  changes.map(change =>
    createSaltoElementError({
      message: `The following changes were not deployed, due to error with the workspaceId: ${changes.map(c => getChangeData(c).elemID.getFullName()).join(', ')}`,
      severity: 'Error',
      elemID: getChangeData(change).elemID,
    }),
  )
