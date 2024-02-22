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
import { staticFiles } from '@salto-io/workspace'
import * as AWS from '@aws-sdk/client-s3'
import { Readable } from 'stream'
import { buildS3DirectoryStore } from '../../../src/local-workspace/s3_dir_store'

describe('buildS3DirectoryStore', () => {
  const bucketName = 'bucketName'
  const baseDir = 'baseDir'
  let directoryStore: staticFiles.StateStaticFilesStore
  let getObjectMock: jest.Mock
  let listObjectsV2Mock: jest.Mock
  let putObjectMock: jest.Mock

  beforeEach(() => {
    getObjectMock = jest.fn().mockResolvedValue(undefined)
    listObjectsV2Mock = jest.fn().mockResolvedValue(undefined)
    putObjectMock = jest.fn().mockResolvedValue(undefined)

    const mockS3Client = {
      getObject: getObjectMock,
      listObjectsV2: listObjectsV2Mock,
      putObject: putObjectMock,
    }

    directoryStore = buildS3DirectoryStore({
      bucketName,
      baseDir,
      S3Client: mockS3Client as unknown as AWS.S3,
    })
  })

  describe('list', () => {
    it('should return true if the file exists', async () => {
      listObjectsV2Mock
        .mockResolvedValueOnce({
          Contents: [{ Key: `${baseDir}/a1` }, { Key: `${baseDir}/a2` }],
          NextContinuationToken: 'nextToken',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: `${baseDir}/a3` }, { Key: `${baseDir}/a4` }],
        })
      expect(await directoryStore.list()).toEqual(['a1', 'a2', 'a3', 'a4'])
      expect(listObjectsV2Mock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Prefix: baseDir,
        ContinuationToken: undefined,
      })

      expect(listObjectsV2Mock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Prefix: baseDir,
        ContinuationToken: 'nextToken',
      })
    })

    it('should throw on unexpected error', async () => {
      listObjectsV2Mock.mockRejectedValue(new Error())
      await expect(directoryStore.list()).rejects.toThrow()
      expect(listObjectsV2Mock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Prefix: baseDir,
        ContinuationToken: undefined,
      })
    })

    it('should use cached data', async () => {
      listObjectsV2Mock.mockResolvedValueOnce({
        Contents: [],
      })

      await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })
      expect(await directoryStore.list()).toEqual(['a/b'])

      expect(listObjectsV2Mock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Prefix: baseDir,
        ContinuationToken: undefined,
      })
    })
  })

  describe('get', () => {
    it('should return the file if exists', async () => {
      const readable = new Readable()
      readable.push('body')
      readable.push(null)
      getObjectMock.mockResolvedValue({
        Body: readable,
      })
      expect(await directoryStore.get('a/b')).toEqual({
        filename: 'a/b',
        buffer: Buffer.from('body'),
      })
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })

    it('should return undefined if received unexpected type', async () => {
      getObjectMock.mockResolvedValue({
        Body: 'unexpected',
      })
      expect(await directoryStore.get('a/b')).toBeUndefined()
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })

    it('should return undefined the file does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getObjectMock.mockRejectedValue({ name: 'NoSuchKey' })
      expect(await directoryStore.get('a/b')).toBeUndefined()
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })

    it('should return undefined the body was not returned', async () => {
      getObjectMock.mockResolvedValue({})
      expect(await directoryStore.get('a/b')).toBeUndefined()
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })

    it('should use cached data', async () => {
      await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })
      expect(await directoryStore.get('a/b')).toEqual({
        filename: 'a/b',
        buffer: Buffer.from('aaa'),
      })

      expect(getObjectMock).not.toHaveBeenCalled()
    })

    it('should throw on unexpected error', async () => {
      getObjectMock.mockRejectedValue(new Error())
      await expect(directoryStore.get('a/b')).rejects.toThrow()
      expect(getObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
      })
    })
  })

  describe('set', () => {
    it('should write the file', async () => {
      await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })

      expect(putObjectMock).not.toHaveBeenCalled()

      await directoryStore.flush()

      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
        Body: Buffer.from('aaa'),
      })
    })

    it('should throw on unexpected error', async () => {
      putObjectMock.mockRejectedValue(new Error())
      await directoryStore.set({ filename: '', buffer: Buffer.from('aaa') })
      await expect(directoryStore.flush()).rejects.toThrow()
      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir',
        Body: Buffer.from('aaa'),
      })
    })

    it('should write the file only once', async () => {
      await directoryStore.set({ filename: 'a/b', buffer: Buffer.from('aaa') })

      expect(putObjectMock).not.toHaveBeenCalled()

      await directoryStore.flush()

      expect(putObjectMock).toHaveBeenCalledWith({
        Bucket: bucketName,
        Key: 'baseDir/a/b',
        Body: Buffer.from('aaa'),
      })

      await directoryStore.flush()

      expect(putObjectMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('getFullPath', () => {
    it('should throw on unexpected error', async () => {
      expect(directoryStore.getFullPath('somePath')).toBe(`s3://${bucketName}/baseDir/somePath`)
    })
  })
})
