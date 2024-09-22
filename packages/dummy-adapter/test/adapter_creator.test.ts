/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, InstanceElement, ConfigCreator, ElemID } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { defaultParams, DUMMY_ADAPTER } from '../src/generator'
import DummyAdapter from '../src/adapter'

describe('adapter creator', () => {
  it('should return a config containing all of the generator params', () => {
    const config = adapter.configType as ObjectType
    expect(Object.keys(config?.fields)).toEqual([
      ...Object.keys(defaultParams),
      'changeErrors',
      'extraNaclPaths',
      'generateEnvName',
      'fieldsToOmitOnDeploy',
      'elementsToExclude',
      'fetchErrors',
    ])
  })
  it('should return an empty creds type', () => {
    expect(Object.keys(adapter.authenticationMethods.basic.credentialsType.fields)).toHaveLength(0)
  })
  it('should have a credential validator that does nothing and return an empty id', async () => {
    expect(
      await adapter.validateCredentials(
        new InstanceElement(DUMMY_ADAPTER, adapter.authenticationMethods.basic.credentialsType),
      ),
    ).toEqual({ accountId: '' })
  })
  it('should return the dummy adapter', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(DUMMY_ADAPTER, adapter.authenticationMethods.basic.credentialsType),
        config: new InstanceElement(DUMMY_ADAPTER, adapter.configType as ObjectType, defaultParams),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeInstanceOf(DummyAdapter)
  })

  describe('configCreator', () => {
    it('should return the default config regardless of input', async () => {
      const creator = adapter.configCreator as ConfigCreator
      expect(creator).toBeDefined()
      const defaultConfig = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, adapter.configType as ObjectType)
      const createdConfig = await creator.getConfig(new InstanceElement('input', creator.optionsType, {}))
      expect(createdConfig).toEqual(defaultConfig)
    })
  })
})
