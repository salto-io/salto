import { Workspace, loadConfig, file, importFromCsvFile } from 'salto'
import { DataModificationResult } from 'adapter-api'
import { MockWriteStream, getWorkspaceErrors, mockLoadConfig } from '../mocks'
import { command } from '../../src/commands/import'
import Prompts from '../../src/prompts'
import { CliExitCode } from '../../src/types'

jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  importFromCsvFile: jest.fn().mockImplementation(() => Promise.resolve({
    successfulRows: 5,
    failedRows: 0,
    errors: new Set<string>(),
  })),
  Workspace: {
    load: jest.fn().mockImplementation(
      config => ({ config, elements: [], hasErrors: () => false }),
    ),
  },
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) => mockLoadConfig(workspaceDir)),
}))

describe('import command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  const workspaceDir = 'dummy_dir'
  let existsReturn = true

  beforeEach(() => {
    jest.spyOn(file, 'exists').mockImplementation(() => Promise.resolve(existsReturn))
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  })

  it('should run import successfully if given a correct path to a real CSV file', async () => {
    existsReturn = true
    await command(workspaceDir, 'mockName', 'mockPath', cliOutput).execute()
    expect(importFromCsvFile).toHaveBeenCalled()
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_ENDED_SUMMARY(5, 0))
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
    expect(Workspace.load).toHaveBeenCalledWith(loadConfig(workspaceDir))
  })

  it('should fail if given a wrong path for a CSV file', async () => {
    existsReturn = false
    await command(workspaceDir, '', '', cliOutput).execute()
    expect(cliOutput.stderr.content).toMatch(Prompts.COULD_NOT_FIND_FILE)
  })
  it('should fail if workspace load failed', async () => {
    existsReturn = true
    const erroredWorkspace = {
      hasErrors: () => true,
      errors: { strings: () => ['some error'] },
      getWorkspaceErrors,
    } as unknown as Workspace
    (Workspace.load as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredWorkspace))
    await command(workspaceDir, '', '', cliOutput).execute()
    expect(Workspace.load).toHaveBeenCalledWith(loadConfig(workspaceDir))
    expect(cliOutput.stderr.content).toContain('Error')
  })

  it('should fail if import operation failed', async () => {
    existsReturn = true
    const errors = ['error1', 'error2']
    const erroredModifyDataResult = {
      successfulRows: 0,
      failedRows: 5,
      errors: new Set<string>(errors),
    } as unknown as DataModificationResult
    (importFromCsvFile as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredModifyDataResult))
    const exitCode = await command(workspaceDir, '', '', cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.ERROR_SUMMARY(errors))
    expect(Workspace.load).toHaveBeenCalledWith(loadConfig(workspaceDir))
    expect(exitCode).toEqual(CliExitCode.AppError)
  })
})
