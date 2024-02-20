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
import ZendeskClient from '../../client/client'
import { pollJobStatus } from './api/pollJobStatus'
import { createAndUploadThemePackage } from './utils'
import { createThemeJob, JobType } from './api/createThemeJob'
import { PendingJob, UploadJobData } from './types'

const log = logger(module)

type UploadConfig = {
  brandId: number
  staticFiles: { filename: string; content: Buffer }[]
}

export const create = async (
  { staticFiles, brandId }: UploadConfig,
  client: ZendeskClient,
): Promise<{ themeId: string | undefined; errors: string[] }> => {
  const { job, errors } = await createThemeJob(brandId.toString(), client, JobType.IMPORTS)
  if (job === undefined) {
    return { themeId: undefined, errors }
  }
  const { errors: uploadErrors } = await createAndUploadThemePackage(
    staticFiles,
    job as PendingJob<UploadJobData>,
    client,
  )
  errors.push(...uploadErrors)

  const { success: pollSuccess, errors: pollErrors } = await pollJobStatus(job.id, client)
  errors.push(...pollErrors)
  if (!pollSuccess) {
    log.warn(
      `Failed to receive 'completed' job status from Zendesk API. Could not verify upload of new theme to brand ${brandId}`,
    )
  } else {
    log.trace('Theme created successfully, id: %s', (job as PendingJob<UploadJobData>).data.theme_id)
  }

  return { themeId: (job as PendingJob<UploadJobData>).data.theme_id, errors }
}
