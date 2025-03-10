/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, InstanceElement, StaticFile, getChangeData, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { collections } from '@salto-io/lowerdash'
import { NetsuiteQuery } from '../../../src/config/query'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import {
  THROW_ON_MISSING_FEATURE_ERROR,
  isChangeDeployable,
  SUITEBUNDLES_DISABLED_ERROR,
  deployFileCabinetInstances,
  importFileCabinet,
  ImportFileCabinetParams,
} from '../../../src/client/suiteapp_client/suiteapp_file_cabinet'
import {
  ReadFileEncodingError,
  ReadFileError,
  ReadFileInsufficientPermissionError,
} from '../../../src/client/suiteapp_client/errors'
import { customtransactiontypeType } from '../../../src/autogen/types/standard_types/customtransactiontype'
import {
  ExistingFileCabinetInstanceDetails,
  FileCabinetInstanceDetails,
  SuiteQLQueryArgs,
} from '../../../src/client/suiteapp_client/types'
import { getFileCabinetTypes } from '../../../src/types/file_cabinet_types'
import { largeFoldersToExclude } from '../../../src/client/file_cabinet_utils'

const { awu } = collections.asynciterable

jest.mock('../../../src/client/file_cabinet_utils', () => ({
  ...jest.requireActual<{}>('../../../src/client/file_cabinet_utils'),
  largeFoldersToExclude: jest.fn().mockReturnValue([]),
}))
const mockLargeFoldersToExclude = largeFoldersToExclude as jest.Mock

