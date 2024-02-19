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
import { collections } from '@salto-io/lowerdash'
import { mockFunction } from '@salto-io/test-utils'
import * as remoteMap from '../../../src/workspace/remote_map'
import * as staticFiles from '../../../src/workspace/static_files'

const { DefaultMap } = collections.map
const { buildStaticFilesCache } = staticFiles

jest.mock('@salto-io/file')
describe('Static Files Cache', () => {
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
      remoteMapCreator = mockFunction<remoteMap.RemoteMapCreator>().mockImplementation(async opts =>
        remoteMaps.get(opts.namespace),
      )
      staticFilesCache = buildStaticFilesCache('test-env', remoteMapCreator, true)
    })
    it('should handle unknown file paths', async () => {
      expect(await staticFilesCache.get(baseMetaData.filepath)).toBeUndefined()
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
      expect(remoteMapCreator).toHaveBeenLastCalledWith(
        expect.objectContaining({ namespace: 'staticFilesCache-new-env' }),
      )
      expect(await staticFilesCache.get(baseMetaData.filepath)).toEqual(expectedResult)
    })
    it('clone', async () => {
      await staticFilesCache.put(expectedResult)
      const cloned = staticFilesCache.clone()
      expect(await cloned.get(baseMetaData.filepath)).toEqual(expectedResult)
      expect(cloned).not.toBe(staticFilesCache)
    })
    it('list', async () => {
      const file1 = {
        filepath: 'file1.txt',
        hash: 'HASH',
        modified: 123,
      }
      const file2 = {
        filepath: 'file2.txt',
        hash: 'HASH',
        modified: 123,
      }
      await staticFilesCache.put(file1)
      await staticFilesCache.put(file2)
      expect(await staticFilesCache.list()).toEqual([file1.filepath, file2.filepath])
    })
  })

  describe('remote map options', () => {
    let remoteMapCreator: jest.MockedFunction<remoteMap.RemoteMapCreator>
    beforeEach(() => {
      remoteMapCreator = mockFunction<remoteMap.RemoteMapCreator>().mockImplementation(
        async () => new remoteMap.InMemoryRemoteMap(),
      )
    })

    it('should respect the persistent parameter', async () => {
      const cache = buildStaticFilesCache('test-env', remoteMapCreator, false)
      await cache.get('bla')
      expect(remoteMapCreator).toHaveBeenCalledTimes(1)
      expect(remoteMapCreator).toHaveBeenCalledWith(expect.objectContaining({ persistent: false }))
    })
  })
})
