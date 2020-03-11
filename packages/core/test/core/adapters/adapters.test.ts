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
import { initAdapters, getAdaptersCredentialsTypes,
  createDefaultAdapterConfig } from '../../../src/core/adapters/adapters'
import { configSource, ConfigSource } from '../../../src/workspace/config_source'
import { adapterCreators } from '../../../src/core/adapters'
import { createDefaultInstanceFromType } from '../../../src/core/merger/internal/instances'

jest.mock('../../../src/workspace/config_source')
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

  describe('create default adapter config', () => {
    const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID('test') }))
    const mockSet = jest.fn().mockImplementation()
    const mockGet = jest.fn().mockImplementation()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(instance)
    const mockConfigSource = (configSource as jest.Mock)
      .mockImplementation(() => ({ get: mockGet, set: mockSet }))
    const serviceName = 'salesforce'

    beforeEach(() => {
      mockSet.mockReset()
    })

    it('should set default adapter config if there is no adapter config file', async () => {
      const defaultConfig = createDefaultInstanceFromType(
        ElemID.CONFIG_NAME, adapterCreators[serviceName].configType as ObjectType,
      )
      expect(await createDefaultAdapterConfig(serviceName, mockConfigSource() as ConfigSource))
        .toEqual(defaultConfig)
      expect(mockSet).toHaveBeenCalledTimes(1)
      expect(mockSet).toHaveBeenCalledWith(serviceName, defaultConfig)
    })

    it('should not set default adapter config if there is adapter config file', async () => {
      expect(await createDefaultAdapterConfig(serviceName, mockConfigSource() as ConfigSource))
        .toEqual(instance)
      expect(mockSet).not.toHaveBeenCalled()
    })
  })
})
