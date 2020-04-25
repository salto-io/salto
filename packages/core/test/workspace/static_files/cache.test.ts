/*
*                      Copyright 2020 Salto Labs Ltd.
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

import { StaticFilesCache } from '../../../src/workspace/static_files/cache'

import {
  buildLocalStaticFilesCache, CACHE_FILENAME,
} from '../../../src/workspace/local/static_files_cache'

jest.mock('@salto-io/file')
describe('Static Files Cache', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  const mockFileExists = file.exists as jest.Mock
  const mockReplaceContents = file.replaceContents as jest.Mock
  const mockReadFile = file.readTextFile as unknown as jest.Mock
  let staticFilesCache: StaticFilesCache

  const baseMetaData = {
    hash: 'hashz',
    filepath: 'some/path.ext',
  }

  const expectedResult = {
    ...baseMetaData,
    modified: 123,
  }

  const expectedCacheKey = baseMetaData.filepath

  const expectedCacheContent = JSON.stringify({
    [expectedCacheKey]: expectedResult,
  })

  beforeEach(() => {
    jest.resetAllMocks()
    staticFilesCache = buildLocalStaticFilesCache('cacheDir')
  })
  it('does not fail if no cache file exists', async () => {
    expect((await staticFilesCache.get(baseMetaData.filepath))).toBeUndefined()
  })
  it('uses content of cache file if existed', async () => {
    mockFileExists
      .mockResolvedValueOnce(true)
    mockReadFile.mockResolvedValueOnce(expectedCacheContent)
    staticFilesCache = buildLocalStaticFilesCache('cacheDir')
    return expect(staticFilesCache.get(baseMetaData.filepath)).resolves.toEqual(expectedResult)
  })
  it('puts and retrieves value', async () => {
    await staticFilesCache.put(expectedResult)
    return expect(staticFilesCache.get(baseMetaData.filepath)).resolves.toEqual(expectedResult)
  })
  it('flushes state to cache file', async () => {
    await staticFilesCache.put(expectedResult)
    await staticFilesCache.flush()
    expect(mockReplaceContents).toHaveBeenCalledTimes(1)
    const [filepath, content] = mockReplaceContents.mock.calls[0]
    expect(filepath).toMatch(new RegExp(`cacheDir\\/${CACHE_FILENAME}`))
    expect(content).toEqual(expectedCacheContent)
  })
  it('clones', async () => {
    await staticFilesCache.put(expectedResult)
    const staticFilesCacheClone = staticFilesCache.clone()
    return expect(staticFilesCacheClone.get(baseMetaData.filepath)).resolves.toEqual(expectedResult)
  })
})
