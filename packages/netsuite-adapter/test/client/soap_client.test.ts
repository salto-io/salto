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
import { READ_FAILURE_RESPONSE, READ_INVALID_RESPONSE, READ_SUCCESS_RESPONSE, READ_SUCCESS_RESPONSE_NO_CONTENT } from './soap_responses'


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
})
