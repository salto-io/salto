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
import { NetsuiteQuery } from '../src/query'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import { importFileCabinet } from '../src/suiteapp_file_cabinet'
import { ReadFileEncodingError, ReadFileError } from '../src/client/suiteapp_client/errors'

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

  it('should return all the files', async () => {
    const { elements } = await importFileCabinet(suiteAppClient, query)
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

    const { elements } = await importFileCabinet(suiteAppClient, query)
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
        id: '6',
        isinactive: 'F',
        isonline: 'T',
        name: 'file6',
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

    const { elements } = await importFileCabinet(suiteAppClient, query)
    expect(elements).toEqual([
      ...expectedResults,
      {
        path: ['folder5', 'folder4', 'file6'],
        typeName: 'file',
        fileContent: Buffer.from('someContent'),
        values: {
          availablewithoutlogin: 'T',
          isinactive: 'F',
          bundleable: 'F',
          description: '',
          generateurltimestamp: 'T',
          hideinbundle: 'T',
        },
      },
    ])
    expect(mockSuiteAppClient.readLargeFile).toHaveBeenCalledWith(6)
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

    const { failedPaths } = await importFileCabinet(suiteAppClient, query)
    expect(failedPaths).toEqual([
      '/folder5/folder3/file1',
      '/folder5/folder4/file2',
    ])
  })

  it('should filter files with query', async () => {
    mockQuery.isFileMatch.mockImplementation(path => path !== '/folder5/folder4' && path !== '/folder5/folder3/file1')
    const { elements } = await importFileCabinet(suiteAppClient, query)
    expect(elements).toEqual([expectedResults[0], expectedResults[2], expectedResults[4]])
  })

  it('should not run queries of no files are matched', async () => {
    mockQuery.areSomeFilesMatch.mockReturnValue(false)
    const { elements } = await importFileCabinet(suiteAppClient, query)
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

    await expect(importFileCabinet(suiteAppClient, query)).rejects.toThrow()
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

    await expect(importFileCabinet(suiteAppClient, query)).rejects.toThrow()
  })

  it('throw an error when readFiles failed', async () => {
    mockSuiteAppClient.readFiles.mockResolvedValue(undefined)
    await expect(importFileCabinet(suiteAppClient, query)).rejects.toThrow()
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

    await expect(importFileCabinet(suiteAppClient, query)).rejects.toThrow()
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

    await expect(importFileCabinet(suiteAppClient, query)).rejects.toThrow()
  })
})
