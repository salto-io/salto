/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import { ElemID, InstanceElement, ObjectType, SaltoElementError, SaltoError } from '@salto-io/adapter-api'
import { ERROR_MESSAGES } from '@salto-io/adapter-utils'
import {
  createLargeFilesCountFolderFetchWarnings,
  filterFilePathsInFolders,
  filterFilesInFolders,
  filterFolderPathsInFolders,
  largeFoldersToExclude,
} from '../../src/client/file_cabinet_utils'
import { folderType } from '../../src/types/file_cabinet_types'
import { NETSUITE, PATH } from '../../src/constants'

const logging = logger('netsuite-adapter/src/client/file_cabinet_utils')

describe('file cabinet utils', () => {
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

  describe('create large files count folder fetch warnings', () => {
    let folderInstance1: InstanceElement
    let folderInstance2: InstanceElement
    let otherInstance: InstanceElement
    let fetchWarnings: (SaltoError | SaltoElementError)[]

    beforeEach(() => {
      const folder = folderType()
      const otherType = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
      folderInstance1 = new InstanceElement('folder1', folder, { [PATH]: '/SuiteScripts/folder1' })
      folderInstance2 = new InstanceElement('folder2', folder, { [PATH]: '/SuiteScripts/folder2' })
      otherInstance = new InstanceElement('instance', otherType, { [PATH]: 'other' })
    })

    describe('when there are no large files count folder warnings', () => {
      beforeEach(() => {
        fetchWarnings = createLargeFilesCountFolderFetchWarnings([folderInstance1, folderInstance2, otherInstance], [])
      })

      it('should not return fetch warnings', () => {
        expect(fetchWarnings).toHaveLength(0)
      })
    })

    describe('when there are large files count folder warnings', () => {
      beforeEach(() => {
        fetchWarnings = createLargeFilesCountFolderFetchWarnings(
          [folderInstance1, folderInstance2, otherInstance],
          [
            { folderPath: '/SuiteScripts/folder1', limit: 1000, current: 1100 },
            { folderPath: '/SuiteScripts/folder2', limit: 2000, current: 2200 },
          ],
        )
      })

      it('should return fetch warnings', () => {
        expect(fetchWarnings).toEqual([
          {
            elemID: folderInstance1.elemID,
            severity: 'Warning',
            message: ERROR_MESSAGES.OTHER_ISSUES,
            detailedMessage: expect.stringContaining(
              'The File Cabinet folder "/SuiteScripts/folder1" is close to exceed the limit of allowed amount of files in a folder. There are currently 1100 files in the folder and the limit for this folder is 1000 files.',
            ),
          },
          {
            elemID: folderInstance2.elemID,
            severity: 'Warning',
            message: ERROR_MESSAGES.OTHER_ISSUES,
            detailedMessage: expect.stringContaining(
              'The File Cabinet folder "/SuiteScripts/folder2" is close to exceed the limit of allowed amount of files in a folder. There are currently 2200 files in the folder and the limit for this folder is 2000 files.',
            ),
          },
        ])
      })
    })

    describe('when there are large files count folder warnings that do not match any folder instance', () => {
      beforeEach(() => {
        fetchWarnings = createLargeFilesCountFolderFetchWarnings(
          [folderInstance1, folderInstance2, otherInstance],
          [{ folderPath: 'other', limit: 1000, current: 1100 }],
        )
      })

      it('should return fetch warning without elemID', () => {
        expect(fetchWarnings).toEqual([
          {
            severity: 'Warning',
            message: ERROR_MESSAGES.OTHER_ISSUES,
            detailedMessage: expect.stringContaining(
              'The File Cabinet folder "other" is close to exceed the limit of allowed amount of files in a folder. There are currently 1100 files in the folder and the limit for this folder is 1000 files.',
            ),
          },
        ])
      })
    })
  })
})
