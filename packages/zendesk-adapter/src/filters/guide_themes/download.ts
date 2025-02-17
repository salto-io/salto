/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import ZendeskClient from '../../client/client'
import { createThemeJob, JobType } from './api/createThemeJob'
import { pollJobStatus } from './api/pollJobStatus'
import { DownloadJobData, PendingJob } from './types'

const log = logger(module)

const downloadTheme = async (
  jobData: DownloadJobData,
  client: ZendeskClient,
): Promise<{ content: Buffer | undefined; errors: string[] }> => {
  const response = await client.getResource({ url: jobData.download.url, responseType: 'arraybuffer' })
  const content = _.isString(response.data) ? Buffer.from(response.data) : response.data
  if (!Buffer.isBuffer(content)) {
    log.warn(`Received invalid response from Zendesk API. Not adding theme content ${safeJsonStringify(response.data)}`)
    return { content: undefined, errors: [safeJsonStringify(response.data)] }
  }
  return { content, errors: [] }
}

export const download = async (
  themeId: string,
  client: ZendeskClient,
): Promise<{ content: Buffer | undefined; errors: string[] }> => {
  const { job, errors } = await createThemeJob(themeId, client, JobType.EXPORTS)
  if (job === undefined) {
    log.warn(`Received invalid response from Zendesk API. Not adding theme ${themeId}`)
    return { content: undefined, errors }
  }
  const { success: pollSuccess, errors: pollErrors } = await pollJobStatus(job.id, client)
  errors.push(...pollErrors)
  if (!pollSuccess) {
    log.warn(`Failed to receive 'completed' job status from Zendesk API. Not adding theme ${themeId}`)
    return { content: undefined, errors }
  }
  const { content, errors: downloadErrors } = await downloadTheme((job as PendingJob<DownloadJobData>).data, client)
  errors.push(...downloadErrors)
  return { content, errors }
}
