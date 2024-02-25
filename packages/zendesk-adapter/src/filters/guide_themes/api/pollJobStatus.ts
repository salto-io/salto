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
import { logger } from '@salto-io/logging'
import { retry } from '@salto-io/lowerdash'
import ZendeskClient from '../../../client/client'
import { FailedJob, isJobResponse } from '../types'

const {
  withRetry,
  retryStrategies: { intervals },
} = retry
const log = logger(module)

class JobError extends Error {
  constructor(
    message: string,
    readonly jobId: string,
    readonly errors?: FailedJob['errors'],
  ) {
    super(message)
  }
}

const checkIfJobIsDone = async (client: ZendeskClient, jobId: string): Promise<boolean> => {
  const response = await client.get({ url: `/api/v2/guide/theming/jobs/${jobId}` })
  if (!isJobResponse(response.data)) {
    throw new JobError(`Got an invalid response for Guide Theme job status. Job ID: ${jobId}`, jobId)
  }
  const { job } = response.data
  if (job.status === 'failed') {
    throw new JobError(`Job status is failed. Job ID: ${jobId}.`, jobId, job.errors)
  }
  return job.status === 'completed'
}

export const pollJobStatus = async (
  jobId: string,
  client: ZendeskClient,
  interval = 5000,
  retries = 5,
): Promise<{ success: boolean; errors: string[] }> => {
  log.trace('Polling job status')
  try {
    return {
      success: await withRetry(() => checkIfJobIsDone(client, jobId), {
        strategy: intervals({ maxRetries: retries, interval }),
      }),
      errors: [],
    }
  } catch (e) {
    if (e instanceof JobError) {
      log.warn(e.message)
      return {
        success: false,
        errors: e.errors ? e.errors.map(err => `${err.code} - ${err.message ?? err.title}`) : [e.message],
      }
    }
    log.error((e as Error).message)
    return { success: false, errors: [(e as Error).message] }
  }
}
