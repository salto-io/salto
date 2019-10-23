import * as path from 'path'
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
  it('should throw error when path is not a workspace', async () => {
    expect(loadConfig(workspacesDir)).rejects.toThrow()
  })
})

describe('load proper configuration', () => {
  it('should load a full config', async () => {
    const config = await loadConfig(fullWorkspaceDir)
    expect(config).toEqual(
      {
        name: 'workspace',
        localStorage: '~/.salto/workspace',
        baseDir: '~/workspace',
        stateLocation: '~/states/test.bpc',
        additionalBlueprints: ['~/moreBP/test.bp'],
      }
    )
  })
  it('should use default values', async () => {
    const config = await loadConfig(defaultsWorkspaceDir)
    expect(config).toEqual(
      {
        name: path.basename(defaultsWorkspaceDir),
        localStorage: path.join('~/.salto', path.basename(defaultsWorkspaceDir)),
        baseDir: defaultsWorkspaceDir,
        stateLocation: path.join(defaultsWorkspaceDir, 'salto.config', 'state.bpc'),
        additionalBlueprints: [],
      }
    )
  })
  it('should use salto home env var for default values', async () => {
    process.env[SALTO_HOME_VAR] = '~/.salto_home'
    const config = await loadConfig(defaultsWorkspaceDir)
    expect(config).toEqual(
      {
        name: path.basename(defaultsWorkspaceDir),
        localStorage: path.join('~/.salto_home', path.basename(defaultsWorkspaceDir)),
        baseDir: defaultsWorkspaceDir,
        stateLocation: path.join(defaultsWorkspaceDir, 'salto.config', 'state.bpc'),
        additionalBlueprints: [],
      }
    )
  })
})
