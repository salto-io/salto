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
import * as utils from '@salto-io/adapter-utils'
import { adapter } from '@salto-io/salesforce-adapter'
import {
  initAdapters, getAdaptersCredentialsTypes, getAdaptersCreatorConfigs, getDefaultAdapterConfig,
} from '../../../src/core/adapters/adapters'

jest.mock('../../../src/workspace/config_source')
jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual('@salto-io/adapter-utils'),
  createDefaultInstanceFromType: jest.fn(),
}))

describe('adapters.ts', () => {
  const { credentialsType } = adapter
  const services = ['salesforce']
  const sfConfig = new InstanceElement(
    ElemID.CONFIG_NAME,
    credentialsType,
    {
      username: 'nacluser',
      password: 'naclpass',
      token: 'nacltoken',
      sandbox: false,
    }
  )

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

  describe('getDefaultAdapterConfig', () => {
    it('should call createDefaultInstanceFromType', () => {
      getDefaultAdapterConfig('salesforce')
      expect(utils.createDefaultInstanceFromType).toHaveBeenCalled()
    })
  })

  describe('run get adapters creator configs', () => {
    const serviceName = 'salesforce'

    it('should return default adapter config when there is no config', async () => {
      const result = await getAdaptersCreatorConfigs(
        [serviceName],
        { [sfConfig.elemID.adapter]: sfConfig },
        {}
      )
      expect(result).toEqual({
        [serviceName]: {
          credentials: sfConfig,
          config: getDefaultAdapterConfig(serviceName),
          getElemIdFunc: undefined,
        },
      })
    })

    it('should return adapter config when there is config', async () => {
      const result = await getAdaptersCreatorConfigs(
        [serviceName],
        { [sfConfig.elemID.adapter]: sfConfig },
        { [sfConfig.elemID.adapter]: sfConfig },
      )
      expect(result).toEqual({
        [serviceName]: {
          credentials: sfConfig,
          config: sfConfig,
          getElemIdFunc: undefined,
        },
      })
    })
  })

  describe('init adapter', () => {
    it('should return adapter when config is defined', () => {
      const adapters = initAdapters({ salesforce: { credentials: sfConfig, config: undefined } })
      expect(adapters.salesforce).toBeDefined()
    })

    it('should throw an error when no proper config exists', async () => {
      const credentials: InstanceElement | undefined = undefined
      expect(() => initAdapters(
        { [services[0]]: { credentials: (credentials as unknown as InstanceElement) } }
      )).toThrow()
    })

    it('should throw an error when no proper creator exists', async () => {
      expect(() => initAdapters(
        { notExist: { credentials: sfConfig } }
      )).toThrow()
    })
  })
})
