import * as coreMock from '../../core/mocks/core'
import { command } from '../../../src/cli/commands/describe'
import { MockWriteStream } from '../mocks'

const mockDescribe = coreMock.describe
jest.mock('../../../src/core/commands', () => ({
  describeElement: jest.fn().mockImplementation(() => mockDescribe([])),
}))

describe('describe command', () => {
  it('should run describe', async () => {
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    await command([], [], cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch('salto_employee')
  })
})
