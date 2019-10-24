import * as path from 'path'
import os from 'os'
import * as fs from 'async-file'
import { loadConfig, SALTO_HOME_VAR, initConfig } from '../../src/workspace/config'

const workspacesDir = path.join(__dirname, '../../../test/workspaces')
const fullWorkspaceDir = path.resolve(workspacesDir, 'full')
const emptyWorkspaceDir = path.resolve(workspacesDir, 'empty')
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
  it('should throw error when path is not a workspace', async () => {
    expect(loadConfig(workspacesDir)).rejects.toThrow()
  })
})

describe('load proper configuration', () => {
  const defaultUUID = '56816ffc-1457-55da-bd68-6e02c87f908f'
  const defaultLocalStorageName = `${path.basename(defaultsWorkspaceDir)}-${defaultUUID}`
  it('should load a full config', async () => {
    const config = await loadConfig(fullWorkspaceDir)
    expect(config).toEqual(
      {
        name: 'workspace',
        localStorage: '~/.salto/workspace',
        baseDir: '~/workspace',
        stateLocation: '~/states/test.bpc',
        additionalBlueprints: ['~/moreBP/test.bp'],
        uid: 'uid',
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
        additionalBlueprints: [],
        uid: defaultUUID,
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
        additionalBlueprints: [],
        uid: defaultUUID,
      }
    )
  })
})

describe('init config', () => {
  beforeEach(async () => {
    await fs.delete(emptyWorkspaceDir)
    await fs.createDirectory(emptyWorkspaceDir)
  })

  it('should init a basedir with no workspace name provided', async () => {
    const config = await initConfig(emptyWorkspaceDir)
    expect(await fs.exists(config.localStorage)).toBeTruthy()
    expect(config.name).toBe('empty')
  })
  it('should init a basedir with workspace name provided', async () => {
    const config = await initConfig(emptyWorkspaceDir, 'test')
    expect(await fs.exists(config.localStorage)).toBeTruthy()
    expect(config.name).toBe('test')
  })
  it('should fail when run inside an existing workspace', () => {
    expect(initConfig(fullWorkspaceDir)).rejects.toThrow()
  })
  it('should fail on a non empty workspace', () => {
  })
})
