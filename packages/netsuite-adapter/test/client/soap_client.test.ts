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
import { ElemID, InstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { ExistingFileCabinetInstanceDetails } from '../../src/client/suiteapp_client/types'
import { ReadFileError } from '../../src/client/suiteapp_client/errors'
import SoapClient from '../../src/client/suiteapp_client/soap_client/soap_client'
import { InvalidSuiteAppCredentialsError } from '../../src/client/types'
import { NETSUITE } from '../../src/constants'

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
    wsdl = {
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
    }

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


  describe('retries', () => {
    it('when succeeds within the permitted retries should return the results', async () => {
      getAsyncMock.mockRejectedValueOnce(new Error())
      getAsyncMock.mockResolvedValueOnce([{
        readResponse: {
          record: {
            content: 'ZGVtbw==',
          },
          status: { attributes: { isSuccess: 'true' } },
        },
      }])
      expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
      expect(getAsyncMock).toHaveBeenCalledTimes(2)
    })

    it('when still failing after the permitted retries should throw', async () => {
      getAsyncMock.mockRejectedValue(new Error())
      await expect(client.readFile(1)).rejects.toThrow()
    })
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
      await expect(client.getAllRecords(['subsidiary'])).resolves.toEqual([{ id: 'id1' }, { id: 'id2' }])
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
      await expect(client.getAllRecords(['inventoryItem'])).resolves.toEqual([{ id: 'id1' }, { id: 'id2' }])
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
      await expect(client.getAllRecords(['subsidiary'])).rejects.toThrow()
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
      await expect(client.getAllRecords(['subsidiary'])).resolves.toEqual([{ id: 'id1' }, { id: 'id2' }])
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
      await expect(client.getAllRecords(['subsidiary'])).rejects.toThrow()
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
      await expect(client.getAllRecords(['subsidiary'])).resolves.toEqual([{ id: 'id1' }, { id: 'id2' }])
    })

    it('Should throw an error if got invalid getAll results', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (wsdl as any).definitions.schemas.someNamespace.complexTypes.SubsidiarySearch

      getAllAsyncMock.mockResolvedValue([{}])
      await expect(client.getAllRecords(['subsidiary'])).rejects.toThrow()
    })
  })

  describe('updateInstances', () => {
    const subType = new ObjectType({ elemID: new ElemID(NETSUITE, 'SubType') })
    const subsidiaryType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'subsidiary'),
      fields: {
        obj: { refType: subType },
        objList: { refType: new ListType(subType) },
        ref: {
          refType: new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary') }),
          annotations: { isReference: true },
        },
      },
    })

    it('should return the id is success and the error if fails', async () => {
      updateListAsyncMock.mockResolvedValue([{
        writeResponseList: {
          writeResponse: [
            {
              status: { attributes: { isSuccess: 'true' } },
              baseRef: {
                attributes: {
                  internalId: '1',
                },
              },
            },
            {
              status: {
                attributes: { isSuccess: 'false' },
                statusDetail: [{ code: 'SOME_ERROR', message: 'Some Error Message' }],
              },
            },
          ],
          status: { attributes: { isSuccess: 'true' } },
        },
      }])

      const instance1 = new InstanceElement(
        'instance1',
        subsidiaryType,
        {
          name: 'name',
          obj: {},
          objList: [{}],
          ref: {},
        }
      )

      const instance2 = new InstanceElement(
        'instance2',
        subsidiaryType,
        { name: 'name' }
      )
      expect(await client.updateInstances([
        instance1,
        instance2,
      ])).toEqual([
        1,
        new Error(`SOAP api call updateList for instance ${instance2.elemID.getFullName()} failed. error code: SOME_ERROR, error message: Some Error Message`),
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

      await expect(client.updateInstances([
        new InstanceElement(
          'instance',
          subsidiaryType,
          { name: 'name' }
        ),
      ])).rejects.toThrow('Failed to updateList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      updateListAsyncMock.mockResolvedValue([{}])
      await expect(client.updateInstances([
        new InstanceElement(
          'instance',
          subsidiaryType,
          { name: 'name' },
        ),
      ])).rejects.toThrow('Got invalid response from updateList request. Errors:')
    })
  })

  describe('addInstances', () => {
    const subType = new ObjectType({ elemID: new ElemID(NETSUITE, 'SubType') })
    const subsidiaryType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'subsidiary'),
      fields: {
        obj: { refType: subType },
        objList: { refType: new ListType(subType) },
        ref: {
          refType: new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary') }),
          annotations: { isReference: true },
        },
      },
    })

    it('should return the id is success and the error if fails', async () => {
      addListAsyncMock.mockResolvedValue([{
        writeResponseList: {
          writeResponse: [
            {
              status: { attributes: { isSuccess: 'true' } },
              baseRef: {
                attributes: {
                  internalId: '1',
                },
              },
            },
            {
              status: {
                attributes: { isSuccess: 'false' },
                statusDetail: [{ code: 'SOME_ERROR', message: 'Some Error Message' }],
              },
            },
          ],
          status: { attributes: { isSuccess: 'true' } },
        },
      }])

      const instance1 = new InstanceElement(
        'instance1',
        subsidiaryType,
        {
          name: 'name',
          obj: {},
          objList: [{}],
          ref: {},
        }
      )

      const instance2 = new InstanceElement(
        'instance2',
        subsidiaryType,
        { name: 'name' }
      )
      expect(await client.addInstances([
        instance1,
        instance2,
      ])).toEqual([
        1,
        new Error(`SOAP api call addList for instance ${instance2.elemID.getFullName()} failed. error code: SOME_ERROR, error message: Some Error Message`),
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

      await expect(client.addInstances([
        new InstanceElement(
          'instance',
          subsidiaryType,
          { name: 'name' }
        ),
      ])).rejects.toThrow('Failed to addList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      addListAsyncMock.mockResolvedValue([{}])
      await expect(client.addInstances([
        new InstanceElement(
          'instance',
          subsidiaryType,
          { name: 'name' },
        ),
      ])).rejects.toThrow('Got invalid response from addList request. Errors:')
    })
  })

  describe('deleteInstances', () => {
    const subType = new ObjectType({ elemID: new ElemID(NETSUITE, 'SubType') })
    const subsidiaryType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'subsidiary'),
      fields: {
        obj: { refType: subType },
        objList: { refType: new ListType(subType) },
        ref: {
          refType: new ObjectType({ elemID: new ElemID(NETSUITE, 'subsidiary') }),
          annotations: { isReference: true },
        },
      },
    })

    it('should return the id is success and the error if fails', async () => {
      deleteListAsyncMock.mockResolvedValue([{
        writeResponseList: {
          writeResponse: [
            {
              status: { attributes: { isSuccess: 'true' } },
              baseRef: {
                attributes: {
                  internalId: '1',
                },
              },
            },
            {
              status: {
                attributes: { isSuccess: 'false' },
                statusDetail: [{ code: 'SOME_ERROR', message: 'Some Error Message' }],
              },
            },
          ],
          status: { attributes: { isSuccess: 'true' } },
        },
      }])

      const instance1 = new InstanceElement(
        'instance1',
        subsidiaryType,
        {
          name: 'name',
          obj: {},
          objList: [{}],
          ref: {},
          attributes: {
            internalId: '1',
          },
        }
      )

      const instance2 = new InstanceElement(
        'instance2',
        subsidiaryType,
        {
          name: 'name',
          attributes: {
            internalId: '2',
          },
        }
      )
      expect(await client.deleteInstances([
        instance1,
        instance2,
      ])).toEqual([
        1,
        new Error(`SOAP api call deleteList for instance ${instance2.elemID.getFullName()} failed. error code: SOME_ERROR, error message: Some Error Message`),
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

      await expect(client.deleteInstances([
        new InstanceElement(
          'instance',
          subsidiaryType,
          {
            name: 'name',
            attributes: {
              internalId: '1',
            },
          }
        ),
      ])).rejects.toThrow('Failed to deleteList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      deleteListAsyncMock.mockResolvedValue([{}])
      await expect(client.deleteInstances([
        new InstanceElement(
          'instance',
          subsidiaryType,
          {
            name: 'name',
            attributes: {
              internalId: '1',
            },
          }
        ),
      ])).rejects.toThrow('Got invalid response from deleteList request. Errors:')
    })
  })
})
