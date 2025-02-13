/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client as clientUtils } from '@salto-io/adapter-components'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import ZendeskClient from '../../../client/client'
import { DownloadJobData, isPendingJobResponse, PendingJob, UploadJobData } from '../types'

const log = logger(module)
export enum JobType {
  EXPORTS = 'exports',
  IMPORTS = 'imports',
}

export const createThemeJob = async (
  id: string,
  client: ZendeskClient,
  jobType: JobType,
): Promise<{ job: PendingJob<DownloadJobData | UploadJobData> | undefined; errors: string[] }> => {
  const idType = jobType === JobType.EXPORTS ? 'theme_id' : 'brand_id'
  log.trace(`Creating theme ${jobType} job for ${idType} ${id}`)
  try {
    const res = await client.post({
      url: `/api/v2/guide/theming/jobs/themes/${jobType}`,
      data: {
        job: {
          attributes: {
            [idType]: id,
            format: 'zip',
          },
        },
      },
    })
    if (![200, 202].includes(res.status)) {
      log.warn(`Could not ${jobType} a theme for ${idType} ${id}, received ${safeJsonStringify(res.data)}`)
      return { job: undefined, errors: [safeJsonStringify(res.data)] }
    }
    const isPendingJob =
      jobType === JobType.EXPORTS
        ? isPendingJobResponse<DownloadJobData>(res.data)
        : isPendingJobResponse<UploadJobData>(res.data)
    return {
      job: isPendingJob ? (res.data as unknown as { job: PendingJob<DownloadJobData | UploadJobData> }).job : undefined,
      errors: [],
    }
  } catch (e) {
    if (e instanceof clientUtils.HTTPError) {
      log.warn(`Could not update a theme for ${idType} ${id}. Received ${e.response.data}`)
      if (Array.isArray(e.response.data?.errors)) {
        return {
          job: undefined,
          errors: e.response.data.errors.map(err => `${err.code} - ${err.message ?? err.title}`),
        }
      }
      return { job: undefined, errors: [e.message] }
    }
    throw e
  }
}
