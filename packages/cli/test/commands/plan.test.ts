import { Workspace } from 'salto'
import { command } from '../../src/commands/plan'
import { plan, MockWriteStream, getWorkspaceErrors } from '../mocks'

const mockPlan = plan
const mockWs = { hasErrors: () => false }
const mockErrWs = {
  hasErrors: () => true,
  errors: { strings: () => ['Error'] },
  getWorkspaceErrors,
}
jest.mock('salto', () => ({
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


  it('should load the workspace', async () => {
    await command('', cliOutput).execute()
    expect(Workspace.load).toHaveBeenCalled()
  })

  it('should print refresh', async () => {
    await command('', cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch('Refreshing Salto state in-memory prior to plan...')
  })

  it('should print summary', async () => {
    await command('', cliOutput).execute()
    expect(cliOutput.stdout.content.search(/Plan.*0 to add, 3 to change, 0 to remove./)).toBeGreaterThan(0)
  })

  it('should find all elements', async () => {
    await command('', cliOutput).execute()
    expect(cliOutput.stdout.content.search(/M.*lead/)).toBeGreaterThan(0)
    expect(cliOutput.stdout.content.search(/M.*account/)).toBeGreaterThan(0)
    expect(cliOutput.stdout.content.search(/M.*salto_employee_instance/)).toBeGreaterThan(0)
  })

  it('should find instance change', async () => {
    await command('', cliOutput).execute()
    expect(cliOutput.stdout.content.search('name: "FirstEmployee" => "PostChange"')).toBeGreaterThan(0)
  })

  it('should fail on workspace errors  ', async () => {
    await command('errdir', cliOutput).execute()
    expect(cliOutput.stderr.content).toContain('Error')
  })
})
