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
import _ from 'lodash'
import { ElemID, InstanceElement, ListType, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { soap } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { promises } from '@salto-io/lowerdash'
import { DEFAULT_AXIOS_TIMEOUT_IN_MINUTES } from '../../../../src/config/constants'
import { ExistingFileCabinetInstanceDetails } from '../../../../src/client/suiteapp_client/types'
import { ReadFileError } from '../../../../src/client/suiteapp_client/errors'
import SoapClient, * as soapClientUtils from '../../../../src/client/suiteapp_client/soap_client/soap_client'
import { InvalidSuiteAppCredentialsError } from '../../../../src/client/types'
import {
  CUSTOM_FIELD_LIST,
  CUSTOM_RECORD_TYPE,
  NETSUITE,
  OTHER_CUSTOM_FIELD_PREFIX,
  SOAP_SCRIPT_ID,
} from '../../../../src/constants'
import * as filterUneditableLockedFieldModule from '../../../../src/client/suiteapp_client/soap_client/filter_uneditable_locked_field'
import {
  INSUFFICIENT_PERMISSION_ERROR,
  PLATFORM_CORE_CUSTOM_FIELD,
} from '../../../../src/client/suiteapp_client/constants'

jest.mock('uuid', () => ({
  ...jest.requireActual('uuid'),
  v4: jest.fn().mockReturnValue(''),
}))

jest.spyOn(promises.timeout, 'withTimeout').mockImplementation(promise => promise)

describe('soap_client', () => {
  const addListAsyncMock = jest.fn()
  const updateListAsyncMock = jest.fn()
  const deleteListAsyncMock = jest.fn()
  const searchAsyncMock = jest.fn()
  const searchMoreWithIdAsyncMock = jest.fn()
  const getAllAsyncMock = jest.fn()
  const getAsyncMock = jest.fn()
  const getSelectValueAsyncMock = jest.fn()
  let wsdl: Record<string, unknown>
  const createClientAsyncMock = jest.spyOn(soapClientUtils, 'createClientAsync')
  const defaultSoapTimeOut = DEFAULT_AXIOS_TIMEOUT_IN_MINUTES * 60 * 1000
  let client: SoapClient

  beforeEach(() => {
    jest.clearAllMocks()
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
      getSelectValueAsync: getSelectValueAsyncMock,
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
      (_t: string, _c: number) => false,
      defaultSoapTimeOut,
    )
  })

  describe('retries', () => {
    it('when succeeds within the permitted retries should return the results', async () => {
      getAsyncMock.mockRejectedValueOnce({ message: '', code: 'ECONNRESET' })
      getAsyncMock.mockResolvedValueOnce([
        {
          readResponse: {
            record: {
              content: 'ZGVtbw==',
            },
            status: { attributes: { isSuccess: 'true' } },
          },
        },
      ])
      expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
      expect(getAsyncMock).toHaveBeenCalledTimes(2)
    })

    it('when still failing after the permitted retries should throw', async () => {
      getAsyncMock.mockRejectedValue(new Error('ECONNRESET'))
      await expect(client.readFile(1)).rejects.toThrow()
    })

    it('when having a delayed concurrency retry', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: TimerHandler) => (_.isFunction(cb) ? cb() : undefined))
      getAsyncMock.mockRejectedValueOnce(new Error('Concurrent request limit exceeded'))
      getAsyncMock.mockResolvedValueOnce([
        {
          readResponse: {
            record: {
              content: 'ZGVtbw==',
            },
            status: { attributes: { isSuccess: 'true' } },
          },
        },
      ])
      expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
      expect(getAsyncMock).toHaveBeenCalledTimes(2)
    })

    it('when having a delayed server error retry', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: TimerHandler) => (_.isFunction(cb) ? cb() : undefined))
      getAsyncMock.mockRejectedValueOnce({ response: { status: 500 } })
      getAsyncMock.mockRejectedValueOnce({ response: { status: 501 } })
      getAsyncMock.mockRejectedValueOnce({ response: { status: 502 } })
      getAsyncMock.mockResolvedValueOnce([
        {
          readResponse: {
            record: {
              content: 'ZGVtbw==',
            },
            status: { attributes: { isSuccess: 'true' } },
          },
        },
      ])
      expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
      expect(getAsyncMock).toHaveBeenCalledTimes(4)
    })
  })
  it('client should be cached', async () => {
    getAsyncMock.mockResolvedValue([
      {
        readResponse: {
          record: {
            content: 'ZGVtbw==',
          },
          status: { attributes: { isSuccess: 'true' } },
        },
      },
    ])
    expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
    expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
    expect(createClientAsyncMock).toHaveBeenCalledTimes(1)
  })
  describe('readFile', () => {
    it('should return the content of a file', async () => {
      getAsyncMock.mockResolvedValue([
        {
          readResponse: {
            record: {
              content: 'ZGVtbw==',
            },
            status: { attributes: { isSuccess: 'true' } },
          },
        },
      ])
      expect(await client.readFile(1)).toEqual(Buffer.from('demo'))
    })

    it('no content should return the empty buffer', async () => {
      getAsyncMock.mockResolvedValue([
        {
          readResponse: {
            record: {},
            status: { attributes: { isSuccess: 'true' } },
          },
        },
      ])
      expect(await client.readFile(1)).toEqual(Buffer.from(''))
    })

    it('should throw an error when failed to read the file', async () => {
      getAsyncMock.mockResolvedValue([
        {
          readResponse: {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [{ code: 'code', message: 'message' }],
            },
          },
        },
      ])
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
      updateListAsyncMock.mockResolvedValue([
        {
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
        },
      ])
      expect(
        await client.updateFileCabinetInstances([
          {
            type: 'file',
            path: 'somePath',
            id: 6233,
            folder: '-6',
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
            parent: undefined,
          },
        ]),
      ).toEqual([
        6233,
        new Error(
          'SOAP api call to update file cabinet instance somePath2 failed. error code: MEDIA_NOT_FOUND, error message: Media item not found 62330',
        ),
      ])
    })

    it('should throw an error if request fails', async () => {
      updateListAsyncMock.mockResolvedValue([
        {
          writeResponseList: {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [{ code: 'SOME_ERROR', message: 'SOME_ERROR' }],
            },
          },
        },
      ])

      await expect(
        client.updateFileCabinetInstances([
          {
            type: 'file',
            path: 'somePath',
            id: 6233,
            folder: '-6',
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
            parent: undefined,
          },
        ]),
      ).rejects.toThrow('Failed to updateList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      updateListAsyncMock.mockResolvedValue([{}])
      await expect(
        client.updateFileCabinetInstances([
          {
            type: 'file',
            path: 'somePath',
            id: 6233,
            folder: '-6',
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
            parent: undefined,
          },
        ]),
      ).rejects.toThrow('Got invalid response from updateList request. Errors:')
    })
    it('should throw InvalidSuiteAppCredentialsError', async () => {
      updateListAsyncMock.mockRejectedValue(new Error('bla bla Invalid login attempt. bla bla'))
      await expect(
        client.updateFileCabinetInstances([
          {
            type: 'file',
            path: 'somePath',
            id: 6233,
            folder: '-6',
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
            parent: undefined,
          },
        ]),
      ).rejects.toThrow(InvalidSuiteAppCredentialsError)
    })
  })

  describe('addFileCabinetInstances', () => {
    it('should return the id is success and the error if fails', async () => {
      addListAsyncMock.mockResolvedValue([
        {
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
        },
      ])
      expect(
        await client.addFileCabinetInstances([
          {
            type: 'file',
            path: 'addedFile',
            folder: '-6',
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
            parent: '-600',
            bundleable: true,
            isInactive: false,
            isPrivate: false,
            description: 'desc',
          },
        ]),
      ).toEqual([
        6334,
        new Error(
          'SOAP api call to add file cabinet instance addedFile2 failed. error code: INVALID_KEY_OR_REF, error message: Invalid folder reference key -600',
        ),
      ])
    })

    it('should throw an error if request fails', async () => {
      addListAsyncMock.mockResolvedValue([
        {
          writeResponseList: {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [{ code: 'SOME_ERROR', message: 'SOME_ERROR' }],
            },
          },
        },
      ])
      await expect(
        client.addFileCabinetInstances([
          {
            type: 'file',
            path: 'addedFile',
            folder: '-6',
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
            parent: '-600',
            bundleable: true,
            isInactive: false,
            isPrivate: false,
            description: 'desc',
          },
        ]),
      ).rejects.toThrow('Failed to addList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      addListAsyncMock.mockResolvedValue([{}])
      await expect(
        client.addFileCabinetInstances([
          {
            type: 'file',
            path: 'addedFile',
            folder: '-6',
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
            parent: '-600',
            bundleable: true,
            isInactive: false,
            isPrivate: false,
            description: 'desc',
          },
        ]),
      ).rejects.toThrow('Got invalid response from addList request. Errors:')
    })

    it('should throw InvalidSuiteAppCredentialsError', async () => {
      addListAsyncMock.mockRejectedValue(new Error('bla bla Invalid login attempt. bla bla'))
      await expect(
        client.addFileCabinetInstances([
          {
            type: 'file',
            path: 'addedFile',
            folder: '-6',
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
            parent: '-600',
            bundleable: true,
            isInactive: false,
            isPrivate: false,
            description: 'desc',
          },
        ]),
      ).rejects.toThrow(InvalidSuiteAppCredentialsError)
    })
  })

  describe('deleteFileCabinetInstances', () => {
    it('should return the id is success and the error if fails', async () => {
      deleteListAsyncMock.mockResolvedValue([
        {
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
        },
      ])
      expect(
        await client.deleteFileCabinetInstances([
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
        ] as ExistingFileCabinetInstanceDetails[]),
      ).toEqual([
        7148,
        new Error(
          'SOAP api call to delete file cabinet instance somePath2 failed. error code: MEDIA_NOT_FOUND, error message: Media item not found 99999',
        ),
      ])
    })

    it('should throw an error if request fails', async () => {
      deleteListAsyncMock.mockResolvedValue([
        {
          writeResponseList: {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [{ code: 'SOME_ERROR', message: 'SOME_ERROR' }],
            },
          },
        },
      ])
      await expect(
        client.deleteFileCabinetInstances([
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
        ] as ExistingFileCabinetInstanceDetails[]),
      ).rejects.toThrow('Failed to deleteList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      deleteListAsyncMock.mockResolvedValue([{}])
      await expect(
        client.deleteFileCabinetInstances([
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
        ] as ExistingFileCabinetInstanceDetails[]),
      ).rejects.toThrow('Got invalid response from deleteList request. Errors:')
    })

    it('should throw InvalidSuiteAppCredentialsError', async () => {
      deleteListAsyncMock.mockRejectedValue(new Error('bla bla Invalid login attempt. bla bla'))
      await expect(
        client.deleteFileCabinetInstances([
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
        ] as ExistingFileCabinetInstanceDetails[]),
      ).rejects.toThrow(InvalidSuiteAppCredentialsError)
    })
  })

  describe('getAllRecords', () => {
    it('Should return record using search', async () => {
      searchAsyncMock.mockResolvedValue([
        {
          searchResult: {
            totalPages: 1,
            searchId: 'someId',
            recordList: {
              record: [
                {
                  id: 'id1',
                  attributes: {
                    internalId: '1',
                  },
                },
                {
                  id: 'id2',
                  attributes: {
                    internalId: '2',
                  },
                },
              ],
            },
          },
        },
      ])
      await expect(client.getAllRecords(['subsidiary'])).resolves.toEqual({
        records: [
          {
            id: 'id1',
            attributes: {
              internalId: '1',
            },
          },
          {
            id: 'id2',
            attributes: {
              internalId: '2',
            },
          },
        ],
        largeTypesError: [],
      })
    })

    it('should exclude types with too many instances from search', async () => {
      searchAsyncMock.mockResolvedValue([
        {
          searchResult: {
            totalPages: 1,
            searchId: 'someId',
            recordList: {
              record: [
                {
                  id: 'id1',
                  attributes: {
                    internalId: '1',
                  },
                },
              ],
            },
          },
        },
      ])
      client = new SoapClient(
        {
          accountId: 'ACCOUNT_ID',
          suiteAppTokenId: 'tokenId',
          suiteAppTokenSecret: 'tokenSecret',
        },
        fn => fn(),
        (_type: string, count: number) => count > 1,
        defaultSoapTimeOut,
      )
      await expect(client.getAllRecords(['subsidiary', 'assemblyItem', 'descriptionItem'])).resolves.toMatchObject({
        records: [],
        largeTypesError: ['subsidiary', 'assemblyItem', 'descriptionItem'],
      })
    })

    it('should return empty record list when subsidiaries is disabled', async () => {
      searchAsyncMock.mockResolvedValue([
        {
          searchResult: {
            status: {
              attributes: {
                isSuccess: 'false',
              },
              statusDetail: [
                {
                  attributes: {
                    type: 'Error',
                  },
                  code: 'FEATURE_DISABLED',
                  message: 'Subsidiaries feature is not enabled in your NetSuite account.',
                },
              ],
            },
          },
        },
      ])
      await expect(client.getAllRecords(['subsidiary'])).resolves.toEqual({ records: [], largeTypesError: [] })
    })

    it('Should work for item type', async () => {
      searchAsyncMock.mockResolvedValue([
        {
          searchResult: {
            totalPages: 1,
            searchId: 'someId',
            recordList: {
              record: [
                {
                  id: 'id1',
                  attributes: {
                    internalId: '1',
                  },
                },
                {
                  id: 'id2',
                  attributes: {
                    internalId: '2',
                  },
                },
              ],
            },
          },
        },
      ])
      await expect(client.getAllRecords(['inventoryItem'])).resolves.toEqual({
        records: [
          {
            id: 'id1',
            attributes: {
              internalId: '1',
            },
          },
          {
            id: 'id2',
            attributes: {
              internalId: '2',
            },
          },
        ],
        largeTypesError: [],
      })
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
      searchAsyncMock.mockResolvedValue([
        {
          searchResult: {
            totalPages: 2,
            searchId: 'someId',
            recordList: {
              record: [
                {
                  id: 'id1',
                  attributes: {
                    internalId: '1',
                  },
                },
              ],
            },
          },
        },
      ])

      searchMoreWithIdAsyncMock.mockResolvedValue([
        {
          searchResult: {
            totalPages: 2,
            searchId: 'someId',
            recordList: {
              record: [
                {
                  id: 'id2',
                  attributes: {
                    internalId: '2',
                  },
                },
              ],
            },
          },
        },
      ])
      await expect(client.getAllRecords(['subsidiary'])).resolves.toEqual({
        records: [
          {
            id: 'id1',
            attributes: {
              internalId: '1',
            },
          },
          {
            id: 'id2',
            attributes: {
              internalId: '2',
            },
          },
        ],
        largeTypesError: [],
      })
    })

    it('Should throw an error if got invalid searchMoreWithId results', async () => {
      searchAsyncMock.mockResolvedValue([
        {
          searchResult: {
            totalPages: 2,
            searchId: 'someId',
            recordList: {
              record: [{ id: 'id1' }],
            },
          },
        },
      ])

      searchMoreWithIdAsyncMock.mockResolvedValue([{}])
      await expect(client.getAllRecords(['subsidiary'])).rejects.toThrow()
    })

    it('Should retry if got unexpected error', async () => {
      searchAsyncMock.mockResolvedValue([
        {
          searchResult: {
            totalPages: 2,
            searchId: 'someId',
            recordList: {
              record: [
                {
                  id: 'id1',
                  attributes: {
                    internalId: '1',
                  },
                },
              ],
            },
          },
        },
      ])

      searchMoreWithIdAsyncMock.mockResolvedValueOnce([
        {
          searchResult: {
            status: {
              attributes: {
                isSuccess: 'false',
              },
              statusDetail: [
                {
                  attributes: {
                    type: 'ERROR',
                  },
                  code: 'UNEXPECTED_ERROR',
                  message: 'An unexpected error occurred. Error ID: kv2v69egzfx8zkrdc802',
                },
              ],
            },
          },
        },
      ])

      searchMoreWithIdAsyncMock.mockResolvedValueOnce([
        {
          searchResult: {
            totalPages: 2,
            searchId: 'someId',
            recordList: {
              record: [
                {
                  id: 'id2',
                  attributes: {
                    internalId: '2',
                  },
                },
              ],
            },
          },
        },
      ])

      await expect(client.getAllRecords(['subsidiary'])).resolves.toEqual({
        records: [
          {
            id: 'id1',
            attributes: {
              internalId: '1',
            },
          },
          {
            id: 'id2',
            attributes: {
              internalId: '2',
            },
          },
        ],
        largeTypesError: [],
      })
      expect(searchMoreWithIdAsyncMock).toHaveBeenCalledTimes(2)
    })

    it('Should use getAll if search not supported', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (wsdl as any).definitions.schemas.someNamespace.complexTypes.SubsidiarySearch
      getAllAsyncMock.mockResolvedValue([
        {
          getAllResult: {
            recordList: {
              record: [
                {
                  id: 'id1',
                  attributes: {
                    internalId: '1',
                  },
                },
                {
                  id: 'id2',
                  attributes: {
                    internalId: '2',
                  },
                },
              ],
            },
          },
        },
      ])
      await expect(client.getAllRecords(['subsidiary'])).resolves.toEqual({
        records: [
          {
            id: 'id1',
            attributes: {
              internalId: '1',
            },
          },
          {
            id: 'id2',
            attributes: {
              internalId: '2',
            },
          },
        ],
        largeTypesError: [],
      })
    })

    it('Should throw an error if got invalid getAll results', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (wsdl as any).definitions.schemas.someNamespace.complexTypes.SubsidiarySearch

      getAllAsyncMock.mockResolvedValue([{}])
      await expect(client.getAllRecords(['subsidiary'])).rejects.toThrow()
    })

    it('Should throw a better error if got error getAll results', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (wsdl as any).definitions.schemas.someNamespace.complexTypes.SubsidiarySearch

      getAllAsyncMock.mockResolvedValue([
        {
          getAllResult: {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [{ code: 'SOME_ERROR', message: 'Some Error' }],
            },
          },
        },
      ])
      await expect(client.getAllRecords(['subsidiary'])).rejects.toThrow(
        'Failed to run getAll request: error code: SOME_ERROR, error message: Some Error',
      )
    })
  })

  describe('getCustomRecords', () => {
    it('Should return custom records using search', async () => {
      searchAsyncMock.mockResolvedValue([
        {
          searchResult: {
            totalPages: 1,
            searchId: 'someId',
            recordList: {
              record: [
                {
                  id: 'id1',
                  attributes: {
                    internalId: '1',
                  },
                },
                {
                  id: 'id2',
                  attributes: {
                    internalId: '2',
                  },
                },
              ],
            },
          },
        },
      ])
      await expect(client.getCustomRecords(['custrecord'])).resolves.toMatchObject({
        customRecords: [
          {
            type: 'custrecord',
            records: [
              {
                id: 'id1',
                attributes: {
                  internalId: '1',
                },
              },
              {
                id: 'id2',
                attributes: {
                  internalId: '2',
                },
              },
            ],
          },
        ],
        largeTypesError: [],
      })
    })

    it('should exclude types with too many instances from search', async () => {
      searchAsyncMock.mockResolvedValue([
        {
          searchResult: {
            totalPages: 1,
            searchId: 'someId',
            recordList: {
              record: [
                {
                  id: 'id1',
                  attributes: {
                    internalId: '1',
                  },
                },
              ],
            },
          },
        },
      ])
      client = new SoapClient(
        {
          accountId: 'ACCOUNT_ID',
          suiteAppTokenId: 'tokenId',
          suiteAppTokenSecret: 'tokenSecret',
        },
        fn => fn(),
        (_type: string, count: number) => count > 1,
        defaultSoapTimeOut,
      )
      await expect(client.getCustomRecords(['custrecord'])).resolves.toMatchObject({
        largeTypesError: ['custrecord'],
        customRecords: [],
      })
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
      updateListAsyncMock.mockResolvedValue([
        {
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
        },
      ])

      const instance1 = new InstanceElement('instance1', subsidiaryType, {
        name: 'name',
        obj: {},
        objList: [{}],
        ref: {},
      })

      const instance2 = new InstanceElement('instance2', subsidiaryType, { name: 'name' })
      expect(await client.updateInstances([instance1, instance2], async () => true)).toEqual([
        1,
        new Error(
          `SOAP api call updateList for instance ${instance2.elemID.getFullName()} failed. error code: SOME_ERROR, error message: Some Error Message`,
        ),
      ])
    })

    it('should throw an error if request fails', async () => {
      updateListAsyncMock.mockResolvedValue([
        {
          writeResponseList: {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [{ code: 'SOME_ERROR', message: 'SOME_ERROR' }],
            },
          },
        },
      ])

      await expect(
        client.updateInstances([new InstanceElement('instance', subsidiaryType, { name: 'name' })], async () => true),
      ).rejects.toThrow('Failed to updateList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      updateListAsyncMock.mockResolvedValue([{}])
      await expect(
        client.updateInstances([new InstanceElement('instance', subsidiaryType, { name: 'name' })], async () => true),
      ).rejects.toThrow('Got invalid response from updateList request. Errors:')
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
    const customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'custrecord'),
      annotations: {
        recordType: new ReferenceExpression(new ElemID(NETSUITE, CUSTOM_RECORD_TYPE, 'instance', 'record')),
      },
    })

    it('should return the id is success and the error if fails', async () => {
      addListAsyncMock.mockResolvedValue([
        {
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
              {
                status: { attributes: { isSuccess: 'true' } },
                baseRef: {
                  attributes: {
                    internalId: '3',
                  },
                },
              },
            ],
            status: { attributes: { isSuccess: 'true' } },
          },
        },
      ])

      const instance1 = new InstanceElement('instance1', subsidiaryType, {
        name: 'name',
        obj: {},
        objList: [{}],
        ref: {},
      })

      const instance2 = new InstanceElement('instance2', subsidiaryType, { name: 'name' })

      const customRecord = new InstanceElement('custrecord_record1', customRecordType, { name: 'record1' })

      expect(await client.addInstances([instance1, instance2, customRecord], async () => true)).toEqual([
        1,
        new Error(
          `SOAP api call addList for instance ${instance2.elemID.getFullName()} failed. error code: SOME_ERROR, error message: Some Error Message`,
        ),
        3,
      ])
    })

    it('should throw an error if request fails', async () => {
      addListAsyncMock.mockResolvedValue([
        {
          writeResponseList: {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [{ code: 'SOME_ERROR', message: 'SOME_ERROR' }],
            },
          },
        },
      ])

      await expect(
        client.addInstances([new InstanceElement('instance', subsidiaryType, { name: 'name' })], async () => true),
      ).rejects.toThrow('Failed to addList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      addListAsyncMock.mockResolvedValue([{}])
      await expect(
        client.addInstances([new InstanceElement('instance', subsidiaryType, { name: 'name' })], async () => true),
      ).rejects.toThrow('Got invalid response from addList request. Errors:')
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
    const customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'custrecord'),
      annotations: {
        recordType: new ReferenceExpression(new ElemID(NETSUITE, CUSTOM_RECORD_TYPE, 'instance', 'record')),
      },
    })

    it('should return the id is success and the error if fails', async () => {
      deleteListAsyncMock.mockResolvedValue([
        {
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
              {
                status: { attributes: { isSuccess: 'true' } },
                baseRef: {
                  attributes: {
                    internalId: '3',
                  },
                },
              },
            ],
            status: { attributes: { isSuccess: 'true' } },
          },
        },
      ])

      const instance1 = new InstanceElement('instance1', subsidiaryType, {
        name: 'name',
        obj: {},
        objList: [{}],
        ref: {},
        attributes: {
          internalId: '1',
        },
      })

      const instance2 = new InstanceElement('instance2', subsidiaryType, {
        name: 'name',
        attributes: {
          internalId: '2',
        },
      })

      const customRecord = new InstanceElement('custrecord_record1', customRecordType, {
        name: 'record1',
        attributes: {
          internalId: '3',
        },
        recType: {
          attributes: {
            internalId: '10',
          },
        },
      })

      expect(await client.deleteInstances([instance1, instance2, customRecord])).toEqual([
        1,
        new Error(
          `SOAP api call deleteList for instance ${instance2.elemID.getFullName()} failed. error code: SOME_ERROR, error message: Some Error Message`,
        ),
        3,
      ])
    })

    it('should throw an error if request fails', async () => {
      deleteListAsyncMock.mockResolvedValue([
        {
          writeResponseList: {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [{ code: 'SOME_ERROR', message: 'SOME_ERROR' }],
            },
          },
        },
      ])

      await expect(
        client.deleteInstances([
          new InstanceElement('instance', subsidiaryType, {
            name: 'name',
            attributes: {
              internalId: '1',
            },
          }),
        ]),
      ).rejects.toThrow('Failed to deleteList: error code: SOME_ERROR, error message: SOME_ERROR')
    })

    it('should throw an error if received invalid response', async () => {
      deleteListAsyncMock.mockResolvedValue([{}])
      await expect(
        client.deleteInstances([
          new InstanceElement('instance', subsidiaryType, {
            name: 'name',
            attributes: {
              internalId: '1',
            },
          }),
        ]),
      ).rejects.toThrow('Got invalid response from deleteList request. Errors:')
    })
  })

  describe('getSelectValue', () => {
    it('should make one request and return result', async () => {
      getSelectValueAsyncMock.mockResolvedValue([
        {
          getSelectValueResult: {
            status: {
              attributes: {
                isSuccess: 'true',
              },
            },
            totalRecords: 3,
            totalPages: 1,
            baseRefList: {
              baseRef: [
                {
                  attributes: {
                    internalId: '1',
                  },
                  name: 'test1',
                },
                {
                  attributes: {
                    internalId: '2',
                  },
                  name: 'test2',
                },
                {
                  attributes: {
                    internalId: '3',
                  },
                  name: 'test2',
                },
              ],
            },
          },
        },
      ])
      expect(await client.getSelectValue('account', 'unitstype', [])).toEqual({
        test1: ['1'],
        test2: ['2', '3'],
      })
      expect(getSelectValueAsyncMock).toHaveBeenCalledTimes(1)
      expect(getSelectValueAsyncMock).toHaveBeenCalledWith({
        pageIndex: 1,
        fieldDescription: {
          recordType: {
            attributes: { xmlns: 'urn:core_2020_2.platform.webservices.netsuite.com' },
            $value: 'account',
          },
          field: {
            attributes: { xmlns: 'urn:core_2020_2.platform.webservices.netsuite.com' },
            $value: 'unitstype',
          },
        },
      })
    })
    it('should make several requests and return result', async () => {
      getSelectValueAsyncMock.mockResolvedValueOnce([
        {
          getSelectValueResult: {
            status: {
              attributes: {
                isSuccess: 'true',
              },
            },
            totalRecords: 3,
            totalPages: 3,
            baseRefList: {
              baseRef: [
                {
                  attributes: {
                    internalId: '1',
                  },
                  name: 'test1',
                },
                {
                  attributes: {
                    internalId: '2',
                  },
                  name: 'test2',
                },
                {
                  attributes: {
                    internalId: '4',
                  },
                  name: 'test4',
                },
              ],
            },
          },
        },
      ])
      getSelectValueAsyncMock.mockResolvedValueOnce([
        {
          getSelectValueResult: {
            status: {
              attributes: {
                isSuccess: 'true',
              },
            },
            totalRecords: 3,
            totalPages: 3,
            baseRefList: {
              baseRef: [
                {
                  attributes: {
                    internalId: '3',
                  },
                  name: 'test2',
                },
                {
                  attributes: {
                    internalId: '5',
                  },
                  name: 'test5',
                },
                {
                  attributes: {
                    internalId: '6',
                  },
                  name: 'test5',
                },
              ],
            },
          },
        },
      ])
      getSelectValueAsyncMock.mockResolvedValueOnce([
        {
          getSelectValueResult: {
            status: {
              attributes: {
                isSuccess: 'true',
              },
            },
            totalRecords: 0,
            totalPages: 3,
          },
        },
      ])
      expect(await client.getSelectValue('account', 'unitstype', [])).toEqual({
        test1: ['1'],
        test2: ['2', '3'],
        test4: ['4'],
        test5: ['5', '6'],
      })
      expect(getSelectValueAsyncMock).toHaveBeenCalledTimes(3)
      expect(getSelectValueAsyncMock).toHaveBeenCalledWith(expect.objectContaining({ pageIndex: 1 }))
      expect(getSelectValueAsyncMock).toHaveBeenCalledWith(expect.objectContaining({ pageIndex: 2 }))
      expect(getSelectValueAsyncMock).toHaveBeenCalledWith(expect.objectContaining({ pageIndex: 3 }))
    })
    it('should make a request with filterBy', async () => {
      getSelectValueAsyncMock.mockResolvedValue([
        {
          getSelectValueResult: {
            status: {
              attributes: {
                isSuccess: 'true',
              },
            },
            totalRecords: 3,
            totalPages: 1,
            baseRefList: {
              baseRef: [
                {
                  attributes: {
                    internalId: '1',
                  },
                  name: 'test1',
                },
                {
                  attributes: {
                    internalId: '2',
                  },
                  name: 'test2',
                },
                {
                  attributes: {
                    internalId: '3',
                  },
                  name: 'test2',
                },
              ],
            },
          },
        },
      ])
      expect(await client.getSelectValue('account', 'unit', [{ field: 'unitstype', internalId: '2' }])).toEqual({
        test1: ['1'],
        test2: ['2', '3'],
      })
      expect(getSelectValueAsyncMock).toHaveBeenCalledTimes(1)
      expect(getSelectValueAsyncMock).toHaveBeenCalledWith({
        pageIndex: 1,
        fieldDescription: {
          recordType: {
            attributes: { xmlns: 'urn:core_2020_2.platform.webservices.netsuite.com' },
            $value: 'account',
          },
          field: {
            attributes: { xmlns: 'urn:core_2020_2.platform.webservices.netsuite.com' },
            $value: 'unit',
          },
          filterByValueList: {
            attributes: { xmlns: 'urn:core_2020_2.platform.webservices.netsuite.com' },
            filterBy: [
              {
                field: 'unitstype',
                internalId: '2',
              },
            ],
          },
        },
      })
    })
    it('should return empty result when respose isSuccess=false', async () => {
      getSelectValueAsyncMock.mockResolvedValue([
        {
          getSelectValueResult: {
            status: {
              attributes: {
                isSuccess: 'false',
              },
              statusDetail: [
                {
                  code: 'ERROR',
                  message: 'Some error',
                },
              ],
            },
          },
        },
      ])
      expect(await client.getSelectValue('account', 'unitstype', [])).toEqual({})
    })
    it('should throw error when result is invalid', async () => {
      getSelectValueAsyncMock.mockResolvedValue([
        {
          getSelectValueResult: {},
        },
      ])
      await expect(client.getSelectValue('account', 'unitstype', [])).rejects.toThrow()
    })
  })

  describe("Redeploy when update/addition fails on 'INSUFFICIENT PERMISSION' error for uneditable locked fields", () => {
    const testType = new ObjectType({ elemID: new ElemID(NETSUITE, 'TestType') })

    const customField1 = {
      attributes: {
        [SOAP_SCRIPT_ID]: `${OTHER_CUSTOM_FIELD_PREFIX}test1`,
        'xsi:type': 'platformCore:BooleanCustomFieldRef',
        'platformCore:value': true,
      },
    }
    const customField2 = {
      attributes: {
        [SOAP_SCRIPT_ID]: `${OTHER_CUSTOM_FIELD_PREFIX}test2`,
        'xsi:type': 'platformCore:BooleanCustomFieldRef',
        'platformCore:value': true,
      },
    }

    const errorMessage1 =
      `You do not have permissions to set a value for element ${customField1.attributes[SOAP_SCRIPT_ID]} due to one of the following reasons:` +
      ' 1) The field is read-only;' +
      ' 2) An associated feature is disabled;' +
      ' 3) The field is available either when a record is created or updated, but not in both cases.'

    const errorMessage2 =
      `You do not have permissions to set a value for element ${customField2.attributes[SOAP_SCRIPT_ID]} due to one of the following reasons:` +
      ' 1) The field is read-only;' +
      ' 2) An associated feature is disabled;' +
      ' 3) The field is available either when a record is created or updated, but not in both cases.'

    const writeResponseListError1 = {
      writeResponseList: {
        writeResponse: [
          {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [
                {
                  code: INSUFFICIENT_PERMISSION_ERROR,
                  message: errorMessage1,
                },
              ],
            },
          },
        ],
        status: { attributes: { isSuccess: 'true' } },
      },
    }

    const writeResponseListError2 = {
      writeResponseList: {
        writeResponse: [
          {
            status: {
              attributes: { isSuccess: 'false' },
              statusDetail: [
                {
                  code: INSUFFICIENT_PERMISSION_ERROR,
                  message: errorMessage2,
                },
              ],
            },
          },
        ],
        status: { attributes: { isSuccess: 'true' } },
      },
    }

    const writeResponseListSuccess = {
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
        ],
        status: { attributes: { isSuccess: 'true' } },
      },
    }

    const elementsSource = buildElementsSourceFromElements([])

    const originalInstance = new InstanceElement('testOther', testType, {
      attributes: {
        internalId: '1',
      },
      [CUSTOM_FIELD_LIST]: {
        [PLATFORM_CORE_CUSTOM_FIELD]: [customField1, customField2],
      },
    })

    const instanceWithoutOneField = expect.objectContaining({
      record: [
        expect.objectContaining({
          [`pre:${CUSTOM_FIELD_LIST}`]: {
            [PLATFORM_CORE_CUSTOM_FIELD]: [
              {
                attributes: expect.objectContaining({
                  scriptId: customField2.attributes[SOAP_SCRIPT_ID],
                }),
              },
            ],
          },
        }),
      ],
    })
    const instanceWithoutBothFields = expect.objectContaining({
      record: [
        expect.not.objectContaining({
          [`pre:${CUSTOM_FIELD_LIST}`]: expect.objectContaining({}),
        }),
      ],
    })

    let instance: InstanceElement
    beforeEach(() => {
      instance = originalInstance.clone()
    })

    it('Should redeploy with success when updating instances that failed to deploy an uneditable locked element', async () => {
      updateListAsyncMock
        .mockResolvedValueOnce([writeResponseListError1])
        .mockResolvedValueOnce([writeResponseListSuccess])

      expect(await client.updateInstances([instance], elementsSource.has)).toEqual([1])
      expect(updateListAsyncMock).toHaveBeenCalledTimes(2)
      expect(updateListAsyncMock).toHaveBeenNthCalledWith(2, instanceWithoutOneField)
    })

    it('Should redeploy with success when adding instances that failed to deploy an uneditable locked element', async () => {
      addListAsyncMock
        .mockResolvedValueOnce([writeResponseListError1])
        .mockResolvedValueOnce([writeResponseListSuccess])

      expect(await client.addInstances([instance], elementsSource.has)).toEqual([1])
      expect(addListAsyncMock).toHaveBeenCalledTimes(2)
      expect(addListAsyncMock).toHaveBeenNthCalledWith(2, instanceWithoutOneField)
    })

    it('Should redeploy with success when updating instances that failed to deploy several uneditable locked elements', async () => {
      updateListAsyncMock
        .mockResolvedValueOnce([writeResponseListError1])
        .mockResolvedValueOnce([writeResponseListError2])
        .mockResolvedValueOnce([writeResponseListSuccess])

      expect(await client.updateInstances([instance], elementsSource.has)).toEqual([1])
      expect(updateListAsyncMock).toHaveBeenCalledTimes(3)
      expect(updateListAsyncMock).toHaveBeenNthCalledWith(2, instanceWithoutOneField)
      expect(updateListAsyncMock).toHaveBeenNthCalledWith(3, instanceWithoutBothFields)
    })

    it('Should deploy at most 6 times - 1 original + 5 redeploys', async () => {
      updateListAsyncMock.mockResolvedValue([writeResponseListError1])
      jest.spyOn(filterUneditableLockedFieldModule, 'removeUneditableLockedField').mockResolvedValue(true)

      expect(await client.updateInstances([instance], elementsSource.has)).toEqual([
        new Error(
          `SOAP api call updateList for instance ${instance.elemID.getFullName()} failed.` +
            ` error code: ${INSUFFICIENT_PERMISSION_ERROR}, error message: ${errorMessage1}`,
        ),
      ])
      expect(updateListAsyncMock).toHaveBeenCalledTimes(6)
    })
  })

  describe('soap timeout', () => {
    it('should throw PromiseTimedOutError when the operation exceeds the timeout', async () => {
      ;(promises.timeout.withTimeout as jest.Mock).mockRestore()
      updateListAsyncMock.mockImplementation(async () => {
        await promises.timeout.sleep(30)
        return []
      })
      const timeout = 20
      client = new SoapClient(
        {
          accountId: 'ACCOUNT_ID',
          suiteAppTokenId: 'tokenId',
          suiteAppTokenSecret: 'tokenSecret',
        },
        fn => fn(),
        (_type: string, count: number) => count > 1,
        timeout,
      )
      await expect(client.updateFileCabinetInstances([])).rejects.toThrow(`Promise timed out after ${timeout} ms`)
    })
  })
})
