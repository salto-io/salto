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
import Joi from 'joi'
import path from 'path'
import origGlob from 'glob'
import { promisify } from 'util'
import { Readable } from 'stream'

import { createS3Client } from '@salto-io/aws-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { readTextFile, rm, rename, replaceContents } from '@salto-io/file'
import { inspectValue, safeJsonStringify, createSchemeGuard } from '@salto-io/adapter-utils'

import { StateContentProvider, getHashFromHashes } from './common'

const { awu } = collections.asynciterable
const glob = promisify(origGlob)

const log = logger(module)

type LocalStateFileContent = {
  account: string
  contentHash: string
}
const isLocalStateFileContent = createSchemeGuard<LocalStateFileContent>(
  Joi.object({
    account: Joi.string().required(),
    contentHash: Joi.string().required(),
  })
)

const parseLocalStateFile = async (filePath: string): Promise<LocalStateFileContent> => {
  const content = await readTextFile(filePath)
  const parsedContent = JSON.parse(content)
  if (!isLocalStateFileContent(parsedContent)) {
    throw new Error('Invalid local state file content')
  }
  return parsedContent
}

const buildLocalStateFileName = (prefix: string, account: string): string => (
  `${prefix}.${account}.json`
)

const findStateFiles = (prefix: string): Promise<string[]> => (
  glob(buildLocalStateFileName(prefix, '*([!.])'))
)

type CreateS3StateContentProviderArgs = {
  workspaceId: string
  bucketName: string
}
export const createS3StateContentProvider = (
  { workspaceId, bucketName }: CreateS3StateContentProviderArgs
): StateContentProvider => {
  const buildRemoteStateFileName = ({ account, contentHash }: LocalStateFileContent): string => (
    `${workspaceId}/${account}/${contentHash}`
  )

  const s3 = createS3Client()
  return {
    findStateFiles,
    clear: async prefix => {
      // We do not clear the current state file content from S3 on purpose as we expect that historic states
      // could be useful, and if not, that a lifecycle can be setup on S3 to remove them
      // This is to keep in line with the fact that we do not delete the previous state file on every writeContents
      const localFiles = await findStateFiles(prefix)
      await Promise.all(localFiles.map(filename => rm(filename)))
    },
    rename: async (oldPrefix, newPrefix) => {
      // Rename has no affect on the remote files, we just need to move the local files
      const stateFiles = await findStateFiles(oldPrefix)
      await awu(stateFiles).forEach(async filename => {
        const newFilePath = filename.replace(oldPrefix, path.join(path.dirname(oldPrefix), newPrefix))
        await rename(filename, newFilePath)
      })
    },
    getHash: async filePaths => {
      const allHashes = await awu(filePaths).map(parseLocalStateFile).map(parsed => parsed.contentHash).toArray()
      return getHashFromHashes(allHashes)
    },
    readContents: filePaths => (
      awu(filePaths)
        .map(parseLocalStateFile)
        .map(async parsedFile => {
          const remoteStatePath = buildRemoteStateFileName(parsedFile)
          log.debug('Creating state content read stream from %s/%s', bucketName, remoteStatePath)
          const readRes = await s3.getObject({ Bucket: bucketName, Key: remoteStatePath })
          const stream = readRes.Body
          if (!(stream instanceof Readable)) {
            throw new Error(`Failed to read content of remote state ${remoteStatePath}: ${inspectValue(readRes)}`)
          }
          return { name: parsedFile.account, stream }
        })
    ),
    writeContents: async (prefix, contents) => {
      // Upload content to S3
      await Promise.all(contents.map(async ({ account, content, contentHash }) => {
        const remoteStatePath = buildRemoteStateFileName({ account, contentHash })
        log.debug('Uploading state content to %s/%s', bucketName, remoteStatePath)
        await s3.putObject({ Bucket: bucketName, Key: remoteStatePath, Body: content })
      }))
      // Update local files to point to new hash values
      await Promise.all(contents.map(async ({ account, contentHash }) => {
        await replaceContents(
          buildLocalStateFileName(prefix, account),
          safeJsonStringify({ account, contentHash } as LocalStateFileContent)
        )
      }))
    },
  }
}
