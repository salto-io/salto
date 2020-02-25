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
import { loadConfig, addEnvToConfig, setCurrentEnv } from '../../src/workspace/config'
import { SALTO_HOME_VAR } from '../../src/app_config'

const workspacesDir = path.join(__dirname, '../../../test/workspace/configs')
const fullWorkspaceDir = path.resolve(workspacesDir, 'full')
const defaultsWorkspaceDir = path.resolve(workspacesDir, 'defaults')

jest.mock('../../src/file', () => ({
  ...jest.requireActual('../../src/file'),
  replaceContents: jest.fn().mockImplementation(),
}))
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
        baseDir: fullWorkspaceDir,
        uid: 'uid',
        currentEnv: 'default',
        envs: {
          default: {
            baseDir: 'default',
            config: {
              credentialsLocation: '/creds/default',
              services: [],
              stateLocation: '/states/test.bpc',
            },
          },
        },
      }
    )
  })
  it('should use default values', async () => {
    const config = await loadConfig(defaultsWorkspaceDir)
    const localStorage = path.join(os.homedir(), '.salto', defaultLocalStorageName)
    expect(config).toEqual(
      {
        name: path.basename(defaultsWorkspaceDir),
        localStorage,
        baseDir: defaultsWorkspaceDir,
        uid: defaultUUID,
        currentEnv: 'default',
        envs: {
          default: {
            baseDir: 'default',
            config: {
              credentialsLocation: path.join(localStorage, 'default', 'credentials'),
              services: [],
              stateLocation: path.join(defaultsWorkspaceDir, 'default', 'salto.config', 'state.bpc'),
            },
          },
        },
      }
    )
  })
  it('should use salto home env var for default values', async () => {
    const homeVar = path.join(os.homedir(), '.salto_home')
    process.env[SALTO_HOME_VAR] = homeVar
    const config = await loadConfig(defaultsWorkspaceDir)
    const localStorage = path.join(homeVar, defaultLocalStorageName)
    expect(config).toEqual(
      {
        name: path.basename(defaultsWorkspaceDir),
        localStorage,
        baseDir: defaultsWorkspaceDir,
        uid: defaultUUID,
        currentEnv: 'default',
        envs: {
          default: {
            baseDir: 'default',
            config: {
              credentialsLocation: path.join(localStorage, 'default', 'credentials'),
              services: [],
              stateLocation: path.join(defaultsWorkspaceDir, 'default', 'salto.config', 'state.bpc'),
            },
          },
        },
      }
    )
  })
})

describe('update environment settings', () => {
  const beforeConfig = {
    name: 'workspace',
    localStorage: '/.salto/workspace',
    baseDir: fullWorkspaceDir,
    stateLocation: '/states/test.bpc',
    credentialsLocation: '/creds/default',
    services: [],
    uid: 'uid',
    currentEnv: 'default',
    envs: {
      default: { baseDir: 'default',
        config: {
          stateLocation: '/states/default.bpc',
          credentialsLocation: '/creds/default',
          services: [],
        } },
      other: { baseDir: 'other',
        config: {
          stateLocation: '/states/other.bpc',
          credentialsLocation: '/creds/other',
          services: [],
        } },
    },
  }
  describe('add new environment', () => {
    it('should add a new environment', async () => {
      const afterConfig = await addEnvToConfig(beforeConfig, 'newEnv')
      expect(afterConfig.envs.newEnv).toEqual({
        baseDir: path.join('envs', 'newEnv'),
        config: {
          credentialsLocation: path.join(beforeConfig.localStorage, 'envs', 'newEnv', 'credentials'),
          services: [],
          stateLocation: path.join(
            beforeConfig.baseDir, 'envs', 'newEnv', 'salto.config', 'state.bpc'
          ),
        },
      })
    })
    it('should fail when an existing environment name is provided', async () => {
      await expect(addEnvToConfig(beforeConfig, 'default')).rejects.toThrow()
    })
  })
  describe('set env', () => {
    it('should change current environment', async () => {
      const afterConfig = await setCurrentEnv(beforeConfig, 'other')
      expect(afterConfig.currentEnv).toEqual('other')
    })
    it('should fail when unknown environment name is provided', async () => {
      await expect(setCurrentEnv(beforeConfig, 'nope')).rejects.toThrow()
    })
  })
})
