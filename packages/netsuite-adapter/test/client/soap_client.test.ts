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
import axios from 'axios'
import { ReadFileError } from '../../src/client/suiteapp_client/errors'
import SoapClient from '../../src/client/suiteapp_client/soap_client/soap_client'
import { ADD_FILE_CABINET_ERROR_RESPONSE, ADD_FILE_CABINET_INVALID_RESPONSE, ADD_FILE_CABINET_SUCCESS_RESPONSE, READ_FAILURE_RESPONSE, READ_INVALID_RESPONSE, READ_SUCCESS_RESPONSE, READ_SUCCESS_RESPONSE_NO_CONTENT, UPDATE_FILE_CABINET_ERROR_RESPONSE, UPDATE_FILE_CABINET_INVALID_RESPONSE, UPDATE_FILE_CABINET_SUCCESS_RESPONSE } from './soap_responses'


describe('soap_client', () => {
  const postMock = jest.spyOn(axios, 'post')
  let client: SoapClient

  beforeEach(() => {
    postMock.mockReset()
    client = new SoapClient(
      {
        accountId: 'ACCOUNT_ID',
        suiteAppTokenId: 'tokenId',
        suiteAppTokenSecret: 'tokenSecret',
      },
      fn => fn(),
    )
  })
  describe('readFile', () => {
    it('should return the content of a file', async () => {
      postMock.mockResolvedValue({
        data: READ_SUCCESS_RESPONSE,
      })
      expect(await client.readFile(1)).toEqual(Buffer.from('demo\n\n'))
    })

    it('no content should return the empty buffer', async () => {
      postMock.mockResolvedValue({
        data: READ_SUCCESS_RESPONSE_NO_CONTENT,
      })
      expect(await client.readFile(1)).toEqual(Buffer.from(''))
    })

    it('should throw an error when failed to read the file', async () => {
      postMock.mockResolvedValue({
        data: READ_FAILURE_RESPONSE,
      })
      await expect(client.readFile(1)).rejects.toThrow(ReadFileError)
    })

    it('should throw an error when got invalid response', async () => {
      postMock.mockResolvedValue({
        data: READ_INVALID_RESPONSE,
      })
      await expect(client.readFile(1)).rejects.toThrow(Error)
    })
  })
  describe('updateFileCabinet', () => {
    it('should return the id is success and the error if fails', async () => {
      postMock.mockResolvedValue({
        data: UPDATE_FILE_CABINET_SUCCESS_RESPONSE,
      })
      expect(await client.updateFileCabinet([
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
      postMock.mockResolvedValue({
        data: UPDATE_FILE_CABINET_ERROR_RESPONSE,
      })
      await expect(client.updateFileCabinet([
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
      postMock.mockResolvedValue({
        data: UPDATE_FILE_CABINET_INVALID_RESPONSE,
      })
      await expect(client.updateFileCabinet([
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
  })

  describe('addFileCabinetInstances', () => {
    it('should return the id is success and the error if fails', async () => {
      postMock.mockResolvedValue({
        data: ADD_FILE_CABINET_SUCCESS_RESPONSE,
      })
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
        new Error('SOAP api call to add file cabinet instance addedFile2 failed. error code: INVALID_KEY_OR_REF, error message: Invalid folder reference key -600.'),
      ])
    })

    it('should throw an error if request fails', async () => {
      postMock.mockResolvedValue({
        data: ADD_FILE_CABINET_ERROR_RESPONSE,
      })
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
      postMock.mockResolvedValue({
        data: ADD_FILE_CABINET_INVALID_RESPONSE,
      })
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
  })
})
