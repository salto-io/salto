
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

import * as path from 'path'
import * as conf from '../src/app_config'
import * as file from '../src/file'

const testSaltoHomeDir = path.join(__dirname, '../../test/salto_home')

describe('app config', () => {
  afterAll(() => {
    delete process.env.SALTO_HOME
  })

  it('should load installation id from disk', async () => {
    process.env[conf.SALTO_HOME_VAR] = testSaltoHomeDir
    const appConfig = await conf.loadFromDisk()
    expect(conf.getSaltoHome()).toEqual(testSaltoHomeDir)
    expect(appConfig.installationID).toEqual('test_id')
  })

  it('should initialize config on disk', async () => {
    process.env[conf.SALTO_HOME_VAR] = testSaltoHomeDir
    jest.mock('../src/file')
    jest.spyOn(file, 'mkdirp')
    jest.spyOn(file, 'writeFile')
    jest.spyOn(file, 'readTextFile').mockReturnValue(new Promise<string>((res, _rej) => res('1234')))

    const appConfig = await conf.initOnDisk()
    expect(conf.getSaltoHome()).toEqual(testSaltoHomeDir)
    expect(appConfig.installationID).toEqual('1234')
  })

  it('should fail when loading config that was not initialized', async () => {
    process.env[conf.SALTO_HOME_VAR] = '/a/b/c'
    await expect(conf.loadFromDisk()).rejects.toThrow(/cannot find installation id/)
  })
})
