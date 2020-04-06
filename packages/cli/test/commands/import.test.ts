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
import { Workspace, file, importFromCsvFile } from '@salto-io/core'
import * as mocks from '../mocks'
import { command } from '../../src/commands/import'
import Prompts from '../../src/prompts'
import { CliExitCode, CliTelemetry } from '../../src/types'
import * as workspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'


jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
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
jest.mock('../../src/workspace/workspace')

const commandName = 'import'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
  errors: buildEventName(commandName, 'errors'),
  failedRows: buildEventName(commandName, 'failedRows'),
}

describe('import command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  let mockTelemetry: mocks.MockTelemetry
  let mockCliTelemetry: CliTelemetry
  const workspaceDir = 'dummy_dir'

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockResolvedValue({
    workspace: mocks.mockLoadWorkspace(workspaceDir),
    errored: false,
  })

  beforeEach(() => {
    jest.spyOn(file, 'exists').mockResolvedValue(true)
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    mockTelemetry = mocks.getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'import')
    mockLoadWorkspace.mockClear()
  })

  it('should run import successfully if given a correct path to a real CSV file', async () => {
    await command(workspaceDir, 'mockName', 'mockPath', mockCliTelemetry, cliOutput).execute()
    expect(importFromCsvFile).toHaveBeenCalled()
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_ENDED_SUMMARY(5, 0))
    expect(cliOutput.stdout.content).toMatch(Prompts.IMPORT_FINISHED_SUCCESSFULLY)
    expect(mockTelemetry.getEvents()).toHaveLength(2)
    expect(mockTelemetry.getEventsMap()[eventsNames.success]).not.toBeUndefined()
    expect(mockTelemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
  })

  it('should fail if given a wrong path for a CSV file', async () => {
    jest.spyOn(file, 'exists').mockResolvedValueOnce(false)
    await command(workspaceDir, '', '', mockCliTelemetry, cliOutput).execute()
    expect(cliOutput.stderr.content).toMatch(Prompts.COULD_NOT_FIND_FILE)
    expect(mockTelemetry.getEvents()).toHaveLength(1)
    expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
  })
  it('should fail if workspace load failed', async () => {
    const erroredWorkspace = {
      hasErrors: () => true,
      errors: { strings: () => ['some error'] },
    } as unknown as Workspace
    mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })
    const result = await command(workspaceDir, '', '', mockCliTelemetry, cliOutput).execute()
    expect(result).toBe(CliExitCode.AppError)
    expect(mockTelemetry.getEvents()).toHaveLength(1)
    expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
  })

  it('should fail if import operation failed', async () => {
    const exitCode = await command(workspaceDir, 'error-type', '', mockCliTelemetry, cliOutput).execute()
    expect(exitCode).toEqual(CliExitCode.AppError)
    expect(cliOutput.stdout.content).toMatch(Prompts.ERROR_SUMMARY(['error1', 'error2']))
    expect(mockTelemetry.getEvents()).toHaveLength(4)
    expect(mockTelemetry.getEventsMap()[eventsNames.start]).not.toBeUndefined()
    expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
    expect(mockTelemetry.getEventsMap()[eventsNames.errors]).not.toBeUndefined()
    expect(mockTelemetry.getEventsMap()[eventsNames.errors]).toHaveLength(1)
    expect(mockTelemetry.getEventsMap()[eventsNames.errors][0].value).toEqual(2)

    expect(mockTelemetry.getEventsMap()[eventsNames.failedRows]).not.toBeUndefined()
    expect(mockTelemetry.getEventsMap()[eventsNames.failedRows]).toHaveLength(1)
    expect(mockTelemetry.getEventsMap()[eventsNames.failedRows][0].value).toEqual(5)
  })

  it('should use current env when env is not provided', async () => {
    mockLoadWorkspace.mockImplementation(mocks.mockLoadWorkspaceEnvironment)
    await command(
      workspaceDir,
      'mockName',
      'mockPath',
      getCliTelemetry(mockTelemetry, 'delete'),
      cliOutput,
    ).execute()
    expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
    expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv).toEqual(
      mocks.withoutEnvironmentParam
    )
  })
  it('should use provided env', async () => {
    mockLoadWorkspace.mockImplementation(mocks.mockLoadWorkspaceEnvironment)
    await command(
      workspaceDir,
      'mockName',
      'mockPath',
      getCliTelemetry(mockTelemetry, 'delete'),
      cliOutput,
      mocks.withEnvironmentParam,
    ).execute()
    expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
    expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv).toEqual(
      mocks.withEnvironmentParam
    )
  })
})
