/*
*                      Copyright 2022 Salto Labs Ltd.
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
import * as file from '@salto-io/file'
import { collections } from '@salto-io/lowerdash'
import { mockFunction } from '@salto-io/test-utils'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { staticFiles, remoteMap } from '@salto-io/workspace'
import { buildLocalStaticFilesCache } from '../../../src/local-workspace/static_files_cache'

const { DefaultMap } = collections.map

jest.mock('@salto-io/file')
describe('Static Files Cache', () => {
  const mockFileExists = file.exists as jest.Mock
  const mockReadFile = file.readTextFile as unknown as jest.Mock

  let staticFilesCache: staticFiles.StaticFilesCache

  const baseMetaData = {
    hash: 'hashz',
    filepath: 'some/path.ext',
  }
  const expectedResult = {
    filepath: baseMetaData.filepath,
    hash: baseMetaData.hash,
    modified: 123,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })
  describe('new cache', () => {
    let remoteMapCreator: jest.MockedFunction<remoteMap.RemoteMapCreator>

    beforeEach(() => {
      // We keep a cache to simulate the fact that remote maps
      // with the same namespace point to the same entries.
      const remoteMaps = new DefaultMap(() => new remoteMap.InMemoryRemoteMap())
      remoteMapCreator = mockFunction<remoteMap.RemoteMapCreator>().mockImplementation(
        async opts => remoteMaps.get(opts.namespace)
      )
      staticFilesCache = buildLocalStaticFilesCache('path', 'test-env', remoteMapCreator)
    })
    it('should handle unknown file paths', async () => {
      expect((await staticFilesCache.get(baseMetaData.filepath))).toBeUndefined()
    })
    it('puts and retrieves value', async () => {
      await staticFilesCache.put(expectedResult)
      expect(await staticFilesCache.get(baseMetaData.filepath)).toEqual(expectedResult)
    })
    it('clear', async () => {
      await staticFilesCache.put(expectedResult)
      await staticFilesCache.clear()
      expect(await staticFilesCache.get(baseMetaData.filepath)).toBeUndefined()
    })
    it('rename', async () => {
      await staticFilesCache.put(expectedResult)
      await staticFilesCache.rename('new-env')
      expect(remoteMapCreator).toHaveBeenCalledTimes(2)
      expect(remoteMapCreator).toHaveBeenLastCalledWith(expect.objectContaining({ namespace: 'staticFilesCache-new-env' }))
      expect(await staticFilesCache.get(baseMetaData.filepath)).toEqual(expectedResult)
    })
    it('clone', async () => {
      await staticFilesCache.put(expectedResult)
      const cloned = staticFilesCache.clone()
      expect(await cloned.get(baseMetaData.filepath)).toEqual(expectedResult)
      expect(cloned).not.toBe(staticFilesCache)
    })
  })
  describe('when migrating cache', () => {
    const expectedCacheKey = baseMetaData.filepath
    const expectedCacheContent = safeJsonStringify({
      [expectedCacheKey]: expectedResult,
    })
    const remoteMapCreator = mockFunction<remoteMap.RemoteMapCreator>().mockImplementation(
      async () => new remoteMap.InMemoryRemoteMap()
    )

    it('migrates old cache file if exists', async () => {
      mockFileExists.mockResolvedValueOnce(true)
      mockReadFile.mockResolvedValueOnce(expectedCacheContent)
      staticFilesCache = buildLocalStaticFilesCache('path', 'test-env', remoteMapCreator)
      return expect(staticFilesCache.get(baseMetaData.filepath)).resolves.toEqual(expectedResult)
    })
    it('does not import old cache file if cache already populated', async () => {
      const oldCache = buildLocalStaticFilesCache('path', 'test-env', remoteMapCreator)
      await oldCache.put({ filepath: 'something.txt', hash: 'bla', modified: 123 })
      mockFileExists.mockResolvedValueOnce(true)
      mockReadFile.mockResolvedValueOnce(expectedCacheContent)
      staticFilesCache = buildLocalStaticFilesCache('path', 'test-env', remoteMapCreator)
      return expect(staticFilesCache.get(baseMetaData.filepath)).resolves.toEqual(expectedResult)
    })
  })
})
