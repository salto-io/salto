
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
import * as os from 'os'
import * as conf from '../src/config'
// import * as file from '../src/file'

const testSaltoHomeDir = path.join(os.homedir(), '.salto')
const testSaltoConfigDir = path.join(testSaltoHomeDir, 'salto.config')

describe('core config', () => {
  beforeEach(async () => {
    process.env.SALTO_HOME = testSaltoConfigDir
    await conf.initConfig()
    // spyMkdir = jest.spyOn(file, 'mkdirp').mockResolvedValue(true)
    // jest.spyOn(file, 'exists').mockResolvedValue(false)
  })

  it('should override default salto home path', async () => {
    process.env[conf.SALTO_HOME_VAR] = testSaltoHomeDir
    expect(conf.getSaltoHome()).toEqual(testSaltoHomeDir)
    expect(await conf.getGlobalConfigDir()).toEqual(path.join(testSaltoHomeDir, 'salto.config'))
    expect(await conf.getInstallationIDFile()).toEqual(path.join(testSaltoHomeDir, 'salto.config', '.installation_id'))
  })

  it('should generate an installation id', async () => {
    expect(await conf.getInstallationID()).toMatch(/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-4[a-fA-F0-9]{3}-[89abAB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$/)
  })
})
