/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { getConfig, configCreator, optionsType } from '../src/config_creator'
import { ENABLE_DEPLOY_SUPPORT_FLAG, configType } from '../src/user_config'
import { WORKATO } from '../src/constants'

describe('config creator', () => {
  let options: InstanceElement
  beforeEach(async () => {
    options = new InstanceElement('instance', optionsType(), { useCase: 'Deploy' })
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
  it('should return config with deploy disabled when provided usecase is Impact Analysis', async () => {
    options.value.useCase = 'Impact Analysis'
    const config = await getConfig(options)
    expect(config.value[ENABLE_DEPLOY_SUPPORT_FLAG]).toEqual(false)
  })
  it('should return config with deploy enabled when provided usecase is Deploy', async () => {
    options.value.useCase = 'Deploy'
    const config = await getConfig(options)
    expect(config.value[ENABLE_DEPLOY_SUPPORT_FLAG]).toEqual(true)
  })
  it('get config should return default config when provided with the wrong type', async () => {
    options = new InstanceElement('instance', new ObjectType({ elemID: new ElemID(WORKATO, 'Foo') }), {
      enableScripRunnerAddon: true,
    })
    const config = await getConfig(options)
    expect(config).toEqual(await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType))
  })
})
