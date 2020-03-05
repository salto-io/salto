/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { creator } from '../src/adapter_creator'
import NetsuiteClient from '../src/client/client'

jest.mock('../src/client/client')

describe('NetsuiteAdapter creator', () => {
  const credentials = new InstanceElement(
    ElemID.CONFIG_NAME,
    creator.credentialsType,
    {
      account: '123',
      consumerKey: 'aaa',
      consumerSecret: 'bbb',
      tokenId: 'ccc',
      tokenSecret: 'ddd',
    }
  )
  describe('validateConfig', () => {
    beforeEach(() => {
      creator.validateConfig(credentials)
    })

    it('should call validateCredentials with the correct credentials', async () => {
      // await creator.validateConfig(config)
      expect(NetsuiteClient.validateCredentials).toHaveBeenCalledWith(credentials.value)
    })
  })

  describe('client creation', () => {
    it('should create the client correctly', () => {
      creator.create({ credentials })
      expect(NetsuiteClient).toHaveBeenCalledWith({
        credentials: credentials.value,
      })
    })
  })
})
