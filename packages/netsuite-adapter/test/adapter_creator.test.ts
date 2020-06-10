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
import { adapter } from '../src/adapter_creator'
import NetsuiteClient from '../src/client/client'

jest.mock('../src/client/client')

describe('NetsuiteAdapter creator', () => {
  const credentials = new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.credentialsType,
    {
      accountId: 'foo',
      tokenId: 'bar',
      tokenSecret: 'secret',
    },
  )
  describe('validateCredentials', () => {
    beforeEach(async () => {
      await adapter.validateCredentials(credentials)
    })

    it('should call validateCredentials with the correct credentials', async () => {
      expect(NetsuiteClient.validateCredentials).toHaveBeenCalledWith(credentials.value)
    })
  })

  describe('client creation', () => {
    it('should create the client correctly', () => {
      adapter.operations({ credentials })
      expect(NetsuiteClient).toHaveBeenCalledWith({
        credentials: credentials.value,
      })
    })
  })
})
