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
import { DEFAULT_CONFIG, configType, getExcludeUserConfigSuggestion } from '../src/user_config'

describe('user_config', () => {
  describe('getExcludeUserConfigSuggestion', () => {
    describe('when fetch.exclude list is empty', () => {
      it('it should create config suggestion to add User type to exclude list', () => {
        const config = new InstanceElement('config', configType, {
          ...DEFAULT_CONFIG,
          fetch: {
            ...DEFAULT_CONFIG.fetch,
            include: [{ type: '.*' }],
            exclude: [],
          },
        })
        const res = getExcludeUserConfigSuggestion(config)
        expect(res).toEqual({
          type: 'typeToExclude',
          value: 'User',
          reason:
            'User type is excluded by default. To include users, explicitly add "User" type into the include list.',
        })
      })
    })
    describe('when fetch.exclude list already contains User type', () => {
      it('should not create config suggestion to add User type to exclude list', () => {
        const config = new InstanceElement('config', configType, {
          ...DEFAULT_CONFIG,
        })
        const res = getExcludeUserConfigSuggestion(config)
        expect(res).toEqual(undefined)
      })
    })
    describe('when User is explicitly in include list', () => {
      it('should not create config suggestion to add User type to exclude list', () => {
        const config = new InstanceElement('config', configType, {
          ...DEFAULT_CONFIG,
          fetch: {
            ...DEFAULT_CONFIG.fetch,
            include: [{ type: '.*' }, { type: 'User' }],
            exclude: [],
          },
        })
        const res = getExcludeUserConfigSuggestion(config)
        expect(res).toEqual(undefined)
      })
    })
  })
})
