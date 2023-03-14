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
import path from 'path'
import { logger } from '@salto-io/logging'
import * as AWS from '@aws-sdk/client-s3'
import { createS3Client } from '@salto-io/aws-utils'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { dirStore, staticFiles } from '@salto-io/workspace'
import Bottleneck from 'bottleneck'
import getStream from 'get-stream'
import { Readable } from 'stream'
import { values } from '@salto-io/lowerdash'

const log = logger(module)

const DEFAULT_CONCURRENCY_LIMIT = 100

export const buildS3DirectoryStore = (
  {
    bucketName,
    baseDir,
    S3Client,
    concurrencyLimit = DEFAULT_CONCURRENCY_LIMIT,
  }: {
    bucketName: string
    baseDir: string
    S3Client?: AWS.S3
    concurrencyLimit?: number
  }
): staticFiles.StateStaticFilesStore => {
  const updated: Record<string, dirStore.File<Buffer>> = {}
  const s3 = S3Client ?? createS3Client()
  const bottleneck = new Bottleneck({ maxConcurrent: concurrencyLimit })

  const getFullPath = (filePath: string): string =>
    path.posix.join(baseDir, filePath)

  const readFile = async (filePath: string): Promise<dirStore.File<Buffer> | undefined> => {
    const fullFilePath = getFullPath(filePath)

    try {
      const s3Obj = await bottleneck.schedule(
        () => {
          log.trace('Reading %s from S3 bucket %s', fullFilePath, bucketName)
          return s3.getObject({ Bucket: bucketName, Key: fullFilePath })
        }
      )

      if (!(s3Obj.Body instanceof Readable)) {
        log.error('Received unexpected body type from s3.getObject: %s', safeJsonStringify(s3Obj.Body))
        return undefined
      }

      const buffer = await getStream.buffer(s3Obj.Body)

      return { buffer, filename: filePath }
    } catch (err) {
      if (err.name === 'NoSuchKey') {
        return undefined
      }
      log.warn('Failed to read file %s from S3 bucket %s', fullFilePath, bucketName)
      throw err
    }
  }

  const writeFile = async (file: dirStore.File<Buffer>): Promise<void> => {
    const fullFilePath = getFullPath(file.filename)

    try {
      await bottleneck.schedule(
        async () => {
          log.trace('Writing %s with size of %d to S3 bucket %s', fullFilePath, file.buffer.length, bucketName)
          await s3.putObject({
            Bucket: bucketName,
            Key: fullFilePath,
            Body: file.buffer,
          })
          log.trace('Wrote %s to S3 bucket %s', fullFilePath, bucketName)
        }
      )
    } catch (err) {
      log.warn('Failed to write a file %s to S3 bucket %s', fullFilePath, bucketName)
      throw err
    }
  }

  const listPage = async (token: string | undefined): Promise<AWS.ListObjectsV2CommandOutput> =>
    bottleneck.schedule(
      () => {
        log.trace('Listing %s in S3 bucket %s with token %s', baseDir, bucketName, token)
        return s3.listObjectsV2({
          Bucket: bucketName,
          Prefix: baseDir,
          ContinuationToken: token,
        })
      }
    )

  const list = async (): Promise<string[]> => log.time(
    async () => {
      const paths = new Set<string>(Object.keys(updated))
      let currentPage: AWS.ListObjectsV2CommandOutput | undefined
      try {
        do {
          // eslint-disable-next-line no-await-in-loop
          currentPage = await listPage(currentPage?.NextContinuationToken)
          currentPage.Contents
            ?.map(({ Key }) => Key && path.posix.relative(baseDir, Key))
            .filter(values.isDefined)
            .forEach(key => paths.add(key))
        } while (currentPage?.NextContinuationToken !== undefined)
      } catch (err) {
        log.warn('Failed listing %s in S3 bucket %s with token %s', baseDir, bucketName, currentPage?.NextContinuationToken)
        throw err
      }

      return Array.from(paths)
    },
    `listing s3 objects for ${baseDir}`,
  )

  const flush = async (): Promise<void> => {
    await Promise.all(Object.values(updated).map(f => writeFile(f)))
  }

  return {
    get: async filePath => (updated[filePath] ? updated[filePath] : readFile(filePath)),
    set: async file => { updated[file.filename] = file },
    list,
    getFullPath: filePath => `s3://${bucketName}/${getFullPath(filePath)}`,
    flush,
  }
}
