import { workspace as ws } from 'salto'
import { command } from '../../src/commands/plan'
import { plan, MockWriteStream } from '../mocks'

const mockPlan = plan
jest.mock('salto', () => ({
  api: { plan: jest.fn().mockImplementation(() => mockPlan()) },
  workspace: { Workspace: { load: jest.fn() } },
}))

describe('plan command', () => {
  let output: string
  beforeAll(async () => {
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command('', [], cliOutput).execute()
    output = cliOutput.stdout.content
  })

  it('should load the workspace', () => {
    expect(ws.Workspace.load).toHaveBeenCalled()
  })

  it('should print refresh', () => {
    expect(output).toMatch('Refreshing Salto state in-memory prior to plan...')
  })

  it('should print summary', () => {
    expect(output.search(/Plan.*0 to add, 3 to change, 0 to remove./)).toBeGreaterThan(0)
  })

  it('should find all elements', () => {
    expect(output.search(/M.*lead/)).toBeGreaterThan(0)
    expect(output.search(/M.*account/)).toBeGreaterThan(0)
    expect(output.search(/M.*salto_employee_instance/)).toBeGreaterThan(0)
  })

  it('should find instance change', () => {
    expect(output.search('name: "FirstEmployee" => "PostChange"')).toBeGreaterThan(0)
  })
})
