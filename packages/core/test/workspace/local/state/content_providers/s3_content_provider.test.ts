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
import _ from 'lodash'
import path from 'path'
import { Readable } from 'stream'
import getStream from 'get-stream'
import { collections } from '@salto-io/lowerdash'
import { setupTmpDir } from '@salto-io/test-utils'
import { writeFile, readDir } from '@salto-io/file'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommandInput,
  S3Client,
  ServiceInputTypes,
  ServiceOutputTypes,
} from '@aws-sdk/client-s3'
import { AwsStub, mockClient } from 'aws-sdk-client-mock'
import { sdkStreamMixin } from '@aws-sdk/util-stream-node'
import {
  createS3StateContentProvider,
  StateContentProvider,
} from '../../../../../src/local-workspace/state/content_providers'
import { LocalStateFileContent } from '../../../../../src/local-workspace/state/content_providers/s3_content_provider'

const { awu } = collections.asynciterable

describe('createS3StateContentProvider', () => {
  const testDir = setupTmpDir()
  const accountNames = ['jira', 'dummy']
  const nonStateFiles = ['env.dummy.jsonl.zip', 'nonEnv.dummy.json', 'env.dummy.json.bla']
  const workspaceId = 'ws'
  const bucketName = 'bucket'

  const envPrefix = (): string => path.join(testDir.name(), 'env')

  let provider: StateContentProvider
  let s3mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>
  beforeAll(() => {
    s3mock = mockClient(S3Client)
  })

  const makeS3GetObjectReturnUploadedContent = (): void => {
    // For each `PutObject` that ran, make it's body be the return value
    // for future `GetObject` commands on the same key
    s3mock.calls().forEach(({ args }) => {
      const input = args[0].input as PutObjectCommandInput
      if (_.isString(input.Key) && Buffer.isBuffer(input.Body)) {
        s3mock
          .on(GetObjectCommand, { Bucket: input.Bucket, Key: input.Key })
          .resolves({ Body: sdkStreamMixin(Readable.from(input.Body)) })
      }
    })
  }

  const setupStateFile = async (account: string, contentHash: string, remoteHash?: string): Promise<void> => {
    const localContent: LocalStateFileContent = { account, contentHash }
    await writeFile(path.join(testDir.name(), `env.${account}.json`), safeJsonStringify(localContent))
    s3mock
      .on(GetObjectCommand, { Bucket: bucketName, Key: `state/${workspaceId}/${account}/${remoteHash ?? contentHash}` })
      .resolves({ Body: sdkStreamMixin(Readable.from('stateData')) })
  }

  beforeEach(async () => {
    s3mock.reset()
    provider = createS3StateContentProvider({ workspaceId, options: { bucket: bucketName } })
    await Promise.all(accountNames.map(name => setupStateFile(name, 'hash')))
    await Promise.all(nonStateFiles.map(name => writeFile(path.join(testDir.name(), name), 'data')))
  })

  describe('findStateFiles', () => {
    it('should match only file names of the correct environment state files', async () => {
      expect(await provider.findStateFiles(envPrefix())).toIncludeSameMembers(
        accountNames.map(name => path.join(testDir.name(), `env.${name}.json`)),
      )
    })
  })
  describe('clear', () => {
    let files: string[]
    beforeEach(async () => {
      await provider.clear(envPrefix())
      files = await readDir(testDir.name())
    })
    it('should remove all state files', () => {
      expect(files).not.toIncludeAnyMembers(accountNames.map(name => `env.${name}.json`))
    })
    it('should not delete non state files', () => {
      expect(files).toIncludeSameMembers(nonStateFiles)
    })
    it('should not delete content in s3', () => {
      expect(s3mock.calls()).toHaveLength(0)
    })
  })
  describe('rename', () => {
    let files: string[]
    beforeEach(async () => {
      await provider.rename(envPrefix(), 'new_env_name')
      files = await readDir(testDir.name())
    })
    it('should rename state files', () => {
      expect(files).toIncludeAllMembers(accountNames.map(name => `new_env_name.${name}.json`))
    })
    it('should not rename non state files', () => {
      expect(files).toIncludeAllMembers(nonStateFiles)
    })
    it('should not change content in s3', () => {
      expect(s3mock.calls()).toHaveLength(0)
    })
  })
  describe('getHash', () => {
    describe('when state file local content has invalid format', () => {
      let invalidFilePath: string
      beforeEach(async () => {
        invalidFilePath = path.join(testDir.name(), 'env.dummy.json')
        await writeFile(invalidFilePath, safeJsonStringify({ some: 'data' }))
      })
      it('should fail', async () => {
        await expect(provider.getHash([invalidFilePath])).rejects.toThrow()
      })
    })
    it('should return a stable hash of the files contents', async () => {
      // Note: this test basically forces a specific implementation of the hash function
      // this is good to make sure we don't accidentally cause cache invalidation
      // if this test breaks and you intentionally changed the hash algorithm or if you changed the setup in some way
      // change the test and update it with the new correct value.
      // be aware that this test failing when the setup did not change means all existing workspaces will have
      // their cache invalidated the next time they are loaded
      expect(await provider.getHash(await provider.findStateFiles(envPrefix()))).toEqual(
        'd9aa9112a3ad7cb016e0925b0f6898ca',
      )
    })
  })
  describe('readContents', () => {
    it('should return a stream with the content of all state files', async () => {
      const streamToContent = await awu(provider.readContents(await provider.findStateFiles(envPrefix())))
        .map(async ({ name, stream }) => ({ name, content: await getStream.buffer(stream) }))
        .toArray()
      expect(streamToContent).toIncludeSameMembers(
        accountNames.map(name => ({
          name: path.join(testDir.name(), `env.${name}.json`),
          content: Buffer.from('stateData'),
        })),
      )
    })
    describe('when remote file is missing', () => {
      beforeEach(async () => {
        await setupStateFile(accountNames[0], 'localHash', 'remoteHash')
        s3mock
          .on(GetObjectCommand)
          .rejects(new NoSuchKey({ message: 'The specified key does not exist.', $metadata: {} }))
      })
      it('should return an iterator that fails to read', async () => {
        const contentIter = provider.readContents(await provider.findStateFiles(envPrefix()))
        await expect(awu(contentIter).toArray()).rejects.toThrow()
      })
    })
  })
  describe('writeContents', () => {
    beforeEach(async () => {
      await provider.writeContents(
        envPrefix(),
        accountNames.map(account => ({ account, content: Buffer.from('newStateData'), contentHash: 'newHash' })),
      )
    })
    it('should upload new data to S3', () => {
      expect(s3mock.calls().map(({ args }) => args[0].input)).toIncludeSameMembers(
        accountNames.map(account =>
          expect.objectContaining({ Bucket: bucketName, Key: `state/${workspaceId}/${account}/newHash` }),
        ),
      )
    })
    it('should return the new contents when reading', async () => {
      makeS3GetObjectReturnUploadedContent()

      const streamToContent = await awu(provider.readContents(await provider.findStateFiles(envPrefix())))
        .map(async ({ name, stream }) => ({ name, content: await getStream.buffer(stream) }))
        .toArray()
      expect(streamToContent).toIncludeSameMembers(
        accountNames.map(name => ({
          name: path.join(testDir.name(), `env.${name}.json`),
          content: Buffer.from('newStateData'),
        })),
      )
    })
  })
})
