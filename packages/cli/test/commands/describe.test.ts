import { workspace as ws } from 'salto'
import * as mocks from '../mocks'
import { command } from '../../src/commands/describe'

const mockDescribe = mocks.describe
jest.mock('salto', () => ({
  api: {
    describeElement: jest.fn().mockImplementation(() => mockDescribe([])),
  },
  workspace: {
    Workspace: {
      load: jest.fn(),
    },
  },
}))

describe('describe command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }

  beforeEach(async () => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    await command('', [], [], cliOutput).execute()
  })

  it('should load the workspace', () => {
    expect(ws.Workspace.load).toHaveBeenCalled()
  })

  it('should find element name', () => {
    expect(cliOutput.stdout.content).toMatch('salto_office')
  })

  it('should find element description', () => {
    expect(cliOutput.stdout.content.search('Office type in salto')).toBeGreaterThan(0)
  })
})
