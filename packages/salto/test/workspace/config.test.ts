import * as path from 'path'
import os from 'os'
import { loadConfig, SALTO_HOME_VAR } from '../../src/workspace/config'

const workspacesDir = path.join(__dirname, '../../../test/workspaces')
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
        services: [],
        additionalBlueprints: ['/moreBP/test.bp'],
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
        services: [],
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
        services: [],
        uid: defaultUUID,
      }
    )
  })
})
