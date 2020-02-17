
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
  writeFile: jest.fn().mockImplementation(
    (_filename: string, _content: Buffer | string) => Promise.resolve()
  ),
  exists: jest.fn().mockImplementation(
    (filename: string) => ((filename.search('exists') !== -1) ? Promise.resolve(true) : Promise.resolve(false))
  ),
  readTextFile: jest.fn().mockImplementation(
    (_filename: string) => Promise.resolve('1234')
  ),
}))

describe('app config', () => {
  afterAll(() => {
    delete process.env.SALTO_HOME
  })

  it('should load installation id from disk', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/exists/home'
    const appConfig = await conf.fromDisk()
    expect(conf.getSaltoHome()).toEqual('/exists/home')
    expect(appConfig.installationID).toEqual('1234')
  })

  it('should fail when loading config that was not initialized', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/a/b/c'
    await expect(conf.fromDisk()).rejects.toThrow(/cannot find installation id/)
  })

  it('should initialize config on disk', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/exists'

    const appConfig = await conf.fromDisk()
    expect(conf.getSaltoHome()).toEqual('/exists')
    expect(appConfig.installationID).toEqual('1234')
  })
})
