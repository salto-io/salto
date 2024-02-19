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

import { logger } from '@salto-io/logging'
import {
  filterFilePathsInFolders,
  filterFilesInFolders,
  filterFolderPathsInFolders,
  largeFoldersToExclude,
} from '../../src/client/file_cabinet_utils'

const logging = logger('netsuite-adapter/src/client/file_cabinet_utils')

describe('excludeLargeFolders', () => {
  it('should not exclude any folders if there is no size overflow', () => {
    const filesToSize = [
      { path: '/folder/path1', size: 500_000 },
      { path: '/folder/path2', size: 500_000 },
    ]
    const largeFolders = largeFoldersToExclude(filesToSize, 1)
    expect(largeFolders).toEqual([])
  })

  describe('when there is a size overflow', () => {
    it('should exclude the last largest folder if there is a larger than overflow top level folder', () => {
      const filesToSize = [
        { path: '/largeTopFolder/largeFolder/path1', size: 1_000_000 },
        { path: '/largeTopFolder/largeFolder/path2', size: 1_000_000 },
        { path: '/largeTopFolder/smallFolder/path2', size: 500_000 },
        { path: '/smallTopFolder/path1', size: 500_000 },
      ]
      const largeFolders = largeFoldersToExclude(filesToSize, 0.002)
      expect(largeFolders).toEqual(['/largeTopFolder/largeFolder/'])
    })

    it('should exclude multiple largest top level folders if there are no larger than overflow top level folders', () => {
      const filesToSize = [
        { path: '/firstTopFolder/path1', size: 1_700_000 },
        { path: '/thirdTopFolder/path2', size: 1_500_000 },
        { path: '/secondTopFolder/path2', size: 1_600_000 },
        { path: '/fourthTopFolder/path2', size: 1_400_000 },
      ]
      const largeFolders = largeFoldersToExclude(filesToSize, 0.004)
      expect(largeFolders).toEqual(['/firstTopFolder/', '/secondTopFolder/'])
    })
  })

  it('should create a log when there is a warning overflow (1GB hardcoded), but no size overflow', () => {
    const log = jest.spyOn(logging, 'info')
    const filesToSize = [{ path: '/firstTopFolder/path1', size: 1_500_000_000 }]
    const largeFolders = largeFoldersToExclude(filesToSize, 2)
    expect(largeFolders).toEqual([])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('1.40 GB'))
  })
})

describe('filterFilePathsInFolders', () => {
  it('filters out files that appear in one of the folders', () => {
    const files = [{ path: ['a', 'b', 'c.ts'] }, { path: ['a', 'b', 'd.ts'] }, { path: ['a', 'z', 'w.ts'] }]
    const folders = ['/a/b/']
    const result = filterFilePathsInFolders(files, folders)
    expect(result).toEqual([{ path: ['a', 'z', 'w.ts'] }])
  })
})

describe('filterFolderPathsInFolders', () => {
  it('filters out folders that appear in one of the folders', () => {
    const files = [{ path: ['a', 'b'] }, { path: ['a', 'b', 'd'] }, { path: ['a', 'z'] }]
    const folders = ['/a/b/']
    const result = filterFolderPathsInFolders(files, folders)
    expect(result).toEqual([{ path: ['a', 'z'] }])
  })
})

describe('filterFilesInFolders', () => {
  it('filters out files or subfolders that appear in one of the folders', () => {
    const files = ['a/b/c.ts', 'a/b/d', 'a/z/w.ts']
    const folders = ['a/b/']
    const result = filterFilesInFolders(files, folders)
    expect(result).toEqual(['a/z/w.ts'])
  })
})

describe('exclude and filter', () => {
  it('works together when excluding files', () => {
    const filesToSize = [
      { path: '/largeTopFolder/largeFolder/path1', size: 1_000_000 },
      { path: '/largeTopFolder/largeFolder/path2', size: 1_000_000 },
      { path: '/largeTopFolder/smallFolder/path2', size: 500_000 },
      { path: '/smallTopFolder/path1', size: 500_000 },
    ]
    const largeFolders = largeFoldersToExclude(filesToSize, 0.002)
    const result = filterFilesInFolders(
      filesToSize.map(({ path }) => path),
      largeFolders,
    )
    expect(result).toEqual(['/largeTopFolder/smallFolder/path2', '/smallTopFolder/path1'])
  })

  it('works together when excluding file paths', () => {
    const filesPathsSize = [
      { path: ['largeTopFolder', 'largeFolder', 'path1'], size: 1_000_000 },
      { path: ['largeTopFolder', 'largeFolder', 'path2'], size: 1_000_000 },
      { path: ['largeTopFolder', 'smallFolder', 'path2'], size: 500_000 },
      { path: ['smallTopFolder', 'path1'], size: 500_000 },
    ]
    const filesToSize = filesPathsSize.map(({ path, size }) => ({ path: `/${path.join('/')}`, size }))
    const largeFolders = largeFoldersToExclude(filesToSize, 0.002)
    const result = filterFilePathsInFolders(filesPathsSize, largeFolders)
    expect(result).toEqual([
      { path: ['largeTopFolder', 'smallFolder', 'path2'], size: 500_000 },
      { path: ['smallTopFolder', 'path1'], size: 500_000 },
    ])
  })
})
