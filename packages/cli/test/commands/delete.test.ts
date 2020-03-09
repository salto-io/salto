/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { DataModificationResult } from '@salto-io/adapter-api'
import { Workspace, file, deleteFromCsvFile } from '@salto-io/core'
import { command } from '../../src/commands/delete'
import Prompts from '../../src/prompts'
import { CliExitCode } from '../../src/types'
import * as workspace from '../../src/workspace'
import * as mocks from '../mocks'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
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
    mockLoadWorkspace.mockResolvedValue({
      workspace: mocks.mockLoadWorkspace(workspaceDir),
      errored: false,
    })
  })

  it('should run delete successfully if CSV file is found', async () => {
    existsReturn = true
    await command(workspaceDir, 'mockName', 'mockPath', mocks.mockTelemetry, cliOutput).execute()
    expect(deleteFromCsvFile).toHaveBeenCalled()
    expect(cliOutput.stdout.content).toMatch(Prompts.DELETE_ENDED_SUMMARY(5, 0))
    expect(cliOutput.stdout.content).toMatch(Prompts.DELETE_FINISHED_SUCCESSFULLY)
  })

  it('should fail if CSV file is not found', async () => {
    existsReturn = false
    await command(workspaceDir, '', '', mocks.mockTelemetry, cliOutput).execute()
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
    const result = await command(
      workspaceDir,
      'mockName',
      'mockPath',
      mocks.mockTelemetry,
      cliOutput,
    ).execute()
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
    const exitCode = await command(
      workspaceDir,
      'mockName',
      'mockPath',
      mocks.mockTelemetry,
      cliOutput,
    ).execute()
    expect(exitCode).toEqual(CliExitCode.AppError)
    expect(cliOutput.stdout.content).toMatch(Prompts.ERROR_SUMMARY(errors))
  })
})
