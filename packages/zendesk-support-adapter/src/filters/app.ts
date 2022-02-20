/*
*                      Copyright 2022 Salto Labs Ltd.
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
import {
  Change, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { retry } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import ZendeskClient from '../client/client'

export const APP_INSTALLATION_TYPE_NAME = 'app_installation'

const { withRetry } = retry
const { intervals } = retry.retryStrategies

const MAX_RETRIES = 60
const INTERVAL_TIME = 2000

const checkIfJobIsDone = async (
  client: ZendeskClient, jobId: string, fullName: string
): Promise<boolean> => {
  const res = await client.getSinglePage({ url: `/apps/job_statuses/${jobId}` })
  if (_.isArray(res.data)) {
    throw new Error(`Got an invalid response for job status. Element: ${fullName}. Job ID: ${jobId}`)
  }
  if (['failed', 'killed'].includes(res.data.status)) {
    throw new Error(`Job status is failed. Element: ${fullName}. Job ID: ${jobId}. Error: ${res.data.message}`)
  }
  return res.data.status === 'completed'
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
