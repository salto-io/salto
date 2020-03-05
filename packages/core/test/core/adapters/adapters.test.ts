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
import { creator } from '@salto-io/salesforce-adapter'
import { initAdapters, getAdaptersCredentialsTypes } from '../../../src/core/adapters/adapters'

describe('adapters.ts', () => {
  const { credentialsType } = creator
  const services = ['salesforce']

  describe('run get adapters config statuses', () => {
    let credentials: Record<string, ObjectType>

    it('should return config for defined adapter', () => {
      credentials = getAdaptersCredentialsTypes(services)
      expect(credentials.salesforce).toEqual(credentialsType)
    })

    it('should return undefined for non defined adapter', () => {
      credentials = getAdaptersCredentialsTypes(services.concat('fake'))
      expect(credentials.salesforce).toEqual(credentialsType)
      expect(credentials.fake).toBeUndefined()
    })
  })

  it('should return adapter when config is defined', () => {
    const sfConfig = new InstanceElement(
      ElemID.CONFIG_NAME,
      credentialsType,
      {
        username: 'bpuser',
        password: 'bppass',
        token: 'bptoken',
        sandbox: false,
      }
    )
    const adapters = initAdapters({ salesforce: { credentials: sfConfig, config: undefined } })
    expect(adapters.salesforce).toBeDefined()
  })

  it('should throw error when no proper config exists', async () => {
    const credentials: InstanceElement | undefined = undefined
    expect(() => initAdapters(
      { [services[0]]: { credentials: (credentials as unknown as InstanceElement) } }
    ))
      .toThrow()
  })
})
