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
import os from 'os'
import { loadConfig } from '../../src/workspace/config'
import { SALTO_HOME_VAR } from '../../src/config'

const workspacesDir = path.join(__dirname, '../../../test/workspace/configs')
const fullWorkspaceDir = path.resolve(workspacesDir, 'full')
const defaultsWorkspaceDir = path.resolve(workspacesDir, 'defaults')
describe('configuration dir location', () => {
  it('should load config from workspace root', async () => {
    const config = await loadConfig(fullWorkspaceDir)
    expect(config).toBeDefined()
  })
  it('should load config from workspace inner dir', async () => {
    const config = await loadConfig(path.join(defaultsWorkspaceDir, 'test'))
    expect(config).toBeDefined()
  })
  it(
    'should throw error when path is not a workspace',
    () => expect(loadConfig(workspacesDir)).rejects.toThrow(),
  )
})

describe('load proper configuration', () => {
  const defaultUUID = '56816ffc-1457-55da-bd68-6e02c87f908f'
  const defaultLocalStorageName = `${path.basename(defaultsWorkspaceDir)}-${defaultUUID}`
  it('should load a full config', async () => {
    const config = await loadConfig(fullWorkspaceDir)
    expect(config).toEqual(
      {
        name: 'workspace',
        localStorage: '/.salto/workspace',
        baseDir: '/workspace',
        stateLocation: '/states/test.bpc',
        credentialsLocation: 'credentials',
        services: [],
        uid: 'uid',
        envs: [],
      }
    )
  })
  it('should use default values', async () => {
    const config = await loadConfig(defaultsWorkspaceDir)
    expect(config).toEqual(
      {
        name: path.basename(defaultsWorkspaceDir),
        localStorage: path.join(os.homedir(), '.salto', defaultLocalStorageName),
        baseDir: defaultsWorkspaceDir,
        stateLocation: path.join(defaultsWorkspaceDir, 'salto.config', 'state.bpc'),
        credentialsLocation: 'credentials',
        services: [],
        uid: defaultUUID,
        envs: [],
      }
    )
  })
  it('should use salto home env var for default values', async () => {
    const homeVar = path.join(os.homedir(), '.salto_home')
    process.env[SALTO_HOME_VAR] = homeVar
    const config = await loadConfig(defaultsWorkspaceDir)
    expect(config).toEqual(
      {
        name: path.basename(defaultsWorkspaceDir),
        localStorage: path.join(homeVar, defaultLocalStorageName),
        baseDir: defaultsWorkspaceDir,
        stateLocation: path.join(defaultsWorkspaceDir, 'salto.config', 'state.bpc'),
        credentialsLocation: 'credentials',
        services: [],
        uid: defaultUUID,
        envs: [],
      }
    )
  })
})
