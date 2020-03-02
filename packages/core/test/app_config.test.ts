
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

import * as conf from '../src/app_config'

jest.mock('../src/file', () => ({
  mkdirp: jest.fn().mockImplementation(
    (_dir: string) => Promise.resolve()
  ),
  replaceContents: jest.fn().mockImplementation(
    (_filename: string, _content: Buffer | string) => Promise.resolve()
  ),
  exists: jest.fn().mockImplementation(
    (filename: string) => ((filename.search('exists') !== -1) ? Promise.resolve(true) : Promise.resolve(false))
  ),
  readFile: jest.fn().mockImplementation(
    (_filename: string) => Promise.resolve(
      Buffer.from(
        `salto {
          installationID = "1234"
        }
        telemetry {
          url = "https://telemetry.salto.io"
          token = "1234"
          enabled = true
        }`,
        'utf-8',
      )
    )
  ),
}))

describe('app config', () => {
  afterAll(() => {
    delete process.env.SALTO_HOME
  })

  it('should load config from disk', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/exists/home'
    const appConfig = await conf.configFromDisk()
    expect(conf.getSaltoHome()).toEqual('/exists/home')
    expect(appConfig.installationID).toEqual('1234')
    expect(appConfig.telemetry.url).toEqual('https://telemetry.salto.io')
  })

  it('should disable telemetry if env var is saying so', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/exists/home'
    process.env.SALTO_TELEMETRY_DISABLE = '1'
    jest.resetModules()
    const iko = require('../') // eslint-disable-line

    const appConfig = await iko.configFromDisk()
    expect(appConfig.telemetry.enabled).toBeFalsy()
  })

  it('should initialize config on disk', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/exists'

    const appConfig = await conf.configFromDisk()
    expect(conf.getSaltoHome()).toEqual('/exists')
    expect(appConfig.installationID).toEqual('1234')
    expect(appConfig.telemetry.url).toEqual('https://telemetry.salto.io')
  })
})
