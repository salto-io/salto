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
import { InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { adapter } from '../src/adapter_creator'
import SalesforceClient, { validateCredentials } from '../src/client/client'
import SalesforceAdapter from '../src/adapter'

jest.mock('../src/client/client')
jest.mock('../src/adapter')

describe('SalesforceAdapter creator', () => {
  const credentials = new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.credentialsType,
    {
      username: 'myUser',
      password: 'myPassword',
      token: 'myToken',
      sandbox: false,
    }
  )
  const config = new InstanceElement(
    ElemID.CONFIG_NAME,
    adapter.configType as ObjectType,
    {
      metadataTypesSkippedList: ['test1'],
      instancesRegexSkippedList: ['test3', 'test2'],
      notExist: ['not exist'],
    }
  )
  describe('when validateCredentials is called', () => {
    beforeEach(() => {
      adapter.validateCredentials(credentials)
    })

    it('should call validateCredentials with the correct credentials', () => {
      expect(validateCredentials).toHaveBeenCalledWith({
        username: 'myUser',
        password: 'myPassword',
        apiToken: 'myToken',
        isSandbox: false,
      })
    })
  })

  describe('when passed config elements', () => {
    it('creates the client correctly', () => {
      adapter.operations({ credentials, config })
      expect(SalesforceClient).toHaveBeenCalledWith({
        credentials: {
          username: 'myUser',
          password: 'myPassword',
          apiToken: 'myToken',
          isSandbox: false,
        },
      })
    })

    it('creates the adapter correctly', () => {
      adapter.operations({ credentials, config })
      expect(SalesforceAdapter).toHaveBeenCalledWith({
        config: {
          metadataTypesSkippedList: ['test1'],
          instancesRegexSkippedList: ['test3', 'test2'],
        },
        client: expect.any(Object),
        getElemIdFunc: undefined,
      })
    })

    it('should throw an error when creating the adapter with an invalid regex for instancesRegexSkippedList', () => {
      const invalidConfig = new InstanceElement(
        ElemID.CONFIG_NAME,
        adapter.configType as ObjectType,
        { instancesRegexSkippedList: ['\\'] },
      )
      expect(() => adapter.operations({ credentials, config: invalidConfig })).toThrow()
    })
  })
})
