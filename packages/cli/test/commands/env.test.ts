import * as mocks from '../mocks'
import { command } from '../../src/commands/env'
import * as workspace from '../../src/workspace'

jest.mock('salto', () => ({
  ...jest.requireActual('salto'),
  setCurrentEnv: jest.fn().mockImplementation(),
  addEnvToConfig: jest.fn().mockImplementation(),
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) =>
    mocks.mockLoadConfig(workspaceDir)),
}))

jest.mock('../../src/workspace')
describe('env commands', () => {
  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(baseDir => ({ workspace: mocks.mockLoadWorkspace(baseDir) }))
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const spinner = mocks.mockSpinnerCreator([])

  beforeEach(async () => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
  })

  describe('create enviornment command', () => {
    it('should create a new enviornment', async () => {
      await command('.', 'create', cliOutput, spinner, 'new-env').execute()
      expect(cliOutput.stdout.content.search('new-env')).toBeGreaterThan(0)
    })
  })

  describe('set enviornment command', () => {
    it('should set an enviornment', async () => {
      await command('.', 'set', cliOutput, spinner, 'active').execute()
      expect(cliOutput.stdout.content.search('active')).toBeGreaterThan(0)
    })
  })

  describe('current enviornment command', () => {
    it('should display the current enviornment', async () => {
      await command('.', undefined, cliOutput, spinner).execute()
      expect(cliOutput.stdout.content.search('active')).toBeGreaterThan(0)
    })
  })

  describe('list enviornment command', () => {
    it('should list all enviornments', async () => {
      await command('.', 'list', cliOutput, spinner).execute()
      expect(cliOutput.stdout.content.search('active')).toBeGreaterThan(0)
      expect(cliOutput.stdout.content.search('inactive')).toBeGreaterThan(0)
    })
  })
})
