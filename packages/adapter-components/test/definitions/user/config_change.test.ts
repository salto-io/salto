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

import { InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { getUpdatedConfigFromConfigChanges } from '../../../src/definitions/user'

describe('config_change', () => {
  let config: InstanceElement
  let configType: ObjectType
  beforeEach(() => {
    configType = new ObjectType({ elemID: new ElemID('test', 'adapterApiConfig') })
    config = new InstanceElement(ElemID.CONFIG_NAME, configType, {
      fetch: {
        include: [{ type: 'aType' }],
        exclude: [{ type: 'Type1' }],
        fetchFlag1: false,
        someFlag: false,
      },
    })
  })
  it('should return undefined when no changes are suggested', () => {
    expect(getUpdatedConfigFromConfigChanges({ configChanges: [], currentConfig: config, configType })).toBeUndefined()
  })
  it('should return new config when changes are suggested and a message', () => {
    const configChange = getUpdatedConfigFromConfigChanges({
      configChanges: [
        { type: 'typeToExclude', value: 'bType', reason: 'r1' },
        { type: 'typeToExclude', value: 'cType', reason: 'r2' },
        { type: 'disablePrivateAPI', reason: 'can not fetch private api' },
      ],
      currentConfig: config,
      configType,
    })
    expect(configChange?.config).toHaveLength(1)
    expect(configChange?.config[0].value.fetch.include).toEqual([{ type: 'aType' }])
    expect(configChange?.config[0].value.fetch.exclude).toEqual([
      { type: 'Type1' },
      { type: 'bType' },
      { type: 'cType' },
    ])
    expect(configChange?.config[0].value.client).toEqual({ usePrivateAPI: false })
    expect(configChange?.message).toContain('r1')
    expect(configChange?.message).toContain('r2')
    expect(configChange?.message).toContain('can not fetch private api')
  })
  describe('enableFetchFlag config suggestions', () => {
    it('should enable fetch flags when there are enableFetchFlag config suggestions', () => {
      const updatedConfig = getUpdatedConfigFromConfigChanges({
        configChanges: [
          { type: 'enableFetchFlag', value: 'fetchFlag1', reason: 'r1' },
          { type: 'enableFetchFlag', value: 'fetchFlag2', reason: 'r2' },
        ],
        currentConfig: config,
        configType,
      })
      expect(updatedConfig?.config).toBeDefined()
      expect(updatedConfig?.config[0].value).toEqual({
        fetch: {
          include: [{ type: 'aType' }],
          exclude: [{ type: 'Type1' }],
          fetchFlag1: true,
          fetchFlag2: true,
          someFlag: false,
        },
      })
    })
    it('should not change fetch flags when there are no enableFetchFlag config suggestions', () => {
      const updatedConfig = getUpdatedConfigFromConfigChanges({
        configChanges: [{ type: 'typeToExclude', value: 'bType', reason: 'r1' }],
        currentConfig: config,
        configType,
      })
      expect(updatedConfig?.config).toBeDefined()
      expect(updatedConfig?.config[0].value).toEqual({
        fetch: {
          include: [{ type: 'aType' }],
          exclude: [{ type: 'Type1' }, { type: 'bType' }],
          fetchFlag1: false,
          someFlag: false,
        },
      })
    })
  })
})
