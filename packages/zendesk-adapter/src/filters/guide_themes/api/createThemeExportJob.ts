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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import ZendeskClient from '../../../client/client'
import { DownloadJobData, PendingJob, isPendingJobResponse } from '../types'

const log = logger(module)

export const createThemeExportJob = async (
  themeId: string, client: ZendeskClient
): Promise<{ job: PendingJob<DownloadJobData> | undefined; errors: string[] }> => {
  log.trace('Creating theme export job')

  const res = await client.post({
    url: '/api/v2/guide/theming/jobs/themes/exports',
    data: {
      job: {
        attributes: {
          theme_id: themeId,
          format: 'zip',
        },
      },
    },
  })
  if (![200, 202].includes(res.status)) {
    log.warn(`Could not export a theme for themeId ${themeId}, received ${safeJsonStringify(res.data)}`)
    return { job: undefined, errors: [safeJsonStringify(res.data)] }
  }
  return { job: isPendingJobResponse<DownloadJobData>(res.data) ? res.data.job : undefined, errors: [] }
}
