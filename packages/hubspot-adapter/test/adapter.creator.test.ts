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
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import HubspotClient from '../src/client/client'
import { defaultCredentialsType, adapter } from '../src/adapter_creator'

jest.mock('../src/client/client')

describe('HubspotAdapter creator', () => {
  describe('when validateCredentials is called', () => {
    const config = new InstanceElement(
      ElemID.CONFIG_NAME,
      defaultCredentialsType,
      {
        apiKey: 'myKey',
      }
    )

    beforeEach(() => {
      adapter.validateCredentials(config)
    })

    it('should call validateCredentials with the correct credentials', () => {
      const credentials = {
        apiKey: 'myKey',
      }
      expect(HubspotClient.validateCredentials).toHaveBeenCalledWith(credentials)
    })
  })

  describe('when passed a config element', () => {
    const credentials = new InstanceElement(
      ElemID.CONFIG_NAME,
      defaultCredentialsType,
      {
        apiKey: 'myApiKey',
      }
    )

    beforeEach(() => {
      adapter.operations({ credentials, elementsSource: buildElementsSourceFromElements([]) })
    })

    it('creates the client correctly', () => {
      expect(HubspotClient).toHaveBeenCalledWith({
        credentials: {
          apiKey: 'myApiKey',
        },
      })
    })
  })
})
