import { Workspace, file, importFromCsvFile } from 'salto'
import * as mocks from '../mocks'
import { command } from '../../src/commands/import'
import Prompts from '../../src/prompts'
import { CliExitCode } from '../../src/types'
import * as workspace from '../../src/workspace'

jest.mock('salto', () => ({
  ...jest.requireActual('salto'),
  importFromCsvFile: jest.fn().mockImplementation(typeName =>
    (typeName === 'error-type'
      ? Promise.resolve({
        successfulRows: 0,
        failedRows: 5,
        errors: new Set<string>(['error1', 'error2']),
      })
      : Promise.resolve({
        successfulRows: 5,
        failedRows: 0,
        errors: new Set<string>(),
      }))),
}))
jest.mock('../../src/workspace')
describe('import command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const workspaceDir = 'dummy_dir'

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockResolvedValue({ workspace: mocks.mockLoadWorkspace(workspaceDir),
    errored: false })

  beforeEach(() => {
    jest.spyOn(file, 'exists').mockResolvedValue(true)
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
  })

  it('should run import successfully if given a correct path to a real CSV file', async () => {
    await command(workspaceDir, 'mockName', 'mockPath', cliOutput).execute()
    expect(importFromCsvFile).toHaveBeenCalled()
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_ENDED_SUMMARY(5, 0))
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
  })

  it('should fail if given a wrong path for a CSV file', async () => {
    jest.spyOn(file, 'exists').mockResolvedValueOnce(false)
    await command(workspaceDir, '', '', cliOutput).execute()
    expect(cliOutput.stderr.content).toMatch(Prompts.COULD_NOT_FIND_FILE)
  })
  it('should fail if workspace load failed', async () => {
    const erroredWorkspace = {
      hasErrors: () => true,
      errors: { strings: () => ['some error'] },
      getWorkspaceErrors: mocks.getWorkspaceErrors,
    } as unknown as Workspace
    mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })
    const result = await command(workspaceDir, '', '', cliOutput).execute()
    expect(result).toBe(CliExitCode.AppError)
  })

  it('should fail if import operation failed', async () => {
    const exitCode = await command(workspaceDir, 'error-type', '', cliOutput).execute()
    expect(exitCode).toEqual(CliExitCode.AppError)
    expect(cliOutput.stdout.content).toMatch(Prompts.ERROR_SUMMARY(['error1', 'error2']))
  })
})
