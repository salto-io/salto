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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import FormData from 'form-data'
import JSZip from 'jszip'
import ZendeskClient from '../../client/client'
import { PendingJob, UploadJobData } from './types'

const log = logger(module)

export const createThemePackage = async (
  staticFiles: { filename: string; content: Buffer }[],
  replaceSettings = true,
): Promise<NodeJS.ReadableStream> => {
  const zip = new JSZip()
  staticFiles.forEach(file => {
    if (file.filename.includes('/settings/') && !replaceSettings) {
      log.debug('Skipping settings file %s', file)
      return
    }
    if (file.content === undefined) {
      log.debug('Skipping file %s with undefined content', file.filename)
      return
    }
    zip.file(file.filename, file.content)
  })
  return zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
}

export const uploadThemePackage = async (
  job: PendingJob<UploadJobData>,
  readStream: NodeJS.ReadableStream,
  client: ZendeskClient,
): Promise<{ errors: string[] }> => {
  log.trace('Uploading theme package for job %s', job.id)

  const formData = new FormData()
  Object.entries(job.data.upload.parameters).forEach(([key, value]) => {
    formData.append(key, value)
  })

  formData.append('file', readStream)
  const response = await client.post({
    url: job.data.upload.url,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data', ...formData.getHeaders() },
  })
  if (![200, 201].includes(response.status)) {
    log.warn(`Could not upload theme package for job ${job.id}, received ${response.data}`)
    return { errors: [safeJsonStringify(response.data)] }
  }
  return { errors: [] }
}

export const createAndUploadThemePackage = async (
  staticFiles: { filename: string; content: Buffer }[],
  job: PendingJob<UploadJobData>,
  client: ZendeskClient,
  replaceSettings = true,
): Promise<{ errors: string[] }> => {
  const readStream = await createThemePackage(staticFiles, replaceSettings)
  return uploadThemePackage(job, readStream, client)
}
