import { Workspace, file, deleteFromCsvFile } from 'salto'
import { DataModificationResult } from 'adapter-api'
import { command } from '../../src/commands/delete'
import Prompts from '../../src/prompts'
import { CliExitCode } from '../../src/types'
import * as workspace from '../../src/workspace'
import * as mocks from '../mocks'

jest.mock('salto', () => ({
  ...jest.requireActual('salto'),
  deleteFromCsvFile: jest.fn().mockImplementation(() => Promise.resolve({
    successfulRows: 5,
    failedRows: 0,
    errors: new Set<string>(),
  })),
}))
jest.mock('../../src/workspace')
describe('delete command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const workspaceDir = 'dummy_dir'
  let existsReturn = true
  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock

  beforeEach(() => {
    jest.spyOn(file, 'exists').mockImplementation(() => Promise.resolve(existsReturn))
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    mockLoadWorkspace.mockResolvedValue({ workspace: mocks.mockLoadWorkspace(workspaceDir),
      errored: false })
  })

  it('should run delete successfully if CSV file is found', async () => {
    existsReturn = true
    await command(workspaceDir, 'mockName', 'mockPath', cliOutput).execute()
    expect(deleteFromCsvFile).toHaveBeenCalled()
    expect(cliOutput.stdout.content).toMatch(Prompts.DELETE_ENDED_SUMMARY(5, 0))
    expect(cliOutput.stdout.content).toMatch(Prompts.DELETE_FINISHED_SUCCESSFULLY)
  })

  it('should fail if CSV file is not found', async () => {
    existsReturn = false
    await command(workspaceDir, '', '', cliOutput).execute()
    expect(cliOutput.stderr.content).toMatch(Prompts.COULD_NOT_FIND_FILE)
  })
  it('should fail if workspace load failed', async () => {
    existsReturn = true
    const erroredWorkspace = {
      hasErrors: () => true,
      errors: { strings: () => ['some error'] },
      getWorkspaceErrors: mocks.getWorkspaceErrors,
    } as unknown as Workspace
    mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })
    const result = await command(workspaceDir, 'mockName', 'mockPath', cliOutput).execute()
    expect(result).toBe(CliExitCode.AppError)
  })

  it('should fail if delete operation failed', async () => {
    existsReturn = true
    const errors = ['error1', 'error2']
    const erroredModifyDataResult = {
      successfulRows: 0,
      failedRows: 5,
      errors: new Set<string>(errors),
    } as unknown as DataModificationResult
    (deleteFromCsvFile as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredModifyDataResult))
    const exitCode = await command(workspaceDir, 'mockName', 'mockPath', cliOutput).execute()
    expect(exitCode).toEqual(CliExitCode.AppError)
    expect(cliOutput.stdout.content).toMatch(Prompts.ERROR_SUMMARY(errors))
  })
})
