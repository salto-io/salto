/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { configType } from '../src/config/config'
import { getConfig, configCreator, optionsType, getOptionsType, configContextType } from '../src/config_creator'
import { createEmptyType } from './utils'

describe('config creator', () => {
  let options: InstanceElement
  beforeEach(async () => {
    options = new InstanceElement('instance', optionsType, {
      enableScriptRunnerAddon: true,
      enableJSM: true,
    })
  })
  it('should return config creator', async () => {
    const config = configCreator
    expect(config).toEqual({
      configContextType,
      getOptionsType,
      getConfig,
    })
  })
  it('getOptionsType should return jiraDataCenterOptionsType when isDataCenter is true', async () => {
    const configContext = new InstanceElement('instance', configContextType, { isDataCenter: true })
    options.value = getOptionsType(configContext)
    expect(options.value.fields.enableScriptRunnerAddon).toBeDefined()
    expect(options.value.fields.enableJSM).toBeUndefined()
  })
  it('should return default optionsType when isDataCenter is false (jira Cloud)', async () => {
    const configContext = new InstanceElement('instance', configContextType, { isDataCenter: false })
    options.value = getOptionsType(configContext)
    expect(options.value.fields.enableScriptRunnerAddon).toBeDefined()
    expect(options.value.fields.enableJSM).toBeDefined()
  })
  it('get config should return default config', async () => {
    const config = await getConfig()
    expect(config).toEqual(await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType))
  })
  it('get config should return default config when all options are false', async () => {
    options.value.enableScriptRunnerAddon = false
    options.value.enableJSM = false
    const config = await getConfig(options)
    expect(config).toEqual(await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType))
  })
  it('get config should return default config when wrong type', async () => {
    options = new InstanceElement('instance', createEmptyType('empty'), {
      enableScriptRunnerAddon: true,
      enableJSM: true,
    })
    const config = await getConfig(options)
    expect(config).toEqual(await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType))
  })
  it('get config should return correctly when enableScriptRunnerAddon is true', async () => {
    const config = await getConfig(options)
    expect(config.value.fetch.enableScriptRunnerAddon).toBeTrue()
    expect(config.value.fetch.enableJSM).toBeTrue()
    expect(config.value.fetch.enableJSMPremium).toBeTrue()
  })
  it('get config should return correctly when enableJSM is true', async () => {
    const config = await getConfig(options)
    expect(config.value.fetch.enableJSM).toBeTrue()
  })
})
