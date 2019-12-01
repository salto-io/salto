import { Workspace, loadConfig, file, importFromCsvFile, ModifyDataResult } from 'salto'
import { MockWriteStream, getWorkspaceErrors } from '../mocks'
import { command } from '../../src/commands/import'
import Prompts from '../../src/prompts'

jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  importFromCsvFile: jest.fn().mockImplementation(() => Promise.resolve({
    success: true,
    Errors: [],
  })),
  Workspace: {
    load: jest.fn().mockImplementation(
      config => ({ config, elements: [], hasErrors: () => false }),
    ),
  },
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => ({ baseDir: workspaceDir, additionalBlueprints: [], cacheLocation: '' })
  ),
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
    const erroredModifyDataResult = {
      success: false,
      Errors: [],
    } as unknown as ModifyDataResult
    (importFromCsvFile as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredModifyDataResult))
    await command(workspaceDir, '', '', cliOutput).execute()
    expect(Workspace.load).toHaveBeenCalledWith(loadConfig(workspaceDir))
    expect(cliOutput.stderr.content).toContain(Prompts.OPERATION_FAILED)
  })
})
