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
import _ from 'lodash'
import Joi from 'joi'
import {
  Change, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange,
  isInstanceElement, Element,
} from '@salto-io/adapter-api'
import { retry } from '@salto-io/lowerdash'
import { safeJsonStringify, elementExpressionStringifyReplacer } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import ZendeskClient from '../client/client'

export const APP_INSTALLATION_TYPE_NAME = 'app_installation'

const { withRetry } = retry
const { intervals } = retry.retryStrategies
const log = logger(module)

const MAX_RETRIES = 60
const INTERVAL_TIME = 2000

type JobStatus = {
  status: string
  message?: string
}

const EXPECTED_APP_SCHEMA = Joi.object({
  status: Joi.string().required(),
  message: Joi.string().optional().allow(''),
}).unknown(true).required()

const isJobStatus = (value: unknown): value is JobStatus => {
  const { error } = EXPECTED_APP_SCHEMA.validate(value)
  if (error !== undefined) {
    log.error(`Received an invalid response for the job status: ${error.message}, ${safeJsonStringify(value, elementExpressionStringifyReplacer)}`)
    return false
  }
  return true
}

const checkIfJobIsDone = async (
  client: ZendeskClient, jobId: string, fullName: string
): Promise<boolean> => {
  const res = (await client.getSinglePage({ url: `/api/v2/apps/job_statuses/${jobId}` })).data
  if (!isJobStatus(res)) {
    throw new Error(`Got an invalid response for job status. Element: ${fullName}. Job ID: ${jobId}`)
  }
  if (['failed', 'killed'].includes(res.status)) {
    throw new Error(`Job status is failed. Element: ${fullName}. Job ID: ${jobId}. Error: ${res.message}`)
  }
  return res.status === 'completed'
}

const waitTillJobIsDone = async (client: ZendeskClient, jobId: string, fullName: string):
Promise<void> => {
  await withRetry(
    () => checkIfJobIsDone(client, jobId, fullName),
    {
      strategy: intervals({
        maxRetries: MAX_RETRIES,
        interval: INTERVAL_TIME,
      }),
    }
  )
}

/**
 * Deploys app installation
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'appsFilter',
  onFetch: async (elements: Element[]) =>
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === APP_INSTALLATION_TYPE_NAME).forEach(e => {
        delete e.value.settings_objects
      }),
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isAdditionOrModificationChange(change)
        && (getChangeData(change).elemID.typeName === APP_INSTALLATION_TYPE_NAME),
    )
    const deployResult = await deployChanges(
      relevantChanges,
      async change => {
        const fullName = getChangeData(change).elemID.getFullName()
        const response = await deployChange(change, client, config.apiDefinitions, ['app', 'settings.title', 'settings_objects'])
        if (isAdditionChange(change)) {
          if (response == null || _.isArray(response) || !_.isString(response.pending_job_id)) {
            throw new Error(`Got an invalid response when tried to install app ${fullName}`)
          }
          await waitTillJobIsDone(client, response.pending_job_id, fullName)
        }
      }
    )
    return { deployResult, leftoverChanges }
  },
})

export default filterCreator
