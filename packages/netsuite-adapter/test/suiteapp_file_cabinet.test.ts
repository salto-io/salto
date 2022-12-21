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
import { Change, InstanceElement, StaticFile, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { MockInterface } from '@salto-io/test-utils'
import { collections } from '@salto-io/lowerdash'
import { NetsuiteQuery } from '../src/query'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import { createSuiteAppFileCabinetOperations, isChangeDeployable } from '../src/suiteapp_file_cabinet'
import { ReadFileEncodingError, ReadFileError, ReadFileInsufficientPermissionError } from '../src/client/suiteapp_client/errors'
import { customtransactiontypeType } from '../src/autogen/types/standard_types/customtransactiontype'
import { ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails } from '../src/client/suiteapp_client/types'
import { getFileCabinetTypes } from '../src/types/file_cabinet_types'
import { ElementsSourceIndexes, LazyElementsSourceIndexes } from '../src/elements_source_index/types'

const { awu } = collections.asynciterable

describe('suiteapp_file_cabinet', () => {
  const filesQueryResponse = [{
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
  }]

  const topLevelFoldersResponse = [{
    id: '5',
    isinactive: 'F',
    isprivate: 'T',
    name: 'folder5',
  }]

  const subFoldersQueryResponse = [{
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
  }]

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

  const getFoldersResponse = (suiteQlQuery: string):
  (typeof topLevelFoldersResponse | typeof subFoldersQueryResponse) => {
    if (suiteQlQuery.includes('istoplevel = \'T\'')) {
      return topLevelFoldersResponse
    }
    if (suiteQlQuery.includes('istoplevel = \'F\'')) {
      return subFoldersQueryResponse
    }
    throw new Error('missing \'istoplevel\' criteria')
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
      if (suiteQlQuery.includes('FROM file')) {
        return filesQueryResponse
      }

      if (suiteQlQuery.includes('FROM mediaitemfolder')) {
        return getFoldersResponse(suiteQlQuery)
      }
      throw new Error(`Unexpected query: ${suiteQlQuery}`)
    })

    mockSuiteAppClient.readFiles.mockImplementation(
      async (ids: string[]) => ids.map(id => filesContent[id])
    )
  })

  describe('importFileCabinet', () => {
    it('should return all the files', async () => {
      const suiteAppFileCabinet = createSuiteAppFileCabinetOperations(suiteAppClient)
      const { elements } = await suiteAppFileCabinet.importFileCabinet(query)
      expect(elements).toEqual(expectedResults)
      expect(suiteAppFileCabinet.getPathToIdMap()).toEqual({
        '/folder5': 5,
        '/folder5/folder3': 3,
        '/folder5/folder3/file1': 1,
        '/folder5/folder4': 4,
        '/folder5/folder4/file2': 2,
        '/folder5/folder4/file6': 6,
      })
    })

    it('should use SOAP if ReadFileEncodingError was thrown', async () => {
      const filesContentWithError: Record<string, Buffer | Error> = {
        ...filesContent,
        2: new ReadFileEncodingError(),
      }
      mockSuiteAppClient.readFiles.mockImplementation(
        async (ids: string[]) => ids.map(id => filesContentWithError[id])
      )
      mockSuiteAppClient.readLargeFile.mockResolvedValue(filesContent[2])

      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)
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
        if (suiteQlQuery.includes('FROM file')) {
          return filesQueryResponseWithBigFile
        }

        if (suiteQlQuery.includes('FROM mediaitemfolder')) {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      mockSuiteAppClient.readLargeFile.mockResolvedValue(Buffer.from('someContent'))

      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)
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
      mockSuiteAppClient.readFiles.mockImplementation(
        async (ids: string[]) => ids.map(id => filesContentWithError[id])
      )
      mockSuiteAppClient.readLargeFile.mockResolvedValue(new ReadFileError())

      const { failedPaths } = await createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)
      expect(failedPaths).toEqual({
        lockedError: [
          '/folder5/folder4/file2',
        ],
        otherError: [
          '/folder5/folder3/file1',
        ],
      })
    })

    it('should filter files with query', async () => {
      query.isFileMatch.mockImplementation(path => path !== '/folder5/folder4' && path !== '/folder5/folder3/file1')
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)
      expect(elements).toEqual([
        expectedResults[0],
        expectedResults[1],
        expectedResults[4],
        expectedResults[5],
      ])
    })

    it('return empty result when no top level folder matches the adapter\'s query', async () => {
      query.isParentFolderMatch.mockReturnValue(false)
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.includes('FROM file')) {
          return filesQueryResponse
        }

        if (suiteQlQuery.includes('FROM mediaitemfolder')) {
          return getFoldersResponse(suiteQlQuery)
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

      const suiteAppFileCabinet = createSuiteAppFileCabinetOperations(suiteAppClient)
      expect(await suiteAppFileCabinet.importFileCabinet(query))
        .toEqual({ elements: [], failedPaths: { lockedError: [], otherError: [] } })
      expect(mockSuiteAppClient.runSuiteQL).toHaveBeenCalledTimes(1)
    })

    it('should not run queries of no files are matched', async () => {
      query.areSomeFilesMatch.mockReturnValue(false)
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)
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

      await expect(createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)).rejects.toThrow()
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

      await expect(createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)).rejects.toThrow()
    })

    it('throw an error when readFiles failed', async () => {
      mockSuiteAppClient.readFiles.mockResolvedValue(undefined)
      await expect(createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)).rejects.toThrow()
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

      await expect(createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)).rejects.toThrow()
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

      await expect(createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)).rejects.toThrow()
    })
  })

  describe('isChangeDeployable', () => {
    it('not deployable should return false', async () => {
      const undeployableInstances = [
        new InstanceElement(
          'invalid1',
          file,
          {
            path: '/Templates/invalid1',
            content: new StaticFile({ filepath: 'somePath', content: Buffer.from('a'.repeat(11 * 1024 * 1024)) }),
          }
        ),
        new InstanceElement(
          'invalid2',
          file,
          {
            path: '/Templates/invalid2',
            generateurltimestamp: true,
            content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
          }
        ),
        new InstanceElement(
          'invalid3',
          customtransactiontype,
          {}
        ),
        customtransactiontype,
        new InstanceElement(
          'invalid4',
          file,
          {
            path: '/Templates/invalid1',
            content: 'a'.repeat(11 * 1024 * 1024),
          }
        ),
      ]

      expect(
        await awu(undeployableInstances)
          .map(instance => toChange({ after: instance }))
          .some(isChangeDeployable)
      ).toBeFalsy()
    })

    it('deployable should return true', async () => {
      const deployableInstance = new InstanceElement(
        'valid1',
        file,
        {
          path: '/Templates/valid1',
          content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
        }
      )

      expect(await isChangeDeployable(toChange({ after: deployableInstance }))).toBeTruthy()
      expect(await isChangeDeployable(toChange({ before: deployableInstance }))).toBeTruthy()
    })

    it('should throw an error for invalid content', async () => {
      const instance = new InstanceElement(
        'instance',
        file,
        {
          path: '/Templates/valid1',
          content: {},
        }
      )

      await expect(isChangeDeployable(toChange({ after: instance }))).rejects.toThrow('Got invalid content value: {}')
    })
  })

  describe('deploy', () => {
    beforeEach(() => {
      mockSuiteAppClient.updateFileCabinetInstances.mockImplementation(
        async fileCabinetInstances => fileCabinetInstances.map(({ id }: { id: number }) => id)
      )
      mockSuiteAppClient.addFileCabinetInstances.mockImplementation(
        async fileCabinetInstances => fileCabinetInstances
          .map(() => _.random(101, 200))
      )
      mockSuiteAppClient.deleteFileCabinetInstances.mockImplementation(
        async fileCabinetInstances => fileCabinetInstances.map(({ id }: { id: number }) => id)
      )
    })

    describe('modifications', () => {
      const elementsSourceIndexes: LazyElementsSourceIndexes = {
        getIndexes: () => {
          throw new Error('getIndexes should not be called!')
        },
      }

      let changes: Change<InstanceElement>[]
      beforeEach(() => {
        changes = Array.from(Array(100).keys()).map(id => toChange({
          before: new InstanceElement(
            `instance${id}`,
            folder,
            {
              path: `/instance${id}`,
              internalId: id.toString(),
            }
          ),
          after: new InstanceElement(
            `instance${id}`,
            folder,
            {
              path: `/instance${id}`,
              description: 'aaa',
              internalId: id.toString(),
            }
          ),
        }))
      })
      it('should return only error if api calls fails', async () => {
        mockSuiteAppClient.updateFileCabinetInstances.mockRejectedValue(new Error('someError'))
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy([changes[0]], 'update', elementsSourceIndexes)
        expect(errors).toEqual([new Error('someError')])
        expect(appliedChanges).toHaveLength(0)
      })

      it('should return applied changes for successful updates and errors for others', async () => {
        mockSuiteAppClient.updateFileCabinetInstances.mockResolvedValue([0, new Error('someError')])
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy(changes.slice(0, 2), 'update', elementsSourceIndexes)
        expect(errors).toEqual([new Error('someError')])
        expect(appliedChanges).toHaveLength(1)
      })

      it('should return an error if the id of the file is not found', async () => {
        const change = toChange({
          before: new InstanceElement(
            'instance10000',
            folder,
            {
              path: '/instance10000',
            }
          ),
          after: new InstanceElement(
            'instance10000',
            folder,
            {
              path: '/instance10000',
              description: 'aaa',
            }
          ),
        })

        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy([change], 'update', elementsSourceIndexes)
        expect(errors).toEqual([new Error('Failed to find the internal id of the file /instance10000')])
        expect(appliedChanges).toHaveLength(0)
        expect(mockSuiteAppClient.updateFileCabinetInstances).not.toHaveBeenCalledWith()
      })

      it('should return both update errors and invalid instance errors', async () => {
        const notExistsChange = toChange({
          before: new InstanceElement(
            'instance10000',
            folder,
            {
              path: '/instance10000',
            }
          ),
          after: new InstanceElement(
            'instance10000',
            folder,
            {
              path: '/instance10000',
              description: 'aaa',
            }
          ),
        })

        mockSuiteAppClient.updateFileCabinetInstances.mockRejectedValue(new Error('someError'))
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy([changes[0], notExistsChange], 'update', elementsSourceIndexes)
        expect(errors).toEqual([
          new Error('someError'),
          new Error('Failed to find the internal id of the file /instance10000'),
        ])
        expect(appliedChanges).toHaveLength(0)
        expect(mockSuiteAppClient.updateFileCabinetInstances).not.toHaveBeenCalledWith()
      })

      it('should deploy in chunks', async () => {
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy(changes, 'update', elementsSourceIndexes)
        expect(errors).toHaveLength(0)
        expect(appliedChanges).toEqual(changes)
        expect(mockSuiteAppClient.updateFileCabinetInstances.mock.calls[0][0]
          .map((details: ExistingFileCabinetInstanceDetails) => details.id))
          .toEqual(Array.from(Array(50).keys()))
        expect(mockSuiteAppClient.updateFileCabinetInstances.mock.calls[1][0]
          .map((details: ExistingFileCabinetInstanceDetails) => details.id))
          .toEqual(Array.from(Array(100).keys()).slice(50))
      })
    })

    describe('additions', () => {
      const elementsSourceIndexes = {
        getIndexes: async () => ({
          pathToInternalIdsIndex: {
            ...Object.fromEntries(_.range(100).map(i => [`/instance${i}`, i])),
            '/instance1/instance101': 101,
          },
        } as unknown as ElementsSourceIndexes),
      }

      it('should split by depths', async () => {
        const changes = [
          toChange({
            after: new InstanceElement(
              'newInstance1',
              file,
              {
                path: '/instance1/newInstance1',
                content: 'aaa',
                bundleable: true,
                isinactive: false,
                isonline: false,
                hideinbundle: false,
              }
            ),
          }),
          toChange({
            after: new InstanceElement(
              'newInstance3',
              file,
              {
                path: '/instance1/newInstance2/newInstance3',
                description: 'aaa',
                content: 'aaa',
              }
            ),
          }),
          toChange({
            after: new InstanceElement(
              'newInstance2',
              folder,
              {
                path: '/instance1/newInstance2',
                bundleable: true,
                isinactive: false,
                isonline: false,
                hideinbundle: false,
              }
            ),
          }),
        ]

        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy(changes, 'add', elementsSourceIndexes)
        expect(errors).toHaveLength(0)
        expect(appliedChanges).toHaveLength(3)

        expect(mockSuiteAppClient.addFileCabinetInstances.mock.calls[0][0]
          .map((details: FileCabinetInstanceDetails) => details.path))
          .toEqual(['/instance1/newInstance1', '/instance1/newInstance2'])

        expect(mockSuiteAppClient.addFileCabinetInstances.mock.calls[1][0]
          .map((details: FileCabinetInstanceDetails) => details.path))
          .toEqual(['/instance1/newInstance2/newInstance3'])
      })

      it('should return an error if file parent is not found', async () => {
        const change = toChange({
          before: new InstanceElement(
            'instance1',
            folder,
            {
              path: '/someFolder/instance1',
            }
          ),
          after: new InstanceElement(
            'instance1',
            folder,
            {
              path: '/someFolder/instance1',
              description: 'aaa',
            }
          ),
        })

        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy([change], 'add', elementsSourceIndexes)
        expect(errors).toEqual([new Error('Directory /someFolder was not found when attempting to deploy a file with path /someFolder/instance1')])
        expect(appliedChanges).toHaveLength(0)
      })
    })

    describe('deletions', () => {
      const elementsSourceIndexes: LazyElementsSourceIndexes = {
        getIndexes: () => {
          throw new Error('getIndexes should not be called!')
        },
      }
      it('should split by depths', async () => {
        const changes = [
          toChange({
            before: new InstanceElement(
              'deletedInstance1',
              file,
              {
                path: '/instance1/instance101',
                content: 'aaa',
                bundleable: true,
                isinactive: false,
                isonline: false,
                hideinbundle: false,
                internalId: '101',
              }
            ),
          }),
          toChange({
            before: new InstanceElement(
              'deletedInstance2',
              file,
              {
                path: '/instance1',
                content: 'aaa',
                bundleable: true,
                isinactive: false,
                isonline: false,
                hideinbundle: false,
                internalId: '1',
              }
            ),
          }),
          toChange({
            before: new InstanceElement(
              'deletedInstance3',
              file,
              {
                path: '/instance0',
                content: 'aaa',
                bundleable: true,
                isinactive: false,
                isonline: false,
                hideinBundle: false,
                internalId: '0',
              }
            ),
          }),
        ]

        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy(changes, 'delete', elementsSourceIndexes)
        expect(errors).toHaveLength(0)
        expect(appliedChanges).toHaveLength(3)

        expect(mockSuiteAppClient.deleteFileCabinetInstances.mock.calls[0][0]
          .map((details: FileCabinetInstanceDetails) => details.path))
          .toEqual(['/instance1/instance101'])

        expect(mockSuiteAppClient.deleteFileCabinetInstances.mock.calls[1][0]
          .map((details: { path: string }) => details.path))
          .toEqual(['/instance1', '/instance0'])
      })
    })
  })
})
