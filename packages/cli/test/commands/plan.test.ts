import { command } from '../../src/commands/plan'
import { plan, MockWriteStream } from '../mocks'

const mockPlan = plan
jest.mock('salto', () => ({
  plan: jest.fn().mockImplementation(() => mockPlan([])),
}))

describe('plan command', () => {
  it('should run plan', async () => {
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch('Refreshing Salto state in-memory prior to plan...')
  })
})
