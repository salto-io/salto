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
import * as soap from 'soap'
import _ from 'lodash'
import { ExistingFileCabinetInstanceDetails } from '../../src/client/suiteapp_client/types'
import { ReadFileError } from '../../src/client/suiteapp_client/errors'
import SoapClient from '../../src/client/suiteapp_client/soap_client/soap_client'
import { InvalidSuiteAppCredentialsError } from '../../src/client/types'

describe('soap_client', () => {
  const addListAsyncMock = jest.fn()
  const updateListAsyncMock = jest.fn()
  const deleteListAsyncMock = jest.fn()
  const searchAsyncMock = jest.fn()
  const searchMoreWithIdAsyncMock = jest.fn()
  const getAllAsyncMock = jest.fn()
  const getAsyncMock = jest.fn()
  let wsdl: Record<string, unknown>
  const createClientAsyncMock = jest.spyOn(soap, 'createClientAsync')
  let client: SoapClient

  beforeEach(() => {
    jest.resetAllMocks()
    wsdl = {}
    createClientAsyncMock.mockResolvedValue({
      addListAsync: addListAsyncMock,
      updateListAsync: updateListAsyncMock,
      deleteListAsync: deleteListAsyncMock,
      getAsync: getAsyncMock,
      searchAsync: searchAsyncMock,
      searchMoreWithIdAsync: searchMoreWithIdAsyncMock,
      getAllAsync: getAllAsyncMock,
      addSoapHeader: (fn: () => object) => fn(),
      wsdl,
    } as unknown as soap.Client)

    client = new SoapClient(
      {
        accountId: 'ACCOUNT_ID',
        suiteAppTokenId: 'tokenId',
        suiteAppTokenSecret: 'tokenSecret',
      },
      fn => fn(),
    )
  })
  it('client should be cached', async () => {
    getAsyncMock.mockResolvedValue([{
      readResponse: {
        record: {
          content: 'ZGVtbw==',
        },
        status: { attributes: { isSuccess: 'true' } },
      },
    }])
    expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
    expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
    expect(createClientAsyncMock).toHaveBeenCalledTimes(1)
  })
  describe('readFile', () => {
    it('should return the content of a file', async () => {
      getAsyncMock.mockResolvedValue([{
        readResponse: {
          record: {
            content: 'ZGVtbw==',
          },
          status: { attributes: { isSuccess: 'true' } },
        },
      }])
      expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
    })

    it('no content should return the empty buffer', async () => {
      getAsyncMock.mockResolvedValue([{
        readResponse: {
          record: {
          },
          status: { attributes: { isSuccess: 'true' } },
        },
      }])
      expect(await client.readFile(1)).toEqual(Buffer.from(''))
    })

    it('should throw an error when failed to read the file', async () => {
      getAsyncMock.mockResolvedValue([{
        readResponse: {
          status: {
            attributes: { isSuccess: 'false' },
            statusDetail: [{ code: 'code', message: 'message' }],
          },
        },
      }])
      await expect(client.readFile(1)).rejects.toThrow(ReadFileError)
    })

    it('should throw an error when got invalid response', async () => {
      getAsyncMock.mockResolvedValue([{}])
      await expect(client.readFile(1)).rejects.toThrow(Error)
    })

    it('should throw InvalidSuiteAppCredentialsError', async () => {
      getAsyncMock.mockRejectedValue(new Error('bla bla Invalid login attempt. bla bla'))
      await expect(client.readFile(1)).rejects.toThrow(InvalidSuiteAppCredentialsError)
    })
  })
  describe('updateFileCabinetInstances', () => {
    it('should return the id is success and the error if fails', async () => {
      updateListAsyncMock.mockResolvedValue([{
        writeResponseList: {
          writeResponse: [
            {
              status: { attributes: { isSuccess: 'true' } },
              baseRef: {
                attributes: {
                  internalId: '6233',
                },
              },
            },
            {
              status: {
                attributes: { isSuccess: 'false' },
                statusDetail: [{ code: 'MEDIA_NOT_FOUND', message: 'Media item not found 62330' }],
              },
            },
          ],
          status: { attributes: { isSuccess: 'true' } },
        },
      }])
      expect(await client.updateFileCabinetInstances([
        {
          type: 'file',
          path: 'somePath',
          id: 6233,
          folder: -6,
          bundleable: true,
          isInactive: false,
          isOnline: false,
          hideInBundle: true,
          content: Buffer.from('aaa'),
          description: 'desc',
        },
        {
          type: 'folder',
          path: 'somePath2',
          id: 62330,
          bundleable: true,
          isInactive: false,
          isPrivate: false,
          description: 'desc',
        },
      ])).toEqual([
        6233,
        new Error('SOAP api call to update file cabinet instance somePath2 failed. error code: MEDIA_NOT_FOUND, error message: Media item not found 62330'),
      ])
    })

    it('should throw an error if request fails', async () => {
      updateListAsyncMock.mockResolvedValue([{
        writeResponseList: {
          status: {
            attributes: { isSuccess: 'false' },
            statusDetail: [{ code: 'SOME_ERROR', message: 'SOME_ERROR' }],
          },
        },
      }])

      await expect(client.updateFileCabinetInstances([
        {
          type: 'file',
          path: 'somePath',
          id: 6233,
          folder: -6,
          bundleable: true,
          isInactive: false,
          isOnline: false,
          hideInBundle: true,
          content: Buffer.from('aaa'),
          description: 'desc',
        },
        {
          type: 'folder',
          path: 'somePath2',
          id: 62330,
          bundleable: true,
          isInactive: false,
          isPrivate: false,
          description: 'desc',
        },
      ])).rejects.toThrow('Failed to updateList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      updateListAsyncMock.mockResolvedValue([{}])
      await expect(client.updateFileCabinetInstances([
        {
          type: 'file',
          path: 'somePath',
          id: 6233,
          folder: -6,
          bundleable: true,
          isInactive: false,
          isOnline: false,
          hideInBundle: true,
          content: Buffer.from('aaa'),
          description: 'desc',
        },
        {
          type: 'folder',
          path: 'somePath2',
          id: 62330,
          bundleable: true,
          isInactive: false,
          isPrivate: false,
          description: 'desc',
        },
      ])).rejects.toThrow('Got invalid response from updateList request. Errors:')
    })
    it('should throw InvalidSuiteAppCredentialsError', async () => {
      updateListAsyncMock.mockRejectedValue(new Error('bla bla Invalid login attempt. bla bla'))
      await expect(client.updateFileCabinetInstances([
        {
          type: 'file',
          path: 'somePath',
          id: 6233,
          folder: -6,
          bundleable: true,
          isInactive: false,
          isOnline: false,
          hideInBundle: true,
          content: Buffer.from('aaa'),
          description: 'desc',
        },
        {
          type: 'folder',
          path: 'somePath2',
          id: 62330,
          bundleable: true,
          isInactive: false,
          isPrivate: false,
          description: 'desc',
        },
      ])).rejects.toThrow(InvalidSuiteAppCredentialsError)
    })
  })

  describe('addFileCabinetInstances', () => {
    it('should return the id is success and the error if fails', async () => {
      addListAsyncMock.mockResolvedValue([{
        writeResponseList: {
          writeResponse: [
            {
              status: { attributes: { isSuccess: 'true' } },
              baseRef: {
                attributes: {
                  internalId: '6334',
                },
              },
            },
            {
              status: {
                attributes: { isSuccess: 'false' },
                statusDetail: [{ code: 'INVALID_KEY_OR_REF', message: 'Invalid folder reference key -600' }],
              },
            },
          ],
          status: { attributes: { isSuccess: 'true' } },
        },
      }])
      expect(await client.addFileCabinetInstances([
        {
          type: 'file',
          path: 'addedFile',
          folder: -6,
          bundleable: true,
          isInactive: false,
          isOnline: false,
          hideInBundle: true,
          content: Buffer.from('aaa'),
          description: 'desc',
        },
        {
          type: 'folder',
          path: 'addedFile2',
          parent: -600,
          bundleable: true,
          isInactive: false,
          isPrivate: false,
          description: 'desc',
        },
      ])).toEqual([
        6334,
        new Error('SOAP api call to add file cabinet instance addedFile2 failed. error code: INVALID_KEY_OR_REF, error message: Invalid folder reference key -600'),
      ])
    })

    it('should throw an error if request fails', async () => {
      addListAsyncMock.mockResolvedValue([{
        writeResponseList: {
          status: {
            attributes: { isSuccess: 'false' },
            statusDetail: [{ code: 'SOME_ERROR', message: 'SOME_ERROR' }],
          },
        },
      }])
      await expect(client.addFileCabinetInstances([
        {
          type: 'file',
          path: 'addedFile',
          folder: -6,
          bundleable: true,
          isInactive: false,
          isOnline: false,
          hideInBundle: true,
          content: Buffer.from('aaa'),
          description: 'desc',
        },
        {
          type: 'folder',
          path: 'addedFile2',
          parent: -600,
          bundleable: true,
          isInactive: false,
          isPrivate: false,
          description: 'desc',
        },
      ])).rejects.toThrow('Failed to addList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      addListAsyncMock.mockResolvedValue([{}])
      await expect(client.addFileCabinetInstances([
        {
          type: 'file',
          path: 'addedFile',
          folder: -6,
          bundleable: true,
          isInactive: false,
          isOnline: false,
          hideInBundle: true,
          content: Buffer.from('aaa'),
          description: 'desc',
        },
        {
          type: 'folder',
          path: 'addedFile2',
          parent: -600,
          bundleable: true,
          isInactive: false,
          isPrivate: false,
          description: 'desc',
        },
      ])).rejects.toThrow('Got invalid response from addList request. Errors:')
    })

    it('should throw InvalidSuiteAppCredentialsError', async () => {
      addListAsyncMock.mockRejectedValue(new Error('bla bla Invalid login attempt. bla bla'))
      await expect(client.addFileCabinetInstances([
        {
          type: 'file',
          path: 'addedFile',
          folder: -6,
          bundleable: true,
          isInactive: false,
          isOnline: false,
          hideInBundle: true,
          content: Buffer.from('aaa'),
          description: 'desc',
        },
        {
          type: 'folder',
          path: 'addedFile2',
          parent: -600,
          bundleable: true,
          isInactive: false,
          isPrivate: false,
          description: 'desc',
        },
      ])).rejects.toThrow(InvalidSuiteAppCredentialsError)
    })
  })

  describe('deleteFileCabinetInstances', () => {
    it('should return the id is success and the error if fails', async () => {
      deleteListAsyncMock.mockResolvedValue([{
        writeResponseList: {
          writeResponse: [
            {
              status: { attributes: { isSuccess: 'true' } },
              baseRef: {
                attributes: {
                  internalId: '7148',
                },
              },
            },
            {
              status: {
                attributes: { isSuccess: 'false' },
                statusDetail: [{ code: 'MEDIA_NOT_FOUND', message: 'Media item not found 99999' }],
              },
            },
          ],
          status: { attributes: { isSuccess: 'true' } },
        },
      }])
      expect(await client.deleteFileCabinetInstances([
        {
          type: 'file',
          id: 7148,
          path: 'somePath1',
        },
        {
          type: 'folder',
          id: 99999,
          path: 'somePath2',
        },
      ] as ExistingFileCabinetInstanceDetails[])).toEqual([
        7148,
        new Error('SOAP api call to delete file cabinet instance somePath2 failed. error code: MEDIA_NOT_FOUND, error message: Media item not found 99999'),
      ])
    })

    it('should throw an error if request fails', async () => {
      deleteListAsyncMock.mockResolvedValue([{
        writeResponseList: {
          status: {
            attributes: { isSuccess: 'false' },
            statusDetail: [{ code: 'SOME_ERROR', message: 'SOME_ERROR' }],
          },
        },
      }])
      await expect(client.deleteFileCabinetInstances([
        {
          type: 'file',
          id: 7148,
          path: 'somePath1',
        },
        {
          type: 'folder',
          id: 99999,
          path: 'somePath2',
        },
      ] as ExistingFileCabinetInstanceDetails[])).rejects.toThrow('Failed to deleteList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      deleteListAsyncMock.mockResolvedValue([{}])
      await expect(client.deleteFileCabinetInstances([
        {
          type: 'file',
          id: 7148,
          path: 'somePath1',
        },
        {
          type: 'folder',
          id: 99999,
          path: 'somePath2',
        },
      ] as ExistingFileCabinetInstanceDetails[])).rejects.toThrow('Got invalid response from deleteList request. Errors:')
    })

    it('should throw InvalidSuiteAppCredentialsError', async () => {
      deleteListAsyncMock.mockRejectedValue(new Error('bla bla Invalid login attempt. bla bla'))
      await expect(client.deleteFileCabinetInstances([
        {
          type: 'file',
          id: 7148,
          path: 'somePath1',
        },
        {
          type: 'folder',
          id: 99999,
          path: 'somePath2',
        },
      ] as ExistingFileCabinetInstanceDetails[])).rejects.toThrow(InvalidSuiteAppCredentialsError)
    })
  })

  describe('getAllRecords', () => {
    beforeEach(() => {
      _.assign(wsdl, {
        definitions: {
          schemas: {
            someNamespace: {
              complexTypes: {
                SubsidiarySearch: 'someValue',
                ItemSearch: 'someValue',
              },
            },
          },
        },
      })
    })
    it('Should return record using search', async () => {
      searchAsyncMock.mockResolvedValue([{
        searchResult: {
          totalPages: 1,
          searchId: 'someId',
          recordList: {
            record: [{ id: 'id1' }, { id: 'id2' }],
          },
        },
      }])
      await expect(client.getAllRecords(['Subsidiary'])).resolves.toEqual([{ id: 'id1' }, { id: 'id2' }])
    })

    it('Should work for item type', async () => {
      searchAsyncMock.mockResolvedValue([{
        searchResult: {
          totalPages: 1,
          searchId: 'someId',
          recordList: {
            record: [{ id: 'id1' }, { id: 'id2' }],
          },
        },
      }])
      await expect(client.getAllRecords(['InventoryItem'])).resolves.toEqual([{ id: 'id1' }, { id: 'id2' }])
      expect(searchAsyncMock).toHaveBeenCalledWith({
        searchRecord: {
          attributes: {
            'xmlns:q1': 'someNamespace',
            'xsi:type': 'q1:ItemSearch',
          },
          'q1:basic': {
            attributes: {
              'xmlns:platformCommon': 'urn:common_2020_2.platform.webservices.netsuite.com',
              'xmlns:platformCore': 'urn:core_2020_2.platform.webservices.netsuite.com',
            },
            'platformCommon:type': {
              attributes: {
                operator: 'anyOf',
                'xsi:type': 'platformCore:SearchEnumMultiSelectField',
              },
              'platformCore:searchValue': ['_inventoryItem'],
            },
          },
        },
      })
    })

    it('Should throw an error if got invalid search results', async () => {
      searchAsyncMock.mockResolvedValue([{}])
      await expect(client.getAllRecords(['Subsidiary'])).rejects.toThrow()
    })

    it('Should call all search pages', async () => {
      searchAsyncMock.mockResolvedValue([{
        searchResult: {
          totalPages: 2,
          searchId: 'someId',
          recordList: {
            record: [{ id: 'id1' }],
          },
        },
      }])

      searchMoreWithIdAsyncMock.mockResolvedValue([{
        searchResult: {
          totalPages: 2,
          searchId: 'someId',
          recordList: {
            record: [{ id: 'id2' }],
          },
        },
      }])
      await expect(client.getAllRecords(['Subsidiary'])).resolves.toEqual([{ id: 'id1' }, { id: 'id2' }])
    })

    it('Should throw an error if got invalid searchMoreWithId results', async () => {
      searchAsyncMock.mockResolvedValue([{
        searchResult: {
          totalPages: 2,
          searchId: 'someId',
          recordList: {
            record: [{ id: 'id1' }],
          },
        },
      }])

      searchMoreWithIdAsyncMock.mockResolvedValue([{}])
      await expect(client.getAllRecords(['Subsidiary'])).rejects.toThrow()
    })

    it('Should use getAll if search not supported', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (wsdl as any).definitions.schemas.someNamespace.complexTypes.SubsidiarySearch
      getAllAsyncMock.mockResolvedValue([{
        getAllResult: {
          recordList: {
            record: [{ id: 'id1' }, { id: 'id2' }],
          },
        },
      }])
      await expect(client.getAllRecords(['Subsidiary'])).resolves.toEqual([{ id: 'id1' }, { id: 'id2' }])
    })

    it('Should throw an error if got invalid getAll results', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (wsdl as any).definitions.schemas.someNamespace.complexTypes.SubsidiarySearch

      getAllAsyncMock.mockResolvedValue([{}])
      await expect(client.getAllRecords(['Subsidiary'])).rejects.toThrow()
    })
  })
})
