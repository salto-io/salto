import { Workspace } from 'salto'
import { command } from '../../src/commands/plan'
import { plan, MockWriteStream, getWorkspaceErrors, mockSpinnerCreator } from '../mocks'

const mockPlan = plan
const mockWs = { hasErrors: () => false }
const mockErrWs = {
  hasErrors: () => true,
  errors: { strings: () => ['Error'] },
  getWorkspaceErrors,
}
jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  plan: jest.fn().mockImplementation(() => mockPlan()),
  Workspace: {
    load: jest.fn().mockImplementation(config => (config.baseDir === 'errdir' ? mockErrWs : mockWs)),
  },
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => ({ baseDir: workspaceDir, additionalBlueprints: [], cacheLocation: '' })
  ),
}))

describe('plan command', () => {
  const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  const spinner = mockSpinnerCreator()
  it('should load the workspace', async () => {
    await command('', cliOutput, spinner).execute()
    expect(Workspace.load).toHaveBeenCalled()
  })
  it('should print summary', async () => {
    await command('', cliOutput, spinner).execute()
    expect(cliOutput.stdout.content.search(/Plan.*0 to add, 3 to change, 0 to remove./)).toBeGreaterThan(0)
  })

  it('should find all elements', async () => {
    await command('', cliOutput, spinner).execute()
    expect(cliOutput.stdout.content).toContain('lead')
    expect(cliOutput.stdout.content).toContain('account')
    expect(cliOutput.stdout.content).toContain('salto_employee_instance')
  })

  it('should find instance change', async () => {
    await command('', cliOutput, spinner).execute()
    expect(cliOutput.stdout.content.search('name: "FirstEmployee" => "PostChange"')).toBeGreaterThan(0)
  })

  it('should have started spinner and it should succeed (and not fail)', async () => {
    await command('', cliOutput, spinner).execute()
    expect(spinner.started()).toBeTruthy()
    expect(spinner.succeeded()).toBeTruthy()
    expect(spinner.failed()).toBeFalsy()
  })

  it('should fail on workspace errors  ', async () => {
    await command('errdir', cliOutput, spinner).execute()
    expect(cliOutput.stderr.content).toContain('Error')
    expect(spinner.failed()).toBeTruthy()
  })
})
