/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { InstanceElement, ElemID, AdapterAuthentication, ObjectType, AdapterOperationsContext, Adapter } from '@salto-io/adapter-api'
import * as utils from '@salto-io/adapter-utils'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { adapter } from '@salto-io/salesforce-adapter'
import { mockFunction } from '@salto-io/test-utils'
import _ from 'lodash'
import {
  initAdapters, getAdaptersCredentialsTypes, getAdaptersCreatorConfigs,
  getDefaultAdapterConfig,
  adapterCreators,
  getAdaptersConfigTypesMap,
} from '../../../src/core/adapters'

jest.mock('@salto-io/workspace', () => ({
  ...jest.requireActual<{}>('@salto-io/workspace'),
  configSource: jest.fn(),
}))

const createDefaultInstanceFromTypeMock = jest.fn()
jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  createDefaultInstanceFromType: jest.fn((...args) => createDefaultInstanceFromTypeMock(...args)),
}))

jest.mock('../../../src/core/adapters/creators', () => {
  const actual = jest.requireActual('../../../src/core/adapters/creators')
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      mockAdapter: {
        configType: undefined,
        getDefaultConfig: undefined,
      },
    },
  }
})
describe('adapters.ts', () => {
  const { authenticationMethods } = adapter
  const accounts = ['salesforce']
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
      credentials = getAdaptersCredentialsTypes(accounts)
      expect(credentials.salesforce).toEqual(authenticationMethods)
    })

    it('should throw error for non defined adapter', () => {
      expect(() => getAdaptersCredentialsTypes(accounts.concat('fake'))).toThrow()
    })
  })

  describe('getDefaultAdapterConfig', () => {
    const { mockAdapter } = adapterCreators
    beforeEach(() => {
      const mockConfigType = new ObjectType({
        elemID: new ElemID('mockAdapter', ElemID.CONFIG_NAME),
      })

      _.assign(mockAdapter, {
        configType: mockConfigType,
        configOpt: {
          getConfig: mockFunction<NonNullable<Adapter['configOpt']>['getConfig']>()
            .mockResolvedValue(new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, { val: 'bbb' })),
          configOptObjectType: new ObjectType({
            elemID: new ElemID('test'),
          }),
        },
      })

      createDefaultInstanceFromTypeMock.mockResolvedValue(new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, { val: 'aaa' }))
    })

    afterAll(() => {
      createDefaultInstanceFromTypeMock.mockReset()
    })

    it('should call createDefaultInstanceFromType when configOpt is undefined', async () => {
      delete mockAdapter.configOpt
      const defaultConfigs = await getDefaultAdapterConfig('mockAdapter', 'mockAdapter')
      expect(createDefaultInstanceFromType).toHaveBeenCalled()
      expect(defaultConfigs).toHaveLength(1)
      expect(defaultConfigs?.[0].value).toEqual({ val: 'aaa' })
    })
    it('should use getConfig when configOpt is defined', async () => {
      const mockObjType = new ObjectType({
        elemID: new ElemID('test'),
      })
      const mockConfigOpt = new InstanceElement('test', mockObjType)
      const defaultConfigs = await getDefaultAdapterConfig('mockAdapter', 'mockAdapter', mockConfigOpt)
      expect(mockAdapter.configOpt?.getConfig)
        .toHaveBeenCalledWith(mockConfigOpt)
      expect(defaultConfigs).toHaveLength(1)
      expect(defaultConfigs?.[0].value).toEqual({ val: 'bbb' })
    })
  })

  describe('getAdaptersConfigTypes', () => {
    const mockConfigSubType = new ObjectType({
      elemID: new ElemID('mockAdapter', ElemID.CONFIG_NAME),
    })
    const mockConfigType = new ObjectType({
      elemID: new ElemID('mockAdapter', ElemID.CONFIG_NAME),
      fields: {
        a: { refType: mockConfigSubType },
      },
    })

    beforeEach(() => {
      const { mockAdapter } = adapterCreators
      _.assign(mockAdapter, {
        configType: mockConfigType,
      })
    })

    it('should return the config type and its sub-types', async () => {
      const types = await getAdaptersConfigTypesMap()
      expect(types.mockAdapter).toContain(mockConfigType)
      expect(types.mockAdapter).toContain(mockConfigSubType)
    })
  })

  describe('run get adapters creator configs', () => {
    const serviceName = 'salesforce'
    const objectType = new ObjectType({ elemID: new ElemID(serviceName, 'type1') })
    const d1Type = new ObjectType({ elemID: new ElemID('d1', 'type2') })
    beforeEach(() => {
      createDefaultInstanceFromTypeMock.mockResolvedValue([])
    })
    it('should return default adapter config when there is no config', async () => {
      const result = await getAdaptersCreatorConfigs(
        [serviceName],
        { [sfConfig.elemID.adapter]: sfConfig },
        async () => undefined,
        buildElementsSourceFromElements([]),
        { [serviceName]: serviceName }
      )
      expect(result[serviceName]).toEqual(
        expect.objectContaining({
          credentials: sfConfig,
          config: undefined,
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
        { [serviceName]: serviceName },
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

    let result: Record<string, AdapterOperationsContext>
    describe('multi app adapter config', () => {
      beforeEach(async () => {
        result = await getAdaptersCreatorConfigs(
          [serviceName, 'd1'],
          { [sfConfig.elemID.adapter]: sfConfig },
          async name => (name === sfConfig.elemID.adapter ? sfConfig : undefined),
          buildElementsSourceFromElements([
            objectType,
            d1Type,
          ]),
          { [serviceName]: serviceName, d1: 'dummy' },
        )
      })

      it('should only return elements that belong to the relevant account', async () => {
        const elementsSource = result[serviceName]?.elementsSource
        expect(elementsSource).toBeDefined()
        expect(await elementsSource.has(objectType.elemID)).toBeTruthy()
        expect(await elementsSource.has(new ElemID('d1', 'type2'))).toBeFalsy()
        expect(await elementsSource.has(new ElemID('dummy', 'type2'))).toBeFalsy()


        expect(await elementsSource.get(objectType.elemID)).toBeDefined()
        expect(await elementsSource.get(new ElemID('d1', 'type2'))).toBeUndefined()
        expect(await elementsSource.get(new ElemID('dummy', 'type2'))).toBeUndefined()

        expect(await collections.asynciterable.toArrayAsync(await elementsSource.getAll()))
          .toEqual([objectType])

        expect(await collections.asynciterable.toArrayAsync(await elementsSource.list()))
          .toEqual([objectType.elemID])
      })

      it('should return renamed elements when account name is different from adapter name', async () => {
        const d1ElementsSource = result.d1?.elementsSource
        // since element source is used inside the adapter, it should receive and return
        // values with default adapter name as account name
        expect(await d1ElementsSource.get(new ElemID('dummy', 'type2'))).toEqual(new ObjectType({
          elemID: new ElemID('dummy', 'type2'),
        }))
      })

      it('should not modify elements in the origin elements source', async () => {
        const d1ElementsSource = result.d1?.elementsSource
        await d1ElementsSource.get(new ElemID('dummy', 'type2'))
        expect(d1Type).not.toEqual(new ObjectType({
          elemID: new ElemID('dummy', 'type2'),
        }))
      })
    })
  })

  describe('init adapter', () => {
    it('should return adapter when config is defined', () => {
      const adapters = initAdapters(
        {
          salesforce: {
            credentials: sfConfig,
            config: undefined,
            elementsSource: utils.buildElementsSourceFromElements([]),
          },
        },
        { salesforce: 'salesforce' },
      )
      expect(adapters.salesforce).toBeDefined()
    })

    it('should throw an error when no proper config exists', async () => {
      const credentials: InstanceElement | undefined = undefined
      expect(() => initAdapters(
        {
          [accounts[0]]: {
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
