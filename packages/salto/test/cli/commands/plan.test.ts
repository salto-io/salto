import * as coreMock from '../../core/mocks/core'
import { command } from '../../../src/cli/commands/plan'
import { MockWriteStream } from '../mocks'

const mockPlan = coreMock.plan
jest.mock('../../../src/core/commands', () => ({
  plan: jest.fn().mockImplementation(() => mockPlan([])),
}))

describe('plan command', () => {
  it('should run plan', async () => {
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch('Refreshing Salto state in-memory prior to plan...')
  })
})
