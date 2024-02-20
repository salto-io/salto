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
import FormData from 'form-data'
import JSZip from 'jszip'
import ZendeskClient from '../../../src/client/client'
import { PendingJob, UploadJobData } from '../../../src/filters/guide_themes/types'
import { createThemePackage, uploadThemePackage } from '../../../src/filters/guide_themes/utils'

describe('createThemePackage', () => {
  let staticFiles: { filename: string; content: Buffer }[]
  beforeEach(() => {
    staticFiles = [
      {
        filename: 'file1.txt',
        content: Buffer.from('file1'),
      },
      {
        filename: 'file2.txt',
        content: Buffer.from('file2'),
      },
      {
        filename: '/settings/file1.txt',
        content: Buffer.from('settingsFile1'),
      },
      {
        filename: 'noContent.txt',
        content: undefined as unknown as Buffer,
      },
    ]
  })

  it('should create a zip stream with the correct files', async () => {
    const replaceSettings = true
    const packageStream = await createThemePackage(staticFiles, replaceSettings)
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      packageStream.on('data', (chunk: Buffer) => chunks.push(chunk))
      packageStream.on('end', () => resolve(Buffer.concat(chunks)))
      packageStream.on('error', reject)
    })
    const zip = await JSZip.loadAsync(buffer)
    const files = Object.keys(zip.files)
    expect(files).toHaveLength(4)
    expect(files).toContain('file1.txt')
    expect(files).toContain('file2.txt')
    expect(files).toContain('/settings/file1.txt')
    expect(files).not.toContain('noContent.txt')
  })

  it('should not include settings files if replaceSettings is false', async () => {
    const replaceSettings = false
    const packageStream = await createThemePackage(staticFiles, replaceSettings)
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      packageStream.on('data', (chunk: Buffer) => chunks.push(chunk))
      packageStream.on('end', () => resolve(Buffer.concat(chunks)))
      packageStream.on('error', reject)
    })
    const zip = await JSZip.loadAsync(buffer)
    const files = Object.keys(zip.files)
    expect(files).toHaveLength(2)
    expect(files).toContain('file1.txt')
    expect(files).toContain('file2.txt')
    expect(files).not.toContain('/settings/file1.txt')
  })
})

describe('uploadThemePackage', () => {
  let mockPost: jest.SpyInstance
  let job: PendingJob<UploadJobData>
  let readStream: NodeJS.ReadableStream

  beforeEach(() => {
    mockPost = jest.fn()
    job = {
      id: '123',
      status: 'pending',
      data: {
        theme_id: '456',
        upload: {
          url: 'https://upload.url',
          parameters: {
            param1: 'value1',
            param2: 'value2',
          },
        },
      },
    }
    const zip = new JSZip()
    readStream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
  })

  it('should upload the theme package', async () => {
    mockPost.mockResolvedValue({ status: 200 })
    await uploadThemePackage(job, readStream, { post: mockPost } as unknown as ZendeskClient)
    expect(mockPost).toHaveBeenCalledWith({
      url: 'https://upload.url',
      data: expect.any(FormData),
      headers: expect.objectContaining({
        'Content-Type': 'multipart/form-data',
      }),
    })
  })

  it('should return errors if the upload fails', async () => {
    mockPost.mockResolvedValue({ status: 400, data: { error: 'error' } })
    const { errors } = await uploadThemePackage(job, readStream, { post: mockPost } as unknown as ZendeskClient)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toEqual('{"error":"error"}')
  })
})
