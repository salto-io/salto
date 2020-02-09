import * as path from 'path'
import os from 'os'
import { loadConfig, SALTO_HOME_VAR, addEnvToConfig, setCurrentEnv } from '../../src/workspace/config'

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
        stateLocation: '/states/test.bpc',
        credentialsLocation: '/creds/default',
        services: [],
        uid: 'uid',
        currentEnv: 'default',
        envs: [{ baseDir: 'default', name: 'default' }],
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
        stateLocation: path.join('salto.config', 'state.bpc'),
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
        stateLocation: path.join('salto.config', 'state.bpc'),
        credentialsLocation: 'credentials',
        services: [],
        uid: defaultUUID,
        envs: [],
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
    envs: [
      { baseDir: 'default', name: 'default' },
      { baseDir: 'other', name: 'other' },
    ],
  }
  describe('add new environment', () => {
    it('should add a new environment', async () => {
      const afterConfig = await addEnvToConfig(beforeConfig, 'newEnv')
      expect(afterConfig.envs[2]).toEqual({
        name: 'newEnv',
        baseDir: path.join('envs', 'newEnv'),
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
