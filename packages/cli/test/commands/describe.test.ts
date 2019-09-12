import * as mocks from '../mocks'
import { command } from '../../src/commands/describe'

const mockDescribe = mocks.describe
jest.mock('salto', () => ({
  describeElement: jest.fn().mockImplementation(() => mockDescribe([])),
}))

describe('describe command', () => {
  it('should run describe', async () => {
    const cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    await command([], [], cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch('salto_employee')
  })
})
