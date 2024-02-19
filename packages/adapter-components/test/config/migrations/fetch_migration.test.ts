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
import { AdapterApiConfig } from '../../../src/config/shared'
import { migrateDeprecatedIncludeList } from '../../../src/config/config_migrations/fetch_migration'

describe('migrateDeprecatedIncludeList', () => {
  let config: InstanceElement
  let defaultConfig: { apiDefinitions: AdapterApiConfig }

  beforeEach(() => {
    defaultConfig = {
      apiDefinitions: {
        supportedTypes: {
          aType: ['aTypes'],
          bType: ['bTypes'],
        },
      } as unknown as AdapterApiConfig,
    }

    config = new InstanceElement(
      ElemID.CONFIG_NAME,
      new ObjectType({ elemID: new ElemID('test', ElemID.CONFIG_NAME) }),
      {
        fetch: {
          includeTypes: ['aTypes', 'bTypes'],
        },
      },
    )
  })

  it('should migrate includeTypes', () => {
    const updatedConfig = migrateDeprecatedIncludeList(config, defaultConfig)

    expect(updatedConfig?.config[0].value).toEqual({
      fetch: {
        include: [
          {
            type: '.*',
          },
        ],
        exclude: [],
      },
    })
  })

  it('should exclude types that are not in the includeTypes', () => {
    config.value.fetch = { includeTypes: ['aTypes'] }

    const updatedConfig = migrateDeprecatedIncludeList(config, defaultConfig)

    expect(updatedConfig?.config[0].value).toEqual({
      fetch: {
        include: [
          {
            type: '.*',
          },
        ],
        exclude: [
          {
            type: 'bType',
          },
        ],
      },
    })
  })

  it('should delete old supportedTypes', () => {
    config.value = {
      fetch: {
        include: [{ type: '.*' }],
        exclude: [],
      },
      apiDefinitions: {
        supportedTypes: ['aTypes', 'bTypes'],
      },
    }
    const updatedConfig = migrateDeprecatedIncludeList(config, defaultConfig)

    expect(updatedConfig?.config[0].value).toEqual({
      fetch: {
        include: [{ type: '.*' }],
        exclude: [],
      },
      apiDefinitions: {},
    })
  })

  it('should do nothing if configuration is up to date', () => {
    config.value = {
      fetch: {
        include: [
          {
            type: 'aType',
          },
        ],
        exclude: [],
      },
    }
    const updatedConfig = migrateDeprecatedIncludeList(config, defaultConfig)

    expect(updatedConfig).toBeUndefined()
  })
})
