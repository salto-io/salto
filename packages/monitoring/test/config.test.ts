/*
*                      Copyright 2020 Salto Labs Ltd.
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

import * as config from '../src/config'

describe('config', () => {
  it('should throw invalid regex', () => {
    expect(() => config.validateConfig({
      triggers: [{
        name: 'example',
        elementIdsRegex: ['*'],
      }],
      notifications: [],
      smtp: {
        host: 'host',
        port: 0,
        ssl: true,
        username: 'user',
        password: 'pass',
      },
      slack: {
        token: '',
      },
      telemetry: {
        id: 'id',
        url: 'http://url.com',
        token: 'supersecrettoken',
        enabled: true,
      },
    })).toThrow()
  })

  it('should throw invalid trigger', () => {
    expect(() => config.validateConfig({
      triggers: [{
        name: 'example',
        elementIdsRegex: ['*'],
      }],
      notifications: [{
        type: 'email',
        title: 'title',
        from: 'a@b.com',
        to: ['b@a.com'],
        triggers: ['example-not-exists'],
      }],
      smtp: {
        host: 'host',
        port: 0,
        ssl: true,
        username: 'user',
        password: 'pass',
      },
      slack: {
        token: '',
      },
      telemetry: {
        id: 'id',
        url: 'http://url.com',
        token: 'supersecrettoken',
        enabled: true,
      },
    })).toThrow()
  })
})
