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
import { Workspace, exportToCsv } from '@salto-io/core'
import { DataModificationResult } from '@salto-io/adapter-api'
import Prompts from '../../src/prompts'
import * as mocks from '../mocks'
import { command } from '../../src/commands/export'
import { CliExitCode } from '../../src/types'
import * as workspace from '../../src/workspace'
import { getEvents, getCliTelemetry, CliTelemetry } from '../../src/telemetry'

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  exportToCsv: jest.fn().mockImplementation(() => Promise.resolve({
    successfulRows: 5,
    failedRows: 0,
    errors: new Set<string>(),
  })),
}))
jest.mock('../../src/workspace')

const eventsNames = getEvents('export')

describe('export command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  let mockTelemetry: mocks.MockTelemetry
  let mockCliTelemetry: CliTelemetry
  const workspaceDir = 'dummy_dir'
  const outputPath = 'dummy_outpath'

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockResolvedValue({
    workspace: mocks.mockLoadWorkspace(workspaceDir),
    errored: false,
  })

  beforeEach(() => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    mockTelemetry = mocks.getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'export')
  })

  it('should run export', async () => {
    await command(workspaceDir, 'Test', outputPath, mockCliTelemetry, cliOutput).execute()
    expect(exportToCsv).toHaveBeenCalled()
    expect(cliOutput.stdout.content).toMatch(Prompts.EXPORT_ENDED_SUMMARY(5, 'Test', outputPath))
    expect(mockTelemetry.getEvents()).toHaveLength(2)
    expect(mockTelemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
    expect(mockTelemetry.getEventsMap()[eventsNames.success]).not.toBeUndefined()
    expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toBeUndefined()
  })

  it('should fail on workspace errors', async () => {
    const erroredWorkspace = {
      hasErrors: () => true,
      errors: { strings: () => ['some error'] },
      getWorkspaceErrors: mocks.getWorkspaceErrors,
    } as unknown as Workspace
    mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })
    const result = await command(workspaceDir, 'Test', outputPath, mockCliTelemetry, cliOutput).execute()
    expect(result).toBe(CliExitCode.AppError)
    expect(mockTelemetry.getEvents()).toHaveLength(1)
    expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
  })

  it('should fail if export operation failed', async () => {
    const errors = ['error1', 'error2']
    const erroredModifyDataResult = {
      successfulRows: 1,
      failedRows: 0,
      errors: new Set<string>(errors),
    } as unknown as DataModificationResult
    (exportToCsv as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredModifyDataResult))
    const exitCode = await command(workspaceDir, 'Test', outputPath, mockCliTelemetry, cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.EXPORT_ENDED_SUMMARY(1, 'Test', outputPath))
    expect(cliOutput.stdout.content).toMatch(Prompts.ERROR_SUMMARY(errors))
    expect(exitCode).toEqual(CliExitCode.AppError)
    expect(mockTelemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
    expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
    expect(mockTelemetry.getEventsMap()[eventsNames.success]).toBeUndefined()
  })
})
