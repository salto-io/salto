/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { NetsuiteQuery } from '../src/query'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import { createSuiteAppFileCabinetOperations, isChangeDeployable } from '../src/suiteapp_file_cabinet'
import { ReadFileEncodingError, ReadFileError, ReadFileInsufficientPermissionError } from '../src/client/suiteapp_client/errors'
import { fileCabinetTypes } from '../src/types'
import { FILE } from '../src/constants'
import { customtransactiontype } from '../src/autogen/types/custom_types/customtransactiontype'
import { file, folder } from '../src/types/file_cabinet_types'
import { ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails } from '../src/client/suiteapp_client/types'

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
  }]

  const foldersQueryResponse = [{
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
    id: '5',
    isinactive: 'F',
    isprivate: 'T',
    name: 'folder5',
  }]

  const expectedResults = [
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

  const suiteAppClient = mockSuiteAppClient as unknown as SuiteAppClient

  const mockQuery = {
    isFileMatch: jest.fn(),
    areSomeFilesMatch: jest.fn(),
  }

  const query = mockQuery as unknown as NetsuiteQuery

  beforeEach(() => {
    jest.resetAllMocks()
    mockQuery.isFileMatch.mockReturnValue(true)
    mockQuery.areSomeFilesMatch.mockReturnValue(true)

    mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
      if (suiteQlQuery.includes('FROM file')) {
        return filesQueryResponse
      }

      if (suiteQlQuery.includes('FROM mediaitemfolder')) {
        return foldersQueryResponse
      }
      throw new Error(`Unexpected query: ${suiteQlQuery}`)
    })

    mockSuiteAppClient.readFiles.mockImplementation(
      async (ids: string[]) => ids.map(id => filesContent[id])
    )
  })

  describe('importFileCabinet', () => {
    it('should return all the files', async () => {
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)
      expect(elements).toEqual(expectedResults)
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
          return foldersQueryResponse
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
        1: new ReadFileError(),
        2: new ReadFileEncodingError(),
      }
      mockSuiteAppClient.readFiles.mockImplementation(
        async (ids: string[]) => ids.map(id => filesContentWithError[id])
      )
      mockSuiteAppClient.readLargeFile.mockResolvedValue(new ReadFileError())

      const { failedPaths } = await createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)
      expect(failedPaths).toEqual([
        '/folder5/folder3/file1',
        '/folder5/folder4/file2',
      ])
    })

    it('should not return locked files as failed paths', async () => {
      const filesContentWithError: Record<string, Buffer | Error> = {
        1: new ReadFileError(),
        2: new ReadFileInsufficientPermissionError(),
      }
      mockSuiteAppClient.readFiles.mockImplementation(
        async (ids: string[]) => ids.map(id => filesContentWithError[id])
      )
      mockSuiteAppClient.readLargeFile.mockResolvedValue(new ReadFileError())

      const { failedPaths } = await createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)
      expect(failedPaths).toEqual([
        '/folder5/folder3/file1',
      ])
    })

    it('should filter files with query', async () => {
      mockQuery.isFileMatch.mockImplementation(path => path !== '/folder5/folder4' && path !== '/folder5/folder3/file1')
      const { elements } = await createSuiteAppFileCabinetOperations(suiteAppClient)
        .importFileCabinet(query)
      expect(elements).toEqual([
        expectedResults[0],
        expectedResults[2],
        expectedResults[4],
        expectedResults[5],
      ])
    })

    it('should not run queries of no files are matched', async () => {
      mockQuery.areSomeFilesMatch.mockReturnValue(false)
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
          return foldersQueryResponse
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
          return foldersQueryResponse
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
    it('not deployable should return false', () => {
      const undeployableInstances = [
        new InstanceElement(
          'invalid1',
          fileCabinetTypes[FILE],
          {
            path: '/Templates/invalid1',
            content: new StaticFile({ filepath: 'somePath', content: Buffer.from('a'.repeat(11 * 1024 * 1024)) }),
          }
        ),
        new InstanceElement(
          'invalid2',
          fileCabinetTypes[FILE],
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
          fileCabinetTypes[FILE],
          {
            path: '/Templates/invalid1',
            content: 'a'.repeat(11 * 1024 * 1024),
          }
        ),
      ]

      expect(
        undeployableInstances
          .map(instance => toChange({ after: instance }))
          .some(isChangeDeployable)
      ).toBeFalsy()
    })

    it('deployable should return true', () => {
      const deployableInstance = new InstanceElement(
        'valid1',
        fileCabinetTypes[FILE],
        {
          path: '/Templates/valid1',
          content: new StaticFile({ filepath: 'somePath', content: Buffer.from('aaa') }),
        }
      )

      expect(isChangeDeployable(toChange({ after: deployableInstance }))).toBeTruthy()
      expect(isChangeDeployable(toChange({ before: deployableInstance }))).toBeTruthy()
    })

    it('should throw an error for invalid content', () => {
      const instance = new InstanceElement(
        'instance',
        fileCabinetTypes[FILE],
        {
          path: '/Templates/valid1',
          content: {},
        }
      )

      expect(() => isChangeDeployable(toChange({ after: instance }))).toThrow('Got invalid content value: {}')
    })
  })

  describe('deploy', () => {
    let changes: Change<InstanceElement>[]
    beforeEach(() => {
      mockSuiteAppClient.runSuiteQL.mockImplementation(async suiteQlQuery => {
        if (suiteQlQuery.includes('FROM file')) {
          return [{
            id: '101',
            isinactive: 'F',
            isprivate: 'F',
            name: 'instance101',
            bundleable: 'F',
            folder: '1',
            addtimestamptourl: 'F',
            filesize: '3',
            isonline: 'F',
            hideinbundle: 'F',
          }]
        }

        if (suiteQlQuery.includes('FROM mediaitemfolder')) {
          return Array.from(Array(100).keys()).map(id => ({
            id: id.toString(),
            isinactive: 'F',
            isprivate: 'F',
            name: `instance${id}`,
            bundleable: 'F',
          }))
        }
        throw new Error(`Unexpected query: ${suiteQlQuery}`)
      })

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

      changes = Array.from(Array(100).keys()).map(id => toChange({
        before: new InstanceElement(
          `instance${id}`,
          folder,
          {
            path: `/instance${id}`,
          }
        ),
        after: new InstanceElement(
          `instance${id}`,
          folder,
          {
            path: `/instance${id}`,
            description: 'aaa',
          }
        ),
      }))
    })

    describe('modifications', () => {
      it('should return only error if api calls fails', async () => {
        mockSuiteAppClient.updateFileCabinetInstances.mockRejectedValue(new Error('someError'))
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy([changes[0]], 'update')
        expect(errors).toEqual([new Error('someError')])
        expect(appliedChanges).toHaveLength(0)
      })

      it('should return applied changes for successful updates and errors for others', async () => {
        mockSuiteAppClient.updateFileCabinetInstances.mockResolvedValue([0, new Error('someError')])
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy(changes.slice(0, 2), 'update')
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
          .deploy([change], 'update')
        expect(errors).toEqual([new Error('Failed to find the internal id of the file /instance10000')])
        expect(appliedChanges).toHaveLength(0)
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
          .deploy([change], 'update')
        expect(errors).toEqual([new Error('Directory /someFolder was not found when attempting to deploy a file with path /someFolder/instance1')])
        expect(appliedChanges).toHaveLength(0)
      })
      it('should deploy in chunks', async () => {
        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy(changes, 'update')
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
      it('should split by depths', async () => {
        changes = [
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
          .deploy(changes, 'add')
        expect(errors).toHaveLength(0)
        expect(appliedChanges).toHaveLength(3)

        expect(mockSuiteAppClient.addFileCabinetInstances.mock.calls[0][0]
          .map((details: FileCabinetInstanceDetails) => details.path))
          .toEqual(['/instance1/newInstance1', '/instance1/newInstance2'])

        expect(mockSuiteAppClient.addFileCabinetInstances.mock.calls[1][0]
          .map((details: FileCabinetInstanceDetails) => details.path))
          .toEqual(['/instance1/newInstance2/newInstance3'])
      })
    })

    describe('deletions', () => {
      it('should split by depths', async () => {
        changes = [
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
              }
            ),
          }),
        ]

        const { appliedChanges, errors } = await createSuiteAppFileCabinetOperations(suiteAppClient)
          .deploy(changes, 'delete')
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
