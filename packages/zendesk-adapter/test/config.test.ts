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

import { InstanceElement } from '@salto-io/adapter-api'
import {
  API_DEFINITIONS_CONFIG,
  configType,
  DEFAULT_CONFIG,
  FETCH_CONFIG,
  migrateOmitInactiveConfig,
} from '../src/config'

describe('config', () => {
  const baseConfig = new InstanceElement('config', configType, {
    ...DEFAULT_CONFIG,
    [FETCH_CONFIG]: {
      include: [
        {
          type: '.*',
        },
      ],
      exclude: [],
    },
  })
  describe('migrateOmitInactiveConfig', () => {
    describe('when the omitInactive is already exists in the new format', () => {
      it('should not change the config', () => {
        const config = baseConfig.clone()
        config.value[FETCH_CONFIG].omitInactive = {
          default: true,
          customizations: {},
        }
        const updatedConfig = migrateOmitInactiveConfig(config, { config: [config], message: 'test' })
        expect(updatedConfig?.config[0]).toEqual(config)
      })
    })
    describe('when there is no omitInactive in the api definitions', () => {
      it('should not change the config', () => {
        const updatedConfig = migrateOmitInactiveConfig(baseConfig, { config: [baseConfig], message: 'test' })
        expect(updatedConfig?.config[0]).toEqual(baseConfig)
      })
    })
    describe('when we migrate the omitInactive from the api definitions to the fetch config', () => {
      let updatedConfig: { config: InstanceElement[]; message: string } | undefined
      beforeAll(() => {
        const config = baseConfig.clone()
        config.value[API_DEFINITIONS_CONFIG].typeDefaults.transformation = { omitInactive: false }
        updatedConfig = migrateOmitInactiveConfig(config, { config: [config], message: 'test' })
      })
      it('should add the omitInactive to the fetch config', () => {
        const fetchConfig = updatedConfig?.config[0].value[FETCH_CONFIG]
        expect(fetchConfig.omitInactive).toEqual({
          default: false,
          customizations: {},
        })
      })
      it('should remove the omitInactive from the api definitions', () => {
        expect(
          updatedConfig?.config[0].value[API_DEFINITIONS_CONFIG].typeDefaults.transformation.omitInactive,
        ).toBeUndefined()
      })
    })
  })
})
