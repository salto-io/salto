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
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import ZendeskClient from '../../../client/client'
import { PendingJob, UploadJobData, isPendingJobResponse } from '../types'

const log = logger(module)

export const createThemeUpdateJob = async (
  themeId: string, replaceSettings: boolean, client: ZendeskClient
): Promise<{ job: PendingJob<UploadJobData> | undefined; errors: string[] }> => {
  log.trace('Creating theme update job')

  try {
    const res = await client.post({
      url: '/api/v2/guide/theming/jobs/themes/updates',
      data: {
        job: {
          attributes: {
            theme_id: themeId,
            replace_settings: replaceSettings,
            format: 'zip',
          },
        },
      },
    })
    if (![200, 202].includes(res.status)) {
      log.warn(`Could not update a theme for themeId ${themeId}, with replaceSettings: ${replaceSettings}. Received ${res.data}`)
      return { job: undefined, errors: [safeJsonStringify(res.data)] }
    }
    return { job: isPendingJobResponse<UploadJobData>(res.data) ? res.data.job : undefined, errors: [] }
  } catch (e) {
    if (e instanceof clientUtils.HTTPError) {
      log.warn(`Could not update a theme for themeId ${themeId}, with replaceSettings: ${replaceSettings}. Received ${e.response.data}`)
      if (e.response.data?.errors && Array.isArray(e.response.data.errors)) {
        return { job: undefined, errors: e.response.data.errors.map(err => `${err.code} - ${err.message ?? err.title}`) }
      }
      return { job: undefined, errors: [e.message] }
    }
    throw e
  }
}
