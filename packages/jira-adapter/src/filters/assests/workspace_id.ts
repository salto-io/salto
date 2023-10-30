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

import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import JiraClient from '../../client/client'

type WorkspaceResponse = {
    values: {
        workspaceId: string
    }[]
}

const WORKSPACE_RESPONSE_SCHEME = Joi.object({
  values: Joi.array().items(Joi.object({
    workspaceId: Joi.string().required(),
  })).required(),
}).unknown(true).required()

const isWorkspaceResponse = createSchemeGuard<WorkspaceResponse>(WORKSPACE_RESPONSE_SCHEME, 'Received invalid workspace response')


export const getWorkspaceId = async (client: JiraClient): Promise<string> => {
  const response = await client.getSinglePage({
    url: '/rest/servicedeskapi/assets/workspace',
  })
  if (!isWorkspaceResponse(response.data)) {
    throw new Error('Failed to get workspace id')
  }
  return response.data.values[0].workspaceId
}
