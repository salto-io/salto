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

import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { getConfig, configCreator, optionsType } from '../src/config_creator'
import { ENABLE_DEPLOY_SUPPORT_FLAG, configType } from '../src/config'
import { WORKATO } from '../src/constants'

describe('config creator', () => {
  let options: InstanceElement
  beforeEach(async () => {
    options = new InstanceElement('instance', optionsType, { enableDeploy: true })
  })
  it('should return config creator', async () => {
    const config = configCreator
    expect(config).toEqual({
      optionsType,
      getConfig,
    })
  })
  it('should return default config when options are not provided', async () => {
    const config = await getConfig()
    expect(config).toEqual(await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType))
  })
  it('should return config with deploy disabled when enableDeploy option is false', async () => {
    options.value.enableDeploy = false
    const config = await getConfig(options)
    expect(config.value[ENABLE_DEPLOY_SUPPORT_FLAG]).toEqual(false)
  })
  it('should return config with deploy enabled when enableDeploy option is true', async () => {
    options.value.enableDeploy = true
    const config = await getConfig(options)
    expect(config.value[ENABLE_DEPLOY_SUPPORT_FLAG]).toEqual(true)
  })
  it('get config should return default config when wrong type', async () => {
    options = new InstanceElement('instance', new ObjectType({ elemID: new ElemID(WORKATO, 'Foo') }), {
      enableScripRunnerAddon: true,
    })
    const config = await getConfig(options)
    expect(config).toEqual(await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType))
  })
})
