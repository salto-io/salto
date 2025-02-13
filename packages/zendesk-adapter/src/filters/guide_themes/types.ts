/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'

type JobError = {
  title?: string
  code: string
  message?: string
  meta: object
}

const JOB_ERROR_SCHEMA = Joi.object({
  title: Joi.string(),
  code: Joi.string().required(),
  message: Joi.string(),
  meta: Joi.object().allow(null),
})

export type UploadJobData = {
  theme_id: string
  upload: {
    url: string
    parameters: {
      [key: string]: string
    }
  }
}

export type DownloadJobData = {
  download: {
    url: string
  }
}

const JOB_DATA_SCHEMA = Joi.alternatives().try(
  Joi.object({
    theme_id: Joi.string(),
    upload: Joi.object({
      url: Joi.string().required(),
      parameters: Joi.object(),
    }),
  }),
  Joi.object({
    download: Joi.object({
      url: Joi.string().required(),
    }),
  }),
)

export type PendingJob<JobData> = {
  id: string
  status: 'pending'
  data: JobData
}

type CompletedJob<JobData> = {
  id: string
  status: 'completed'
  data: JobData
}

export type FailedJob = {
  id: string
  status: 'failed'
  errors: JobError[]
}

export type UploadJob = PendingJob<UploadJobData> | CompletedJob<UploadJobData> | FailedJob
export type DownloadJob = FailedJob | PendingJob<DownloadJobData> | CompletedJob<DownloadJobData>
const jobSchema = (statuses = ['pending', 'failed', 'completed']): Joi.ObjectSchema =>
  Joi.object({
    id: Joi.string().required(),
    status: Joi.string()
      .valid(...statuses)
      .required(),
    data: JOB_DATA_SCHEMA.allow(null),
    errors: Joi.array().items(JOB_ERROR_SCHEMA).allow(null),
  })

const EXPECTED_PENDING_JOB_RESPONSE_SCHEMA = Joi.object({
  job: jobSchema(['pending']).required(),
}).required()

const EXPECTED_JOB_RESPONSE_SCHEMA = Joi.object({
  job: jobSchema().required(),
}).required()

export const isPendingJobResponse = <JobData>(value: unknown): value is { job: PendingJob<JobData> } =>
  createSchemeGuard<{ job: PendingJob<JobData> }>(
    EXPECTED_PENDING_JOB_RESPONSE_SCHEMA,
    'Received an invalid PendingJob response',
  )(value)

export const isJobResponse = createSchemeGuard<{ job: UploadJob | DownloadJob }>(
  EXPECTED_JOB_RESPONSE_SCHEMA,
  'Received an invalid FailedJob response',
)
