import { Workspace } from 'salto'
import * as mocks from '../mocks'
import { command } from '../../src/commands/describe'

const mockDescribe = mocks.describe
const mockWs = { hasErrors: () => false }
const mockErrWs = {
  hasErrors: () => true,
  errors: { strings: () => ['Error'] },
  getWorkspaceErrors: mocks.getWorkspaceErrors,
}
jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  describeElement: jest.fn().mockImplementation(() => mockDescribe([])),
  Workspace: {
    load: jest.fn().mockImplementation(config => (config.baseDir === 'errdir' ? mockErrWs : mockWs)),
  },
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => ({ baseDir: workspaceDir, additionalBlueprints: [], cacheLocation: '' })
  ),
}))

describe('describe command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }

  beforeEach(async () => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
  })

  it('should load the workspace', async () => {
    await command('', [], cliOutput).execute()
    expect(Workspace.load).toHaveBeenCalled()
  })

  it('should find element name', async () => {
    await command('', [], cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch('salto_office')
  })

  it('should find element description', async () => {
    await command('', [], cliOutput).execute()
    expect(cliOutput.stdout.content.search('Office type in salto')).toBeGreaterThan(0)
  })

  it('should fail on workspace errors  ', async () => {
    await command('errdir', [], cliOutput).execute()
    expect(cliOutput.stderr.content).toContain('Error')
  })
})
