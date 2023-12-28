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
import _ from 'lodash'
import ZendeskClient from '../../client/client'
import { createThemeExportJob } from './api/createThemeExportJob'
import { pollJobStatus } from './api/pollJobStatus'
import { DownloadJobData } from './types'

const log = logger(module)

const downloadTheme = async (jobData: DownloadJobData, client: ZendeskClient): Promise<Buffer | undefined> => {
  const response = await client.getResource({ url: jobData.download.url, responseType: 'arraybuffer' })
  const content = _.isString(response.data) ? Buffer.from(response.data) : response.data
  if (!Buffer.isBuffer(content)) {
    log.warn(`Received invalid response from Zendesk API. Not adding theme content ${safeJsonStringify(response.data)}`)
    return undefined
  }
  return content
}

export const download = async (themeId: string, client: ZendeskClient): Promise<Buffer | undefined> => {
  const job = await createThemeExportJob(themeId, client)
  if (job === undefined) {
    log.warn(`Received invalid response from Zendesk API. Not adding theme ${themeId}`)
    return undefined
  }
  if (!(await pollJobStatus(job.id, client))) {
    log.warn(`Failed to receive 'completed' job status from Zendesk API. Not adding theme ${themeId}`)
    return undefined
  }
  return downloadTheme(job.data, client)
}
