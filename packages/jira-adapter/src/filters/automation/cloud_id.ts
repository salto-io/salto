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
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import _ from 'lodash'
import JiraClient from '../../client/client'

const log = logger(module)

export const CLOUD_RESOURCE_FIELD =
  'com.atlassian.jira.jira-client-analytics-plugin:analytics-context-provider.client-analytic-descriptors'

type ResourcesResponse = {
  unparsedData: {
    [CLOUD_RESOURCE_FIELD]: string
  }
}

const RESOURCES_RESPONSE_SCHEME = Joi.object({
  unparsedData: Joi.object({
    [CLOUD_RESOURCE_FIELD]: Joi.string().required(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

const isResources = createSchemeGuard<ResourcesResponse>(RESOURCES_RESPONSE_SCHEME, 'Received invalid resources result')

const parseCloudId = (cloudResource: string): string => {
  try {
    const parsedCloudResource = JSON.parse(cloudResource)
    if (!_.isPlainObject(parsedCloudResource)) {
      log.error(`Failed to get cloud id, received invalid response: ${cloudResource}`)
      throw new Error('Failed to get cloud id, received invalid response')
    }

    const id = parsedCloudResource.tenantId
    if (id === undefined) {
      log.error(`Failed to get cloud id, tenantId not found: ${cloudResource}`)
      throw new Error('Failed to get cloud id, tenantId not found')
    }
    return id
  } catch (err) {
    log.error(`Failed to get cloud id, could not parse json: ${err} ${cloudResource}`)
    throw new Error(`Failed to get cloud id, could not parse json - ${err}`)
  }
}

export const getCloudId = async (client: JiraClient): Promise<string> => {
  const response = await client.post({
    url: '/rest/webResources/1.0/resources',
    data: {
      r: [],
      c: ['jira.webresources:jira-global'],
      xc: [],
      xr: [],
    },
  })

  if (!isResources(response.data)) {
    throw new Error('Failed to get cloud id, received invalid response')
  }

  return parseCloudId(response.data.unparsedData[CLOUD_RESOURCE_FIELD])
}