describe('suiteapp_file_cabinet', () => {
  const filesQueryResponse = [
    {
      addtimestamptourl: 'F',
      filesize: '10',
      folder: '3',
      hideinbundle: 'F',
      id: '1',
      isinactive: 'F',
      isonline: 'F',
      name: 'file1',
      description: 'desc1',
    },
    {
      addtimestamptourl: 'T',
      bundleable: 'T',
      filesize: '20',
      folder: '4',
      hideinbundle: 'T',
      id: '2',
      isinactive: 'T',
      isonline: 'T',
      name: 'file2',
      description: 'desc2',
    },
    {
      addtimestamptourl: 'T',
      bundleable: 'T',
      filesize: '20',
      folder: '4',
      hideinbundle: 'T',
      id: '6',
      isinactive: 'T',
      isonline: 'T',
      name: 'file6',
      description: 'desc3',
      islink: 'T',
      url: 'someUrl',
    },
    // file with unknown folder id will be filtered out
    {
      addtimestamptourl: 'F',
      filesize: '10',
      folder: '123',
      hideinbundle: 'F',
      id: '101',
      isinactive: 'F',
      isonline: 'F',
      name: 'file101',
      description: 'desc101',
    },
  ]

  const largeFolders = {
    largeFolder1: '11',
    largeFolder2: '22',
    innerLargeFolder: '111',
  }

  const filesCountQueryResponse = Object.values(_.groupBy(filesQueryResponse, row => row.folder))
    .map(files => ({
      folder: files[0].folder,
      count: String(files.length),
    }))
    .concat(Object.values(largeFolders).map(id => ({ folder: id, count: '1900' })))

  const topLevelFoldersResponse = [
    {
      id: '5',
      isinactive: 'F',
      isprivate: 'T',
      name: 'folder5',
    },
  ]

  const subFoldersQueryResponse = [
    {
      id: '3',
      isinactive: 'F',
      isprivate: 'F',
      name: 'folder3',
      parent: '5',
      bundleable: 'F',
      description: 'desc3',
    },
    {
      id: '4',
      isinactive: 'T',
      isprivate: 'T',
      name: 'folder4',
      parent: '5',
      bundleable: 'T',
      description: 'desc4',
    },
    {
      id: largeFolders.largeFolder1,
      isinactive: 'T',
      isprivate: 'T',
      name: 'largeFolder1',
      parent: '5',
      bundleable: 'T',
      description: '',
    },
    {
      id: largeFolders.innerLargeFolder,
      isinactive: 'T',
      isprivate: 'T',
      name: 'innerLargeFolder',
      parent: largeFolders.largeFolder1,
      bundleable: 'T',
      description: '',
    },
    {
      id: largeFolders.largeFolder2,
      isinactive: 'T',
      isprivate: 'T',
      name: 'largeFolder2',
      parent: '5',
      bundleable: 'T',
      description: '',
    },
    {
      id: '222',
      isinactive: 'T',
      isprivate: 'T',
      name: 'innerNormalFolder',
      parent: largeFolders.largeFolder2,
      bundleable: 'T',
      description: '',
    },
    // folder with unknown parent id will be filtered out
    {
      id: '102',
      isinactive: 'T',
      isprivate: 'T',
      name: 'folder102',
      parent: '123',
      bundleable: 'T',
      description: 'desc102',
    },
    // inner folder with unknown parent id will be filtered out
    {
      id: '1102',
      isinactive: 'T',
      isprivate: 'T',
      name: 'innerFolder102',
      parent: '102',
      bundleable: 'T',
      description: 'descInner102',
    },
  ]

  const expectedResults = [
    {
      path: ['folder5'],
      typeName: 'folder',
      values: {
        bundleable: 'F',
        isinactive: 'F',
        isprivate: 'T',
        description: '',
        internalId: '5',
      },
    },
    {
      path: ['folder5', 'folder3'],
      typeName: 'folder',
      values: {
        bundleable: 'F',
        description: 'desc3',
        isinactive: 'F',
        isprivate: 'F',
        internalId: '3',
      },
    },
    {
      path: ['folder5', 'folder4'],
      typeName: 'folder',
      values: {
        bundleable: 'T',
        description: 'desc4',
        isinactive: 'T',
        isprivate: 'T',
        internalId: '4',
      },
    },
    {
      path: ['folder5', 'largeFolder1'],
      typeName: 'folder',
      values: {
        bundleable: 'T',
        description: '',
        isinactive: 'T',
        isprivate: 'T',
        internalId: largeFolders.largeFolder1,
      },
    },
    {
      path: ['folder5', 'largeFolder1', 'innerLargeFolder'],
      typeName: 'folder',
      values: {
        bundleable: 'T',
        description: '',
        isinactive: 'T',
        isprivate: 'T',
        internalId: largeFolders.innerLargeFolder,
      },
    },
    {
      path: ['folder5', 'folder3', 'file1'],
      typeName: 'file',
      fileContent: Buffer.from('a'.repeat(10)),
      values: {
        availablewithoutlogin: 'F',
        isinactive: 'F',
        description: 'desc1',
        generateurltimestamp: 'F',
        hideinbundle: 'F',
        bundleable: 'F',
        internalId: '1',
      },
    },
    {
      path: ['folder5', 'folder4', 'file2'],
      typeName: 'file',
      fileContent: Buffer.from('b'.repeat(20)),
      values: {
        availablewithoutlogin: 'T',
        isinactive: 'T',
        bundleable: 'T',
        description: 'desc2',
        generateurltimestamp: 'T',
        hideinbundle: 'T',
        internalId: '2',
      },
    },
    {
      path: ['folder5', 'folder4', 'file6'],
      typeName: 'file',
      values: {
        availablewithoutlogin: 'T',
        isinactive: 'T',
        bundleable: 'T',
        description: 'desc3',
        generateurltimestamp: 'T',
        hideinbundle: 'T',
        internalId: '6',
        link: 'someUrl',
      },
    },
  ]

  const getFilesResponse = (
    suiteQlQuery: SuiteQLQueryArgs,
  ): typeof filesQueryResponse | typeof filesCountQueryResponse =>
    suiteQlQuery.groupBy === 'folder' ? filesCountQueryResponse : filesQueryResponse

  const getFoldersResponse = (
    suiteQlQuery: SuiteQLQueryArgs,
  ): typeof topLevelFoldersResponse | typeof subFoldersQueryResponse => {
    if (suiteQlQuery.where?.includes("istoplevel = 'T'")) {
      return topLevelFoldersResponse
    }
    if (suiteQlQuery.where?.includes("istoplevel = 'F'")) {
      return subFoldersQueryResponse
    }
    throw new Error("missing 'istoplevel' criteria")
  }

  const filesContent: Record<string, Buffer> = {
    1: Buffer.from('a'.repeat(10)),
    2: Buffer.from('b'.repeat(20)),
  }

  const mockSuiteAppClient = {
    runSuiteQL: jest.fn(),
    readFiles: jest.fn(),
    readLargeFile: jest.fn(),
    updateFileCabinetInstances: jest.fn(),
    addFileCabinetInstances: jest.fn(),
    deleteFileCabinetInstances: jest.fn(),
  }

  const customtransactiontype = customtransactiontypeType().type
  const { file, folder } = getFileCabinetTypes()

  const suiteAppClient = mockSuiteAppClient as unknown as SuiteAppClient

  let query: MockInterface<NetsuiteQuery>

  beforeEach(() => {
    jest.resetAllMocks()
    query = {
      isFileMatch: jest.fn().mockReturnValue(true),
      areSomeFilesMatch: jest.fn().mockReturnValue(true),
      isParentFolderMatch: jest.fn().mockReturnValue(true),
    } as unknown as MockInterface<NetsuiteQuery>

    mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
      if (suiteQlQuery.from === 'file') {
        return getFilesResponse(suiteQlQuery)
      }

      if (suiteQlQuery.from === 'mediaitemfolder') {
        return getFoldersResponse(suiteQlQuery)
      }
      throw new Error(`Unexpected query: ${suiteQlQuery}`)
    })

    mockSuiteAppClient.readFiles.mockImplementation(async (ids: string[]) => ids.map(id => filesContent[id]))
    mockLargeFoldersToExclude.mockReturnValue([])
  })

  describe('importFileCabinet', () => {
    let importFileCabinetParams: ImportFileCabinetParams

    beforeEach(() => {
      importFileCabinetParams = {
        query,
        maxFileCabinetSizeInGB: 1,
        extensionsToExclude: ['.*\\.csv'],
        maxFilesPerFileCabinetFolder: [{ folderPath: '/folder5/largeFolder1.*', limit: 2000 }],
        wrapFolderIdsWithQuotes: false,
      }
    })

    it('should return all the files', async () => {
      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(elements).toEqual(expectedResults)
    })

    it('should use SOAP if ReadFileEncodingError was thrown', async () => {
      const filesContentWithError: Record<string, Buffer | Error> = {
        ...filesContent,
        2: new ReadFileEncodingError(),
      }
      mockSuiteAppClient.readFiles.mockImplementation(async (ids: string[]) => ids.map(id => filesContentWithError[id]))
      mockSuiteAppClient.readLargeFile.mockResolvedValue(filesContent[2])

      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(elements).toEqual(expectedResults)
      expect(mockSuiteAppClient.readLargeFile).toHaveBeenCalledWith(2)
      expect(mockSuiteAppClient.readLargeFile).toHaveBeenCalledTimes(1)
    })

    it('should use SOAP for big files', async () => {
      const filesQueryResponseWithBigFile = [
        ...filesQueryResponse,
        {
          addtimestamptourl: 'T',
          bundleable: 'F',
          filesize: (10 * 1024 * 1024).toString(),
          folder: '4',
          hideinbundle: 'T',
          id: '7',
          isinactive: 'F',
          isonline: 'T',
          name: 'file7',
        },
      ]

      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.from === 'file') {
          return suiteQlQuery.groupBy === 'folder' ? filesCountQueryResponse : filesQueryResponseWithBigFile
        }

        if (suiteQlQuery.from === 'mediaitemfolder') {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      mockSuiteAppClient.readLargeFile.mockResolvedValue(Buffer.from('someContent'))

      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(elements).toEqual([
        ...expectedResults.filter(res => !('link' in res.values)),
        {
          path: ['folder5', 'folder4', 'file7'],
          typeName: 'file',
          fileContent: Buffer.from('someContent'),
          values: {
            availablewithoutlogin: 'T',
            isinactive: 'F',
            bundleable: 'F',
            description: '',
            generateurltimestamp: 'T',
            hideinbundle: 'T',
            internalId: '7',
          },
        },
        ...expectedResults.filter(res => 'link' in res.values),
      ])
      expect(mockSuiteAppClient.readLargeFile).toHaveBeenCalledWith(7)
      expect(mockSuiteAppClient.readLargeFile).toHaveBeenCalledTimes(1)
    })

    it('should return failed paths', async () => {
      const filesContentWithError: Record<string, Buffer | Error> = {
        1: new ReadFileEncodingError(),
        2: new ReadFileInsufficientPermissionError(),
      }
      mockSuiteAppClient.readFiles.mockImplementation(async (ids: string[]) => ids.map(id => filesContentWithError[id]))
      mockSuiteAppClient.readLargeFile.mockResolvedValue(new ReadFileError())

      const { failedPaths } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(failedPaths).toEqual({
        lockedError: ['/folder5/folder4/file2'],
        otherError: ['/folder5/folder3/file1'],
        largeSizeFoldersError: [],
        largeFilesCountFoldersError: ['/folder5/largeFolder2/'],
      })
    })

    it('should filter files with query', async () => {
      query.isFileMatch.mockImplementation(path => path !== '/folder5/folder3/file1')
      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(elements).toEqual([
        expectedResults[0],
        expectedResults[1],
        expectedResults[2],
        expectedResults[3],
        expectedResults[4],
        expectedResults[6],
        expectedResults[7],
      ])
    })

    it('should call suiteql with missing feature error param', async () => {
      await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(mockSuiteAppClient.runSuiteQL).toHaveBeenCalledWith(
        expect.objectContaining({ select: expect.stringContaining('id, name, bundleable') }),
        THROW_ON_MISSING_FEATURE_ERROR,
      )
    })

    it("return empty result when no top level folder matches the adapter's query", async () => {
      query.isParentFolderMatch.mockReturnValue(false)
      expect(await importFileCabinet(suiteAppClient, importFileCabinetParams)).toEqual({
        elements: [],
        failedPaths: { lockedError: [], largeSizeFoldersError: [], largeFilesCountFoldersError: [], otherError: [] },
        largeFilesCountFolderWarnings: [],
      })
      expect(mockSuiteAppClient.runSuiteQL).toHaveBeenCalledTimes(1)
    })

    it('should not run queries of no files are matched', async () => {
      query.areSomeFilesMatch.mockReturnValue(false)
      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(elements).toEqual([])
      expect(suiteAppClient.runSuiteQL).not.toHaveBeenCalled()
    })

    it('throw an error when files query fails', async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.from === 'file') {
          return undefined
        }

        if (suiteQlQuery.from === 'mediaitemfolder') {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      await expect(importFileCabinet(suiteAppClient, importFileCabinetParams)).rejects.toThrow('Failed to list files')
    })

    it('throw an error when files query returns invalid results', async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.from === 'file') {
          return [{ invalid: 1 }]
        }

        if (suiteQlQuery.from === 'mediaitemfolder') {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      await expect(importFileCabinet(suiteAppClient, importFileCabinetParams)).rejects.toThrow('Failed to list files')
    })

    it('throw an error when readFiles failed', async () => {
      mockSuiteAppClient.readFiles.mockResolvedValue(undefined)
      await expect(importFileCabinet(suiteAppClient, importFileCabinetParams)).rejects.toThrow()
    })

    it('throw an error when folders query fails', async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.from === 'file') {
          return filesQueryResponse
        }

        if (suiteQlQuery.from === 'mediaitemfolder') {
          return undefined
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      await expect(importFileCabinet(suiteAppClient, importFileCabinetParams)).rejects.toThrow('Failed to list folders')
    })

    it('throw an error when folders query returns invalid results', async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.from === 'file') {
          return filesQueryResponse
        }

        if (suiteQlQuery.from === 'mediaitemfolder') {
          return [{ invalid: 1 }]
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      await expect(importFileCabinet(suiteAppClient, importFileCabinetParams)).rejects.toThrow('Failed to list folders')
    })

    it('should remove excluded folder before creating the file cabinet query', async () => {
      query.isFileMatch.mockImplementation(path => !path.includes('folder4'))
      query.isParentFolderMatch.mockImplementation(path => !path.includes('folder4'))
      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(3, {
        select: 'folder, count(*) as count',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3, 11, 111, 22, 222)",
        orderBy: 'folder',
        groupBy: 'folder',
      })
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(4, {
        select:
          'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url, bundleable, hideinbundle',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3, 11, 111)",
        orderBy: 'id',
      })
      expect(elements).toEqual([
        expectedResults[0],
        expectedResults[1],
        expectedResults[3],
        expectedResults[4],
        expectedResults[5],
      ])
    })

    it('should use custom files query chunk size when numOfFolderIdsPerFilesQuery is given', async () => {
      const { elements } = await importFileCabinet(suiteAppClient, {
        ...importFileCabinetParams,
        numOfFolderIdsPerFilesQuery: 4,
      })
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(3, {
        select: 'folder, count(*) as count',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3, 4, 11)",
        orderBy: 'folder',
        groupBy: 'folder',
      })
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(4, {
        select: 'folder, count(*) as count',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (111, 22, 222)",
        orderBy: 'folder',
        groupBy: 'folder',
      })
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(5, {
        select:
          'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url, bundleable, hideinbundle',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3, 4, 11)",
        orderBy: 'id',
      })
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(6, {
        select:
          'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url, bundleable, hideinbundle',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (111)",
        orderBy: 'id',
      })
      expect(_.uniqBy(elements, row => row.values.internalId)).toEqual(expectedResults)
    })

    it('should filter out paths under excluded large folders', async () => {
      const excludedLargeFolder = '/folder5/folder3/'
      const excludedLargeFilesCountFolder = '/folder5/largeFolder2/'
      mockLargeFoldersToExclude.mockReturnValue([excludedLargeFolder])
      const { elements, failedPaths } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(mockLargeFoldersToExclude).toHaveBeenCalledWith(
        [
          {
            path: '/folder5/folder3/file1',
            size: 10,
          },
          {
            path: '/folder5/folder4/file2',
            size: 20,
          },
        ],
        importFileCabinetParams.maxFileCabinetSizeInGB,
      )
      expect(elements).toEqual([
        expectedResults[0],
        expectedResults[2],
        expectedResults[3],
        expectedResults[4],
        expectedResults[6],
        expectedResults[7],
      ])
      expect(failedPaths).toEqual({
        lockedError: [],
        largeSizeFoldersError: [excludedLargeFolder],
        largeFilesCountFoldersError: [excludedLargeFilesCountFolder],
        otherError: [],
      })
    })

    it('should return file that was matched by query (works only if query matches also direct parent folder of the file)', async () => {
      query.isFileMatch.mockImplementation(path => path === '/folder5/folder3/file1' || path === '/folder5/folder3/')
      query.isParentFolderMatch.mockImplementation(path => path === '/folder5')
      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(elements).toEqual([expectedResults[1], expectedResults[5]])
    })

    it('should only query folder if a file in that folder is matched by the query', async () => {
      query.isFileMatch.mockImplementation(path => !path.includes('folder4'))
      query.isParentFolderMatch.mockImplementationOnce(() => true)
      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(3, {
        select: 'folder, count(*) as count',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3, 11, 111, 22, 222)",
        orderBy: 'folder',
        groupBy: 'folder',
      })
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(4, {
        select:
          'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url, bundleable, hideinbundle',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3, 11, 111)",
        orderBy: 'id',
      })
      expect(elements).toEqual([
        expectedResults[0],
        expectedResults[1],
        expectedResults[3],
        expectedResults[4],
        expectedResults[5],
      ])
    })

    it('should query all folders if the fetch target is .*ts', async () => {
      const allTSFilesRegex = ['.', ',*', '.*t', '.*ts'].map(matcher => new RegExp(`^${matcher}$`))
      query.isParentFolderMatch
        .mockImplementationOnce(() => true)
        .mockImplementation(path => allTSFilesRegex.some(fileMatcher => fileMatcher.test(path)))
      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(3, {
        select: 'folder, count(*) as count',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3, 4, 11, 111, 22, 222)",
        orderBy: 'folder',
        groupBy: 'folder',
      })
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(4, {
        select:
          'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url, bundleable, hideinbundle',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3, 4, 11, 111)",
        orderBy: 'id',
      })
      expect(elements).toEqual(expectedResults)
    })

    it('should not query folder if no file in that folder is matched by the query', async () => {
      query.isParentFolderMatch.mockImplementationOnce(() => true).mockImplementation(() => false)
      query.isFileMatch.mockImplementation(path => path === '/folder6/file21')
      await importFileCabinet(suiteAppClient, importFileCabinetParams)
      // no folder should match, queryFiles shouldn't be called
      expect(suiteAppClient.runSuiteQL).toHaveBeenCalledTimes(2)
    })

    it("should remove 'bundleable' from query and try again if SuiteBundles ins't enabled", async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.select.includes('bundleable') || suiteQlQuery.select.includes('hideinbundle')) {
          throw new Error(SUITEBUNDLES_DISABLED_ERROR)
        }
        if (suiteQlQuery.from === 'file') {
          return getFilesResponse(suiteQlQuery)
        }
        return getFoldersResponse(suiteQlQuery)
      })
      const { elements } = await importFileCabinet(suiteAppClient, importFileCabinetParams)
      expect(elements).toEqual(expectedResults)
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(
        1,
        {
          select: 'id, name, bundleable, isinactive, isprivate, description, parent',
          from: 'mediaitemfolder',
          where: "istoplevel = 'T'",
          orderBy: 'id',
        },
        THROW_ON_MISSING_FEATURE_ERROR,
      )
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(
        2,
        {
          select: 'id, name, isinactive, isprivate, description, parent',
          from: 'mediaitemfolder',
          where: "istoplevel = 'T'",
          orderBy: 'id',
        },
        THROW_ON_MISSING_FEATURE_ERROR,
      )
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(
        3,
        {
          select: 'id, name, isinactive, isprivate, description, parent',
          from: 'mediaitemfolder',
          where: "istoplevel = 'F' AND (appfolder LIKE 'folder5%')",
          orderBy: 'id',
        },
        THROW_ON_MISSING_FEATURE_ERROR,
      )
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(4, {
        select: 'folder, count(*) as count',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND folder IN (5, 3, 4, 11, 111, 22, 222)",
        orderBy: 'folder',
        groupBy: 'folder',
      })
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(5, {
        select: 'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND folder IN (5, 3, 4, 11, 111)",
        orderBy: 'id',
      })
    })

    it('should return large files count folders errors & warnings', async () => {
      const { elements, failedPaths, largeFilesCountFolderWarnings } = await importFileCabinet(
        suiteAppClient,
        importFileCabinetParams,
      )
      expect(elements).toEqual(expectedResults)
      expect(failedPaths).toEqual({
        lockedError: [],
        otherError: [],
        largeSizeFoldersError: [],
        largeFilesCountFoldersError: ['/folder5/largeFolder2/'],
      })
      expect(largeFilesCountFolderWarnings).toEqual([
        {
          folderPath: '/folder5/largeFolder1',
          limit: 2000,
          current: 1900,
        },
        {
          folderPath: '/folder5/largeFolder1/innerLargeFolder',
          limit: 2000,
          current: 1900,
        },
      ])
    })

    it('should not filter large folders when files count query fails', async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.from === 'file') {
          if (suiteQlQuery.groupBy === 'folder') {
            return undefined
          }
          return filesQueryResponse
        }

        if (suiteQlQuery.from === 'mediaitemfolder') {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      const { elements, failedPaths, largeFilesCountFolderWarnings } = await importFileCabinet(
        suiteAppClient,
        importFileCabinetParams,
      )
      const [folders, files] = _.partition(expectedResults, row => row.typeName === 'folder')
      const largeFoldersResults = [
        {
          path: ['folder5', 'largeFolder2'],
          typeName: 'folder',
          values: {
            bundleable: 'T',
            isinactive: 'T',
            isprivate: 'T',
            description: '',
            internalId: largeFolders.largeFolder2,
          },
        },
        {
          path: ['folder5', 'largeFolder2', 'innerNormalFolder'],
          typeName: 'folder',
          values: {
            bundleable: 'T',
            isinactive: 'T',
            isprivate: 'T',
            description: '',
            internalId: '222',
          },
        },
      ]
      expect(elements).toEqual(folders.concat(largeFoldersResults).concat(files))
      expect(failedPaths).toEqual({
        lockedError: [],
        otherError: [],
        largeSizeFoldersError: [],
        largeFilesCountFoldersError: [],
      })
      expect(largeFilesCountFolderWarnings).toEqual([])
    })
  })

  describe('isChangeDeployable', () => {
    it('not deployable should return false', async () => {
      const undeployableInstances = [
        new InstanceElement('invalid1', file, {
          path: '/Templates/invalid1',
          content: new StaticFile({ filepath: 'somePath', content: Buffer.from('a'.repeat(11 * 1024 * 1024)) }),
        }),
        new InstanceElement('invalid2', file, {
          path: '/Templates/invalid2',
          generateurltimestamp: true,
          content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
        }),
        new InstanceElement('invalid3', customtransactiontype, {}),
        customtransactiontype,
        new InstanceElement('invalid4', file, {
          path: '/Templates/invalid1',
          content: 'a'.repeat(11 * 1024 * 1024),
        }),
      ]

      expect(
        await awu(undeployableInstances)
          .map(instance => toChange({ after: instance }))
          .some(isChangeDeployable),
      ).toBeFalsy()
    })

    it('deployable should return true', async () => {
      const deployableInstance = new InstanceElement('valid1', file, {
        path: '/Templates/valid1',
        content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
      })

      expect(await isChangeDeployable(toChange({ after: deployableInstance }))).toBeTruthy()
      expect(await isChangeDeployable(toChange({ before: deployableInstance }))).toBeTruthy()
    })

    it('should throw an error for invalid content', async () => {
      const instance = new InstanceElement('instance', file, {
        path: '/Templates/valid1',
        content: {},
      })

      await expect(isChangeDeployable(toChange({ after: instance }))).rejects.toThrow('Got invalid content value: {}')
    })
  })

  describe('deploy', () => {
    beforeEach(() => {
      mockSuiteAppClient.updateFileCabinetInstances.mockImplementation(async fileCabinetInstances =>
        fileCabinetInstances.map(({ id }: { id: number }) => ({ isSuccess: true, internalId: String(id) })),
      )
      mockSuiteAppClient.addFileCabinetInstances.mockImplementation(async fileCabinetInstances =>
        fileCabinetInstances.map(() => ({ isSuccess: true, internalId: String(_.random(101, 200)) })),
      )
      mockSuiteAppClient.deleteFileCabinetInstances.mockImplementation(async fileCabinetInstances =>
        fileCabinetInstances.map(({ id }: { id: number }) => ({ isSuccess: true, internalId: String(id) })),
      )
    })

    describe('modifications', () => {
      let changes: Change<InstanceElement>[]
      beforeEach(() => {
        changes = Array.from(Array(100).keys()).map(id =>
          toChange({
            before: new InstanceElement(`instance${id}`, folder, {
              path: `/instance${id}`,
              internalId: id.toString(),
            }),
            after: new InstanceElement(`instance${id}`, folder, {
              path: `/instance${id}`,
              description: 'aaa',
              internalId: id.toString(),
            }),
          }),
        )
      })
      it('should return only error if api calls fails', async () => {
        mockSuiteAppClient.updateFileCabinetInstances.mockRejectedValue(new Error('someError'))
        const { appliedChanges, errors } = await deployFileCabinetInstances(
          suiteAppClient,
          [changes[0]],
          'Salto SuiteApp - File Cabinet - Updating Files',
        )
        expect(errors).toEqual([
          {
            elemID: getChangeData(changes[0]).elemID,
            message: 'someError',
            detailedMessage: 'someError',
            severity: 'Error',
          },
        ])
        expect(appliedChanges).toHaveLength(0)
      })

      it('should return applied changes for successful updates and errors for others', async () => {
        mockSuiteAppClient.updateFileCabinetInstances.mockResolvedValue([
          { isSuccess: true, internalId: '0' },
          { isSuccess: false, errorMessage: 'someError' },
        ])
        const { appliedChanges, errors } = await deployFileCabinetInstances(
          suiteAppClient,
          changes.slice(0, 2),
          'Salto SuiteApp - File Cabinet - Updating Files',
        )
        expect(errors).toEqual([
          {
            elemID: getChangeData(changes[1]).elemID,
            message: 'someError',
            detailedMessage: 'someError',
            severity: 'Error',
          },
        ])
        expect(appliedChanges).toHaveLength(1)
      })

      it('should deploy in chunks', async () => {
        const { appliedChanges, errors } = await deployFileCabinetInstances(
          suiteAppClient,
          changes,
          'Salto SuiteApp - File Cabinet - Updating Files',
        )
        expect(errors).toHaveLength(0)
        expect(appliedChanges).toEqual(changes)
        expect(
          mockSuiteAppClient.updateFileCabinetInstances.mock.calls[0][0].map(
            (details: ExistingFileCabinetInstanceDetails) => details.id,
          ),
        ).toEqual(Array.from(Array(50).keys()))
        expect(
          mockSuiteAppClient.updateFileCabinetInstances.mock.calls[1][0].map(
            (details: ExistingFileCabinetInstanceDetails) => details.id,
          ),
        ).toEqual(Array.from(Array(100).keys()).slice(50))
      })
    })

    describe('additions', () => {
      it('should split by depths', async () => {
        const changes = [
          toChange({
            after: new InstanceElement('newInstance1', file, {
              path: '/instance1/newInstance1',
              content: 'aaa',
              bundleable: true,
              isinactive: false,
              isonline: false,
              hideinbundle: false,
            }),
          }),
          toChange({
            after: new InstanceElement('newInstance3', file, {
              path: '/instance1/newInstance2/newInstance3',
              description: 'aaa',
              content: 'aaa',
            }),
          }),
          toChange({
            after: new InstanceElement('newInstance2', folder, {
              path: '/instance1/newInstance2',
              bundleable: true,
              isinactive: false,
              isonline: false,
              hideinbundle: false,
            }),
          }),
        ]

        const { appliedChanges, errors } = await deployFileCabinetInstances(
          suiteAppClient,
          changes,
          'Salto SuiteApp - File Cabinet - Creating Files',
        )
        expect(errors).toHaveLength(0)
        expect(appliedChanges).toHaveLength(3)

        expect(
          mockSuiteAppClient.addFileCabinetInstances.mock.calls[0][0].map(
            (details: FileCabinetInstanceDetails) => details.path,
          ),
        ).toEqual(['/instance1/newInstance1', '/instance1/newInstance2'])

        expect(
          mockSuiteAppClient.addFileCabinetInstances.mock.calls[1][0].map(
            (details: FileCabinetInstanceDetails) => details.path,
          ),
        ).toEqual(['/instance1/newInstance2/newInstance3'])
      })
      it('should add parent folder internal id to children', async () => {
        const changes = [
          toChange({
            after: new InstanceElement('newInstance2', folder, {
              path: '/instance1/newInstance2',
              bundleable: true,
              isinactive: false,
              isonline: false,
              hideinbundle: false,
            }),
          }),
          toChange({
            after: new InstanceElement('newInstance3', file, {
              path: '/instance1/newInstance2/newInstance3',
              description: 'aaa',
              content: 'aaa',
            }),
          }),
        ]

        const { appliedChanges, errors, elemIdToInternalId } = await deployFileCabinetInstances(
          suiteAppClient,
          changes,
          'Salto SuiteApp - File Cabinet - Creating Files',
        )
        expect(errors).toHaveLength(0)
        expect(appliedChanges).toHaveLength(2)
        expect(Object.keys(elemIdToInternalId)).toEqual([
          'netsuite.folder.instance.newInstance2',
          'netsuite.file.instance.newInstance3',
        ])
        expect(mockSuiteAppClient.addFileCabinetInstances).toHaveBeenNthCalledWith(2, [
          expect.objectContaining({
            folder: elemIdToInternalId['netsuite.folder.instance.newInstance2'],
          }),
        ])
      })
      it('should skip children if parent folder deploy fails', async () => {
        const changes = [
          toChange({
            after: new InstanceElement('newInstance2', folder, {
              path: '/instance1/newInstance2',
              bundleable: true,
              isinactive: false,
              isonline: false,
              hideinbundle: false,
            }),
          }),
          toChange({
            after: new InstanceElement('newInstance3', file, {
              path: '/instance1/newInstance2/newInstance3',
              description: 'aaa',
              content: 'aaa',
            }),
          }),
        ]
        mockSuiteAppClient.addFileCabinetInstances.mockImplementation(async fileCabinetInstances =>
          fileCabinetInstances.map(() => ({ isSuccess: false, errorMessage: 'some error' })),
        )
        const { appliedChanges, errors } = await deployFileCabinetInstances(
          suiteAppClient,
          changes,
          'Salto SuiteApp - File Cabinet - Creating Files',
        )
        expect(appliedChanges).toHaveLength(0)
        expect(mockSuiteAppClient.addFileCabinetInstances).toHaveBeenCalledTimes(1)
        expect(errors).toHaveLength(2)
        expect(errors).toEqual([
          {
            elemID: getChangeData(changes[0]).elemID,
            message: 'some error',
            detailedMessage: 'some error',
            severity: 'Error',
          },
          {
            elemID: getChangeData(changes[1]).elemID,
            message: 'Cannot deploy this file because its parent folder deploy failed',
            detailedMessage: 'Cannot deploy this file because its parent folder deploy failed',
            severity: 'Error',
          },
        ])
      })
    })

    describe('deletions', () => {
      it('should split by depths', async () => {
        const changes = [
          toChange({
            before: new InstanceElement('deletedInstance1', file, {
              path: '/instance1/instance101',
              content: 'aaa',
              bundleable: true,
              isinactive: false,
              isonline: false,
              hideinbundle: false,
              internalId: '101',
            }),
          }),
          toChange({
            before: new InstanceElement('deletedInstance2', file, {
              path: '/instance1',
              content: 'aaa',
              bundleable: true,
              isinactive: false,
              isonline: false,
              hideinbundle: false,
              internalId: '1',
            }),
          }),
          toChange({
            before: new InstanceElement('deletedInstance3', file, {
              path: '/instance0',
              content: 'aaa',
              bundleable: true,
              isinactive: false,
              isonline: false,
              hideinBundle: false,
              internalId: '0',
            }),
          }),
        ]

        const { appliedChanges, errors } = await deployFileCabinetInstances(
          suiteAppClient,
          changes,
          'Salto SuiteApp - File Cabinet - Deleting Files',
        )
        expect(errors).toHaveLength(0)
        expect(appliedChanges).toHaveLength(3)

        expect(
          mockSuiteAppClient.deleteFileCabinetInstances.mock.calls[0][0].map(
            (details: FileCabinetInstanceDetails) => details.path,
          ),
        ).toEqual(['/instance1/instance101'])

        expect(
          mockSuiteAppClient.deleteFileCabinetInstances.mock.calls[1][0].map(
            (details: { path: string }) => details.path,
          ),
        ).toEqual(['/instance1', '/instance0'])
      })
    })
  })
})
