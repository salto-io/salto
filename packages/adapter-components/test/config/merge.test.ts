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
import { Values } from '@salto-io/adapter-api'
import { mergeWithDefaultConfig } from '../../src/config'

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
