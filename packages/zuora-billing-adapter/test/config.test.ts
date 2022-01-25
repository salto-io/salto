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

import { getUpdatedConfig, FETCH_CONFIG, DEFAULT_INCLUDE_TYPES, DEFAULT_SETTINGS_INCLUDE_TYPES, API_DEFINITIONS_CONFIG, DEFAULT_API_DEFINITIONS } from '../src/config'

describe('config', () => {
  describe('getUpdatedConfig', () => {
    it('should not update the config when Settings_Gateway config is correct', () => {
      expect(getUpdatedConfig({
        [FETCH_CONFIG]: {
          includeTypes: DEFAULT_INCLUDE_TYPES,
          settingsIncludeTypes: DEFAULT_SETTINGS_INCLUDE_TYPES,
        },
        [API_DEFINITIONS_CONFIG]: DEFAULT_API_DEFINITIONS,
      })).toBeUndefined()
    })
    it('should update the config when the ', () => {
      const initialConfig = {
        [FETCH_CONFIG]: {
          includeTypes: DEFAULT_INCLUDE_TYPES,
          settingsIncludeTypes: DEFAULT_SETTINGS_INCLUDE_TYPES,
        },
        [API_DEFINITIONS_CONFIG]: {
          swagger: {
            url: 'http://localhost:1234',
          },
          typeDefaults: {
            transformation: {
              idFields: ['a', 'b'],
            },
          },
          types: {
            aaa: {
              transformation: {
                idFields: ['a', 'b'],
              },
            },
          },
        },
      }
      const res = getUpdatedConfig(initialConfig)
      expect(res).toBeDefined()
      expect(res?.message).toEqual('Fixing system configuration for the following types: Settings_Gateway')
      expect(res?.config).toHaveLength(1)
      expect(res?.config[0].value).toEqual({
        fetch: initialConfig[FETCH_CONFIG],
        apiDefinitions: {
          swagger: initialConfig[API_DEFINITIONS_CONFIG].swagger,
          typeDefaults: initialConfig[API_DEFINITIONS_CONFIG].typeDefaults,
          types: {
            aaa: {
              transformation: {
                idFields: ['a', 'b'],
              },
            },
            Settings_Gateway: {
              transformation: {
                idFields: ['gatewayName'],
              },
            },
          },
        },
      })
    })
  })
})
