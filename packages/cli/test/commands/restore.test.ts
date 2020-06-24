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
import { restore } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { Spinner, SpinnerCreator, CliExitCode } from '../../src/types'
import { command } from '../../src/commands/restore'
import * as mocks from '../mocks'
import * as mockCliWorkspace from '../../src/workspace/workspace'
import { buildEventName } from '../../src/telemetry'

const commandName = 'restore'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
  changes: buildEventName(commandName, 'changes'),
  changesToApply: buildEventName(commandName, 'changesToApply'),
  workspaceSize: buildEventName(commandName, 'workspaceSize'),
}

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  restore: jest.fn().mockImplementation(() => Promise.resolve({
    changes: [],
  })),
}))
jest.mock('../../src/workspace/workspace')
describe('restore command', () => {
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const mockLoadWorkspace = mockCliWorkspace.loadWorkspace as jest.Mock
  const mockApplyChangesToWorkspace = mockCliWorkspace.applyChangesToWorkspace as jest.Mock
  const mockUpdateWorkspace = mockCliWorkspace.updateWorkspace as jest.Mock
  const mockUpdateStateOnly = mockCliWorkspace.updateStateOnly as jest.Mock
  mockApplyChangesToWorkspace.mockImplementation(
    ({ workspace, output, changes, isIsolated }) => (
      mockUpdateWorkspace(workspace, output, changes, isIsolated)
    )
  )
  mockUpdateWorkspace.mockImplementation(ws =>
    Promise.resolve(ws.name !== 'exist-on-error'))
  const findWsUpdateCalls = (name: string): unknown[][][] =>
    mockUpdateWorkspace.mock.calls.filter(args => args[0].name === name)
  mockUpdateStateOnly.mockResolvedValue(true)

  beforeEach(() => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    spinners = []
    spinnerCreator = mocks.mockSpinnerCreator(spinners)
  })

  let result: number
  let mockTelemetry: mocks.MockTelemetry
  describe('with errored workspace', () => {
    beforeEach(async () => {
      mockTelemetry = mocks.getMockTelemetry()
      const erroredWorkspace = {
        hasErrors: () => true,
        errors: { strings: () => ['some error'] },
        config: { services },
      } as unknown as Workspace
      mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })
      result = await command('', true, false, mockTelemetry, cliOutput, spinnerCreator, false, true, services)
        .execute()
    })

    it('should fail', async () => {
      expect(result).toBe(CliExitCode.AppError)
      expect(restore).not.toHaveBeenCalled()
      expect(mockTelemetry.getEvents().length).toEqual(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure][0].value).toEqual(1)
    })
  })

  describe('with valid workspace', () => {
    const workspaceName = 'valid-ws'
    beforeAll(async () => {
      mockTelemetry = mocks.getMockTelemetry()
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace(workspaceName),
        errored: false,
      })
      result = await command(
        workspaceName,
        true, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        true,
        services,
      ).execute()
    })

    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call restore', () => {
      expect(restore).toHaveBeenCalled()
    })

    it('should update changes', () => {
      const calls = findWsUpdateCalls(workspaceName)
      expect(calls).toHaveLength(1)
    })

    it('should send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
    })
  })
  describe('Verify using env command', () => {
    const workspaceDir = 'valid-ws'
    beforeEach(() => {
      mockLoadWorkspace.mockImplementation(mocks.mockLoadWorkspaceEnvironment)
      mockLoadWorkspace.mockClear()
    })
    it('should use current env when env is not provided', async () => {
      await command(
        workspaceDir,
        true, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        true,
        services,
      ).execute()
      expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
      expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv()).toEqual(
        mocks.withoutEnvironmentParam
      )
    })
    it('should use provided env', async () => {
      await command(
        workspaceDir,
        true, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        true,
        services,
        mocks.withEnvironmentParam,
      ).execute()
      expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
      expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv()).toEqual(
        mocks.withEnvironmentParam
      )
    })
  })

  describe('should return error when update workspace fails', () => {
    beforeAll(async () => {
      mockTelemetry = mocks.getMockTelemetry()
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace('exist-on-error'),
        errored: false,
      })
      result = await command(
        'exist-on-error',
        true, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        true,
        services,
      ).execute()
    })

    it('should return success code', () => {
      expect(result).toBe(CliExitCode.AppError)
    })
  })
  describe('using id filters', () => {
    const workspaceName = 'valid-ws'
    beforeAll(async () => {
      mockTelemetry = mocks.getMockTelemetry()
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace(workspaceName),
        errored: false,
      })
    })
    it('should fail when invalid filters are provided', async () => {
      result = await command(
        workspaceName,
        true, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        true,
        services,
        undefined,
        ['++']
      ).execute()
      expect(result).toBe(CliExitCode.UserInputError)
    })
    it('should succeed when invalid filters are provided', async () => {
      result = await command(
        workspaceName,
        true, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        true,
        services,
        undefined,
        ['salto']
      ).execute()
      expect(result).toBe(CliExitCode.Success)
    })
  })
})
