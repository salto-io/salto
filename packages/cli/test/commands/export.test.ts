import path from 'path'
import { ObjectType, InstanceElement } from 'adapter-api'
import { Workspace } from 'salto'
import { exportToCsv, MockWriteStream, getWorkspaceErrors } from '../mocks'
import { command } from '../../src/commands/export'

const mockExportToCsv = exportToCsv
const mockWS = { hasErrors: () => false, errors: {}, getWorkspaceErrors }
jest.mock('salto', () => ({
  ...(require.requireActual('salto')),
  exportToCsv: jest.fn().mockImplementation((
    workspace: Workspace,
    outputPath: string,
    typeId: string,
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>
  ) => mockExportToCsv(typeId, outputPath, workspace, fillConfig)),
  Workspace: {
    load: jest.fn().mockImplementation(() => mockWS),
  },
  loadConfig: jest.fn(),
  dumpCsv: jest.fn().mockImplementation(() => { }),
}))

describe('export command', () => {
  const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }

  it('should run export', async () => {
    const outputPath = path.join(__dirname, '__test_export.csv')
    await command('', 'Test', outputPath, cliOutput).execute()
    expect(mockExportToCsv).toHaveBeenCalled()
    expect(Workspace.load).toHaveBeenCalled()
  })

  it('should fail on workspace errors', async () => {
    mockWS.hasErrors = () => true
    mockWS.errors = { strings: () => ['Error'] }
    const outputPath = path.join(__dirname, '__test_export.csv')
    await command('', 'Test', outputPath, cliOutput).execute()
    expect(cliOutput.stderr.content).toContain('Error')
  })
})
