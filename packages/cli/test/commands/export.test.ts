import * as saltoImp from 'salto'
import path from 'path'
import { exportToCsv as exportToCsvMock, MockWriteStream, getWorkspaceErrors } from '../mocks'
import { command } from '../../src/commands/export'

const mockWS = { hasErrors: () => false, errors: {}, getWorkspaceErrors }
const workspaceDir = `${__dirname}/../../../test/BP`

describe('export command', () => {
  const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }

  it('should run export', async () => {
    const outputPath = path.join(__dirname, '__test_export.csv')
    const exportToCsvSpy = jest.spyOn(saltoImp, 'exportToCsv')
      .mockImplementation(() => exportToCsvMock())
    const loadSpy = jest.spyOn(saltoImp.Workspace, 'load').mockImplementation(() => mockWS)
    await command(workspaceDir, 'Test', outputPath, cliOutput).execute()
    expect(exportToCsvSpy).toHaveBeenCalled()
    expect(loadSpy).toHaveBeenCalled()
  })

  it('should fail on workspace errors', async () => {
    mockWS.hasErrors = () => true
    mockWS.errors = { strings: () => ['Error'] }
    const outputPath = path.join(__dirname, '__test_export.csv')
    await command(workspaceDir, 'Test', outputPath, cliOutput).execute()
    expect(cliOutput.stderr.content).toContain('Error')
  })
})
