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
import { InstanceElement, ElemID, AdapterAuthentication, ObjectType } from '@salto-io/adapter-api'
import * as utils from '@salto-io/adapter-utils'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { adapter } from '@salto-io/salesforce-adapter'
import {
  initAdapters, getAdaptersCredentialsTypes, getAdaptersCreatorConfigs,
  getDefaultAdapterConfig,
} from '../../../src/core/adapters'

jest.mock('@salto-io/workspace', () => ({
  ...jest.requireActual<{}>('@salto-io/workspace'),
  configSource: jest.fn(),
}))
jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  createDefaultInstanceFromType: jest.fn(),
}))

describe('adapters.ts', () => {
  const { authenticationMethods } = adapter
  const services = ['salesforce']
  const sfConfig = new InstanceElement(
    ElemID.CONFIG_NAME,
    authenticationMethods.basic.credentialsType,
    {
      username: 'nacluser',
      password: 'naclpass',
      token: 'nacltoken',
      sandbox: false,
    }
  )

  describe('run get adapters config statuses', () => {
    let credentials: Record<string, AdapterAuthentication>

    it('should return config for defined adapter', () => {
      credentials = getAdaptersCredentialsTypes(services)
      expect(credentials.salesforce).toEqual(authenticationMethods)
    })

    it('should throw error for non defined adapter', () => {
      expect(() => getAdaptersCredentialsTypes(services.concat('fake'))).toThrow()
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
        async () => undefined,
        buildElementsSourceFromElements([])
      )
      expect(result[serviceName]).toEqual(
        expect.objectContaining({
          credentials: sfConfig,
          config: getDefaultAdapterConfig(serviceName),
          getElemIdFunc: undefined,
        })
      )
      expect(Object.keys(result)).toEqual([serviceName])
    })

    it('should return adapter config when there is config', async () => {
      const result = await getAdaptersCreatorConfigs(
        [serviceName],
        { [sfConfig.elemID.adapter]: sfConfig },
        async name => (name === sfConfig.elemID.adapter ? sfConfig : undefined),
        buildElementsSourceFromElements([]),
      )
      expect(result[serviceName]).toEqual(
        expect.objectContaining({
          credentials: sfConfig,
          config: sfConfig,
          getElemIdFunc: undefined,
        })
      )
      expect(Object.keys(result)).toEqual([serviceName])
    })

    it('should return an ReadOnlyElementsSource with only the adapter elements', async () => {
      const objectType = new ObjectType({ elemID: new ElemID(serviceName, 'type1') })
      const result = await getAdaptersCreatorConfigs(
        [serviceName],
        { [sfConfig.elemID.adapter]: sfConfig },
        async name => (name === sfConfig.elemID.adapter ? sfConfig : undefined),
        buildElementsSourceFromElements([
          new ObjectType({ elemID: new ElemID(serviceName, 'type1') }),
          new ObjectType({ elemID: new ElemID('dummy', 'type2') }),
        ]),
      )
      const elementsSource = result[serviceName]?.elementsSource
      expect(elementsSource).toBeDefined()
      expect(await elementsSource.has(objectType.elemID)).toBeTruthy()
      expect(await elementsSource.has(new ElemID('dummy', 'type2'))).toBeFalsy()

      expect(await elementsSource.get(objectType.elemID)).toBeDefined()
      expect(await elementsSource.get(new ElemID('dummy', 'type2'))).toBeUndefined()

      expect(await collections.asynciterable.toArrayAsync(await elementsSource.getAll()))
        .toEqual([objectType])

      expect(await collections.asynciterable.toArrayAsync(await elementsSource.list()))
        .toEqual([objectType.elemID])
    })
  })

  describe('init adapter', () => {
    it('should return adapter when config is defined', () => {
      const adapters = initAdapters({
        salesforce: {
          credentials: sfConfig,
          config: undefined,
          elementsSource: utils.buildElementsSourceFromElements([]),
        },
      })
      expect(adapters.salesforce).toBeDefined()
    })

    it('should throw an error when no proper config exists', async () => {
      const credentials: InstanceElement | undefined = undefined
      expect(() => initAdapters(
        {
          [services[0]]: {
            credentials: (credentials as unknown as InstanceElement),
            elementsSource: utils.buildElementsSourceFromElements([]),
          },
        }
      )).toThrow()
    })

    it('should throw an error when no proper creator exists', async () => {
      expect(() => initAdapters(
        {
          notExist: {
            credentials: sfConfig,
            elementsSource: utils.buildElementsSourceFromElements([]),
          },
        }
      )).toThrow()
    })
  })
})
