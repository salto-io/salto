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
import { Change, InstanceElement, StaticFile, getChangeData, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { collections } from '@salto-io/lowerdash'
import { NetsuiteQuery } from '../../../src/config/query'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import {
  THROW_ON_MISSING_FEATURE_ERROR,
  createSuiteAppFileCabinetOperations,
  isChangeDeployable,
  SUITEBUNDLES_DISABLED_ERROR,
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
        return filesQueryResponse
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
    const maxFileCabinetSizeInGB = 1
    const extensionsToExclude = ['.*\\.csv']
    it('should return all the files', async () => {
      const suiteAppFileCabinet = createSuiteAppFileCabinetOperations(suiteAppClient)
      const { elements } = await suiteAppFileCabinet.importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      expect(elements).toEqual(expectedResults)
    })

    it('should use SOAP if ReadFileEncodingError was thrown', async () => {
      const filesContentWithError: Record<string, Buffer | Error> = {
        ...filesContent,
        2: new ReadFileEncodingError(),
      }
      mockSuiteAppClient.readFiles.mockImplementation(async (ids: string[]) => ids.map(id => filesContentWithError[id]))
      mockSuiteAppClient.readLargeFile.mockResolvedValue(filesContent[2])

      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
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
          return filesQueryResponseWithBigFile
        }

        if (suiteQlQuery.from === 'mediaitemfolder') {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      mockSuiteAppClient.readLargeFile.mockResolvedValue(Buffer.from('someContent'))

      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
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

      const { failedPaths } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      expect(failedPaths).toEqual({
        lockedError: ['/folder5/folder4/file2'],
        otherError: ['/folder5/folder3/file1'],
        largeFolderError: [],
      })
    })

    it('should filter files with query', async () => {
      query.isFileMatch.mockImplementation(path => path !== '/folder5/folder3/file1')
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      expect(elements).toEqual([
        expectedResults[0],
        expectedResults[1],
        expectedResults[2],
        expectedResults[4],
        expectedResults[5],
      ])
    })

    it('should call suiteql with missing feature error param', async () => {
      await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      expect(mockSuiteAppClient.runSuiteQL).toHaveBeenCalledWith(
        expect.objectContaining({ select: expect.stringContaining('id, name, bundleable') }),
        THROW_ON_MISSING_FEATURE_ERROR,
      )
    })

    it("return empty result when no top level folder matches the adapter's query", async () => {
      query.isParentFolderMatch.mockReturnValue(false)
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.from === 'file') {
          return filesQueryResponse
        }

        if (suiteQlQuery.from === 'mediaitemfolder') {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      const suiteAppFileCabinet = createSuiteAppFileCabinetOperations(suiteAppClient)
      expect(await suiteAppFileCabinet.importFileCabinet(query, maxFileCabinetSizeInGB, extensionsToExclude)).toEqual({
        elements: [],
        failedPaths: { lockedError: [], largeFolderError: [], otherError: [] },
      })
      expect(mockSuiteAppClient.runSuiteQL).toHaveBeenCalledTimes(1)
    })

    it('should not run queries of no files are matched', async () => {
      query.areSomeFilesMatch.mockReturnValue(false)
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      expect(elements).toEqual([])
      expect(suiteAppClient.runSuiteQL).not.toHaveBeenCalled()
    })

    it('throw an error when files query fails', async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.includes('FROM file')) {
          return undefined
        }

        if (suiteQlQuery.includes('FROM mediaitemfolder')) {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      await expect(
        createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
          query,
          maxFileCabinetSizeInGB,
          extensionsToExclude,
        ),
      ).rejects.toThrow()
    })

    it('throw an error when files query returns invalid results', async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.includes('FROM file')) {
          return [{ invalid: 1 }]
        }

        if (suiteQlQuery.includes('FROM mediaitemfolder')) {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      await expect(
        createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
          query,
          maxFileCabinetSizeInGB,
          extensionsToExclude,
        ),
      ).rejects.toThrow()
    })

    it('throw an error when readFiles failed', async () => {
      mockSuiteAppClient.readFiles.mockResolvedValue(undefined)
      await expect(
        createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
          query,
          maxFileCabinetSizeInGB,
          extensionsToExclude,
        ),
      ).rejects.toThrow()
    })

    it('throw an error when folders query fails', async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.includes('FROM file')) {
          return filesQueryResponse
        }

        if (suiteQlQuery.includes('FROM mediaitemfolder')) {
          return undefined
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      await expect(
        createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
          query,
          maxFileCabinetSizeInGB,
          extensionsToExclude,
        ),
      ).rejects.toThrow()
    })

    it('throw an error when folders query returns invalid results', async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.includes('FROM file')) {
          return filesQueryResponse
        }

        if (suiteQlQuery.includes('FROM mediaitemfolder')) {
          return [{ invalid: 1 }]
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      await expect(
        createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
          query,
          maxFileCabinetSizeInGB,
          extensionsToExclude,
        ),
      ).rejects.toThrow()
    })

    it('should remove excluded folder before creating the file cabinet query', async () => {
      query.isFileMatch.mockImplementation(path => !path.includes('folder4'))
      query.isParentFolderMatch.mockImplementation(path => !path.includes('folder4'))
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      const suiteQlQuery = {
        select:
          'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url, bundleable, hideinbundle',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3)",
        orderBy: 'id',
      }
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(3, suiteQlQuery)
      expect(elements).toEqual([expectedResults[0], expectedResults[1], expectedResults[3]])
    })

    it('should filter out paths under excluded large folders', async () => {
      const excludedFolder = '/folder5/folder3/'
      mockLargeFoldersToExclude.mockReturnValue([excludedFolder])
      const { elements, failedPaths } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
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
        maxFileCabinetSizeInGB,
      )
      expect(elements).toEqual([expectedResults[0], expectedResults[2], expectedResults[4], expectedResults[5]])
      expect(failedPaths).toEqual({ lockedError: [], largeFolderError: [excludedFolder], otherError: [] })
    })

    it('should return file that was matched by query (works only if query matches also direct parent folder of the file)', async () => {
      query.isFileMatch.mockImplementation(path => path === '/folder5/folder3/file1' || path === '/folder5/folder3/')
      query.isParentFolderMatch.mockImplementation(path => path === '/folder3' || path === '/folder5')
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      expect(elements).toEqual([expectedResults[1], expectedResults[3]])
    })

    it('should only query folder if a file in that folder is matched by the query', async () => {
      query.isFileMatch.mockImplementation(path => path === '/folder5/folder3/file1')
      query.isParentFolderMatch.mockImplementationOnce(() => true).mockImplementation(path => !path.includes('folder4'))
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      const suiteQlQuery = {
        select:
          'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url, bundleable, hideinbundle',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3)",
        orderBy: 'id',
      }
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(3, suiteQlQuery)
      expect(elements).toEqual([expectedResults[0], expectedResults[1], expectedResults[3]])
    })

    it('should query all folders if the fetch target is .*ts', async () => {
      const allTSFilesRegex = ['.', ',*', '.*t', '.*ts'].map(matcher => new RegExp(`^${matcher}$`))
      query.isParentFolderMatch
        .mockImplementationOnce(() => true)
        .mockImplementation(path => allTSFilesRegex.some(fileMatcher => fileMatcher.test(path)))
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      const suiteQlQuery = {
        select:
          'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url, bundleable, hideinbundle',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND hideinbundle = 'F' AND folder IN (5, 3, 4)",
        orderBy: 'id',
      }
      expect(suiteAppClient.runSuiteQL).toHaveBeenNthCalledWith(3, suiteQlQuery)
      expect(elements).toEqual(expectedResults)
    })

    it('should not query folder if no file in that folder is matched by the query', async () => {
      query.isParentFolderMatch.mockImplementationOnce(() => true).mockImplementation(() => false)
      query.isFileMatch.mockImplementation(path => path === '/folder6/file21')
      await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
      // no folder should match, queryFiles shouldn't be called
      expect(suiteAppClient.runSuiteQL).toHaveBeenCalledTimes(2)
    })

    it("should remove 'bundleable' from query and try again if SuiteBundles ins't enabled", async () => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.select.includes('bundleable') || suiteQlQuery.select.includes('hideinbundle')) {
          throw new Error(SUITEBUNDLES_DISABLED_ERROR)
        }
        if (suiteQlQuery.from === 'file') {
          return filesQueryResponse
        }
        return getFoldersResponse(suiteQlQuery)
      })
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient).importFileCabinet(
        query,
        maxFileCabinetSizeInGB,
        extensionsToExclude,
      )
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
        select: 'id, name, filesize, isinactive, isonline, addtimestamptourl, description, folder, islink, url',
        from: 'file',
        where: "NOT REGEXP_LIKE(name, '.*\\.csv') AND folder IN (5, 3, 4)",
        orderBy: 'id',
      })
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
        fileCabinetInstances.map(({ id }: { id: number }) => id),
      )
      mockSuiteAppClient.addFileCabinetInstances.mockImplementation(async fileCabinetInstances =>
        fileCabinetInstances.map(() => _.random(101, 200)),
      )
      mockSuiteAppClient.deleteFileCabinetInstances.mockImplementation(async fileCabinetInstances =>
        fileCabinetInstances.map(({ id }: { id: number }) => id),
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
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient).deploy(
          [changes[0]],
          'update',
        )
        expect(errors).toEqual([
          {
            elemID: getChangeData(changes[0]).elemID,
            message: 'someError',
            severity: 'Error',
          },
        ])
        expect(appliedChanges).toHaveLength(0)
      })

      it('should return applied changes for successful updates and errors for others', async () => {
        mockSuiteAppClient.updateFileCabinetInstances.mockResolvedValue([0, new Error('someError')])
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient).deploy(
          changes.slice(0, 2),
          'update',
        )
        expect(errors).toEqual([
          {
            elemID: getChangeData(changes[1]).elemID,
            message: 'someError',
            severity: 'Error',
          },
        ])
        expect(appliedChanges).toHaveLength(1)
      })

      it('should deploy in chunks', async () => {
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient).deploy(
          changes,
          'update',
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

        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient).deploy(
          changes,
          'add',
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

        const { appliedChanges, errors, elemIdToInternalId } = await createSuiteAppFileCabinetOperations(
          suiteAppClient,
        ).deploy(changes, 'add')
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
          fileCabinetInstances.map(() => new Error('some error')),
        )
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient).deploy(
          changes,
          'add',
        )
        expect(appliedChanges).toHaveLength(0)
        expect(mockSuiteAppClient.addFileCabinetInstances).toHaveBeenCalledTimes(1)
        expect(errors).toHaveLength(2)
        expect(errors).toEqual([
          {
            elemID: getChangeData(changes[0]).elemID,
            message: 'some error',
            severity: 'Error',
          },
          {
            elemID: getChangeData(changes[1]).elemID,
            message: 'Cannot deploy this file because its parent folder deploy failed',
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

        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient).deploy(
          changes,
          'delete',
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
