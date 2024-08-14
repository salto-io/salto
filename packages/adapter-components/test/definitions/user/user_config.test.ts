/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, InstanceElement, Values } from '@salto-io/adapter-api'
import { UserConfig, createUserConfigType, mergeWithDefaultConfig } from '../../../src/definitions/user'
import { adapterConfigFromConfig } from '../../../src/definitions/user/user_config'

describe('config_shared', () => {
  describe('createUserConfigType', () => {
    it('should return default type when no custom fields were added', () => {
      const type = createUserConfigType({ adapterName: 'myAdapter' })
      expect(Object.keys(type.fields)).toHaveLength(3)
      expect(type.fields.client).toBeDefined()
      expect(type.fields.fetch).toBeDefined()
      expect(type.fields.deploy).toBeDefined()
    })
    it('should add custom fields', () => {
      const type = createUserConfigType({
        adapterName: 'myAdapter',
        additionalFields: { extra: { refType: BuiltinTypes.BOOLEAN } },
      })
      expect(Object.keys(type.fields)).toHaveLength(4)
      expect(type.fields.client).toBeDefined()
      expect(type.fields.fetch).toBeDefined()
      expect(type.fields.deploy).toBeDefined()
      expect(type.fields.extra).toBeDefined()
    })
  })
  describe('mergeWithDefaultConfig', () => {
    let defaultConfig: Values
    let config: Values
    let mergedConfig: Values
    beforeAll(() => {
      defaultConfig = {
        a: 1,
        b: {
          c: 2,
          d: [3, 4],
          e: '5',
        },
      }
      config = {
        a: 2,
        b: {
          c: 3,
          d: [5],
        },
      }

      mergedConfig = mergeWithDefaultConfig(defaultConfig, config)
    })

    it('should merge config with default config', () => {
      expect(mergedConfig).toEqual({
        a: 2,
        b: {
          c: 3,
          d: [5],
          e: '5',
        },
      })
    })

    it('input should be affected', () => {
      expect(defaultConfig).not.toEqual(mergedConfig)
    })
    it('should handle single config', () => {
      mergedConfig = mergeWithDefaultConfig(defaultConfig)
      expect(mergedConfig).toEqual(defaultConfig)
    })
  })
  describe('adapterConfigFromConfig', () => {
    const customConfig: UserConfig<string> & {
      fetch: UserConfig['fetch'] & { customFlag: boolean }
      topLevelProp: string
    } = {
      client: {
        rateLimit: {
          get: 10,
          deploy: 20,
        },
      },
      fetch: {
        include: [{ type: '.*' }],
        exclude: [],
        customFlag: true,
      },
      deploy: {},
      topLevelProp: 'val',
    }
    const customConfigType = createUserConfigType({
      adapterName: 'myAdapter',
      additionalFields: { topLevelProp: { refType: BuiltinTypes.STRING } },
      additionalFetchFields: { customFlag: { refType: BuiltinTypes.BOOLEAN } },
      defaultConfig: customConfig,
      omitElemID: true,
    })
    it('should return default config when no config provided', () => {
      const userConfig = new InstanceElement('config', customConfigType, {})

      const mergedConfig = adapterConfigFromConfig(userConfig, customConfig)
      expect(mergedConfig).toEqual(customConfig)
    })
    it('should return the merged config', () => {
      const userConfig = new InstanceElement('config', customConfigType, {
        fetch: {
          include: [{ type: '.*' }],
          exclude: [{ type: 'Type' }],
        },
        client: {
          rateLimit: { get: 20 },
        },
      })

      const mergedConfig = adapterConfigFromConfig(userConfig, customConfig)
      expect(mergedConfig).toEqual({
        client: {
          rateLimit: {
            get: 20,
            deploy: 20,
          },
        },
        fetch: {
          include: [{ type: '.*' }],
          exclude: [{ type: 'Type' }],
          customFlag: true,
        },
        deploy: {},
        topLevelProp: 'val',
      })
    })
  })
})
