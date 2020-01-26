import { Workspace, exportToCsv } from 'salto'
import { DataModificationResult } from 'adapter-api'
import Prompts from '../../src/prompts'
import * as mocks from '../mocks'
import { command } from '../../src/commands/export'
import { CliExitCode } from '../../src/types'
import * as workspace from '../../src/workspace'

jest.mock('salto', () => ({
  ...jest.requireActual('salto'),
  exportToCsv: jest.fn().mockImplementation(() => Promise.resolve({
    successfulRows: 5,
    failedRows: 0,
    errors: new Set<string>(),
  })),
}))
jest.mock('../../src/workspace')
describe('export command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const workspaceDir = 'dummy_dir'
  const outputPath = 'dummy_outpath'

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockResolvedValue({ workspace: mocks.mockLoadWorkspace(workspaceDir),
    errored: false })

  beforeEach(() => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
  })

  it('should run export', async () => {
    await command(workspaceDir, 'Test', outputPath, cliOutput).execute()
    expect(exportToCsv).toHaveBeenCalled()
    expect(cliOutput.stdout.content).toMatch(Prompts.EXPORT_ENDED_SUMMARY(5, 'Test', outputPath))
  })

  it('should fail on workspace errors', async () => {
    const erroredWorkspace = {
      hasErrors: () => true,
      errors: { strings: () => ['some error'] },
      getWorkspaceErrors: mocks.getWorkspaceErrors,
    } as unknown as Workspace
    mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })
    const result = await command(workspaceDir, 'Test', outputPath, cliOutput).execute()
    expect(result).toBe(CliExitCode.AppError)
  })

  it('should fail if export operation failed', async () => {
    const errors = ['error1', 'error2']
    const erroredModifyDataResult = {
      successfulRows: 1,
      failedRows: 0,
      errors: new Set<string>(errors),
    } as unknown as DataModificationResult
    (exportToCsv as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredModifyDataResult))
    const exitCode = await command(workspaceDir, 'Test', outputPath, cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.EXPORT_ENDED_SUMMARY(1, 'Test', outputPath))
    expect(cliOutput.stdout.content).toMatch(Prompts.ERROR_SUMMARY(errors))
    expect(exitCode).toEqual(CliExitCode.AppError)
  })
})
