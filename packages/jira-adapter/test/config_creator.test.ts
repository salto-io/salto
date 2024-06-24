/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { configType } from '../src/config/config'
import { getConfig, configCreator, optionsType } from '../src/config_creator'
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
      optionsType,
      getConfig,
    })
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
