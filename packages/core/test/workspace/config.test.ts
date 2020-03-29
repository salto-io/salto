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
import _ from 'lodash'
import { Values } from '@salto-io/adapter-api'
import { loadConfig, addEnvToConfig, setCurrentEnv,
  CONFIG_DIR_NAME, STATES_DIR_NAME,
  DEFAULT_STALE_STATE_THRESHOLD_MINUTES } from '../../src/workspace/config'
import { readTextFile, exists } from '../../src/file'
import { SALTO_HOME_VAR } from '../../src/app_config'

const workspacesDir = '/workspaces'
const fullWorkspaceDir = path.join(workspacesDir, 'full')
const defaultsWorkspaceDir = path.join(workspacesDir, 'defaults')
const missingLocalWorkspaceDir = path.join(workspacesDir, 'missing')

jest.mock('../../src/file', () => ({
  readTextFile: jest.fn(),
  exists: jest.fn(),
  stat: jest.fn().mockResolvedValue({}),
  mkdirp: jest.fn().mockImplementation(),
  replaceContents: jest.fn().mockImplementation(),
}))
describe('configuration dir location', () => {
  const mockReadFileText = readTextFile as unknown as jest.Mock
  const mockExists = exists as unknown as jest.Mock
  const filenamesToContent: Values = {
    '/workspaces/full/salto.config/config.bp': `salto {
      name = "workspace"
      staleStateThresholdMinutes = 4444
      localStorage = "/.salto/workspace"
      uid = "uid"
      envs = {
        default = {
          baseDir = "default"
          config = {
            stateLocation = "/states/test.bpc"
            credentialsLocation = "/creds/default"
          }
        }
      }
    }`,
    '/.salto/workspace/config.bp': `salto {
      currentEnv = "default"
    }`,
    '/workspaces/defaults/salto.config/config.bp': `salto {
      envs = {
        default = {
          baseDir = "default"
        }
      }
    }`,
    '/home/.salto_home/defaults-56816ffc-1457-55da-bd68-6e02c87f908f/config.bp': `salto {
      currentEnv = "default"
    }`,
    [path.join(os.homedir(), '.salto/defaults-56816ffc-1457-55da-bd68-6e02c87f908f/config.bp')]: `salto {
      currentEnv = "default"
    }`,
    '/workspaces/missing/salto.config/config.bp': `salto {
      uid = "uid"
      envs = {
        first = {
          baseDir = "first"
        }
        second = {
          baseDir = "second"
        }
      }
    }`,
  }
  const getAllPaths = (p: string): string[] => {
    if (p === '.' || p === '/') return []
    return [...getAllPaths(path.dirname(p)), p]
  }
  const allPaths = new Set(_.flatten(Object.keys(filenamesToContent).map(getAllPaths)))
  mockExists.mockImplementation(async filename => allPaths.has(filename))
  mockReadFileText.mockImplementation(async filename => filenamesToContent[filename] ?? '')

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
        staleStateThresholdMinutes: 4444,
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
        staleStateThresholdMinutes: DEFAULT_STALE_STATE_THRESHOLD_MINUTES,
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
              stateLocation: path.join(defaultsWorkspaceDir, CONFIG_DIR_NAME, STATES_DIR_NAME, 'default.bpc'),
            },
          },
        },
      }
    )
  })
  it('should use default values for local config', async () => {
    const config = await loadConfig(missingLocalWorkspaceDir)
    const localStorage = path.join(os.homedir(), '.salto', 'missing-uid')
    expect(config).toEqual(
      {
        name: path.basename(missingLocalWorkspaceDir),
        localStorage,
        baseDir: missingLocalWorkspaceDir,
        staleStateThresholdMinutes: DEFAULT_STALE_STATE_THRESHOLD_MINUTES,
        uid: 'uid',
        currentEnv: 'first',
        envs: {
          first: {
            baseDir: 'first',
            config: {
              credentialsLocation: path.join(localStorage, 'first', 'credentials'),
              services: [],
              stateLocation: path.join(missingLocalWorkspaceDir, CONFIG_DIR_NAME, STATES_DIR_NAME, 'first.bpc'),
            },
          },
          second: {
            baseDir: 'second',
            config: {
              credentialsLocation: path.join(localStorage, 'second', 'credentials'),
              services: [],
              stateLocation: path.join(missingLocalWorkspaceDir, CONFIG_DIR_NAME, STATES_DIR_NAME, 'second.bpc'),
            },
          },
        },
      }
    )
  })
  it('should use salto home env var for default values', async () => {
    const homeVar = '/home/.salto_home'
    process.env[SALTO_HOME_VAR] = homeVar
    const config = await loadConfig(defaultsWorkspaceDir)
    const localStorage = path.join(homeVar, defaultLocalStorageName)
    expect(config).toEqual(
      {
        name: path.basename(defaultsWorkspaceDir),
        localStorage,
        staleStateThresholdMinutes: DEFAULT_STALE_STATE_THRESHOLD_MINUTES,
        baseDir: defaultsWorkspaceDir,
        uid: defaultUUID,
        currentEnv: 'default',
        envs: {
          default: {
            baseDir: 'default',
            config: {
              credentialsLocation: path.join(localStorage, 'default', 'credentials'),
              services: [],
              stateLocation: path.join(defaultsWorkspaceDir, CONFIG_DIR_NAME, STATES_DIR_NAME, 'default.bpc'),
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
    staleStateThresholdMinutes: 44444444,
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
      const envName = 'newEnv'
      const afterConfig = await addEnvToConfig(beforeConfig, envName)
      expect(afterConfig.envs.newEnv).toEqual({
        baseDir: path.join('envs', 'newEnv'),
        config: {
          credentialsLocation: path.join(beforeConfig.localStorage, 'envs', envName, 'credentials'),
          services: [],
          stateLocation: path.join(
            beforeConfig.baseDir, CONFIG_DIR_NAME, STATES_DIR_NAME, `${envName}.bpc`
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
