/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Spinner, SpinnerCreator, CliExitCode, CliTelemetry } from '../../src/types'
import { action } from '../../src/commands/restore'

import * as mocks from '../mocks'
import * as mockCliWorkspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'

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
  restore: jest.fn().mockImplementation(() => Promise.resolve([])),
}))
jest.mock('../../src/workspace/workspace')
describe('restore command', () => {
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']
  const config = { shouldCalcTotalSize: true }
  let output: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const mockLoadWorkspace = mockCliWorkspace.loadWorkspace as jest.Mock
  const mockApplyChangesToWorkspace = mockCliWorkspace.applyChangesToWorkspace as jest.Mock
  const mockUpdateWorkspace = mockCliWorkspace.updateWorkspace as jest.Mock
  const mockUpdateStateOnly = mockCliWorkspace.updateStateOnly as jest.Mock
  mockApplyChangesToWorkspace.mockImplementation(
    ({ workspace, output: cliOutput, changes, isIsolated }) => (
      mockUpdateWorkspace(workspace, cliOutput, changes, isIsolated)
    )
  )
  mockUpdateWorkspace.mockImplementation(params =>
    Promise.resolve(params.workspace.name !== 'exist-on-error'))
  const findWsUpdateCalls = (name: string): unknown[][][] =>
    mockUpdateWorkspace.mock.calls.filter(args => args[0].workspace.name === name)
  mockUpdateStateOnly.mockResolvedValue(true)

  beforeEach(() => {
    spinners = []
    spinnerCreator = mocks.mockSpinnerCreator(spinners)
  })

  let result: number
  let telemetry: mocks.MockTelemetry
  let cliTelemetry: CliTelemetry
  describe('with errored workspace', () => {
    beforeEach(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      cliTelemetry = getCliTelemetry(telemetry, commandName)
      const erroredWorkspace = {
        hasErrors: () => true,
        errors: { strings: () => ['some error'] },
        config: { services },
      } as unknown as Workspace
      mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })

      result = await action({
        input: {
          force: true,
          interactive: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
        },
        cliTelemetry,
        output,
        config,
        spinnerCreator,
      })
    })

    it('should fail', async () => {
      expect(result).toBe(CliExitCode.AppError)
      expect(restore).not.toHaveBeenCalled()
      expect(telemetry.getEvents().length).toEqual(1)
      expect(telemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.failure][0].value).toEqual(1)
    })
  })

  describe('with valid workspace', () => {
    const workspacePath = 'valid-ws'
    beforeAll(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      cliTelemetry = getCliTelemetry(telemetry, commandName)
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace(workspacePath),
        errored: false,
      })
      result = await action({
        input: {
          force: true,
          interactive: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
        },
        cliTelemetry,
        output,
        config,
        spinnerCreator,
        workspacePath,
      })
    })

    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call restore', () => {
      expect(restore).toHaveBeenCalled()
    })

    it('should update changes', () => {
      const calls = findWsUpdateCalls(workspacePath)
      expect(calls).toHaveLength(1)
    })

    it('should send telemetry events', () => {
      expect(telemetry.getEvents()).toHaveLength(4)
      expect(telemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.changesToApply]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.workspaceSize]).toHaveLength(1)
    })

    it('should print deployment to console', () => {
      expect(output.stdout.content).toContain('Finished calculating the difference')
      expect(output.stdout.content).toContain('No changes found, workspace is up to date')
      expect(output.stdout.content).toContain('Done!')
    })
  })
  describe('Verify using env command', () => {
    const workspacePath = 'valid-ws'
    beforeEach(() => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockLoadWorkspace.mockImplementation(mocks.mockLoadWorkspaceEnvironment)
      mockLoadWorkspace.mockClear()
    })
    it('should use current env when env is not provided', async () => {
      result = await action({
        input: {
          force: true,
          interactive: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
        },
        cliTelemetry,
        output,
        config,
        spinnerCreator,
        workspacePath,
      })
      expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
      expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv()).toEqual(
        mocks.withoutEnvironmentParam
      )
    })
    it('should use provided env', async () => {
      result = await action({
        input: {
          force: true,
          interactive: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
          env: mocks.withEnvironmentParam,
        },
        cliTelemetry,
        output,
        config,
        spinnerCreator,
        workspacePath,
      })
      expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
      expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv()).toEqual(
        mocks.withEnvironmentParam
      )
    })
  })

  describe('dry-run', () => {
    const workspacePath = 'valid-ws'
    beforeAll(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      cliTelemetry = getCliTelemetry(telemetry, commandName)
      mockUpdateWorkspace.mockClear()
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace(workspacePath),
        errored: false,
      })
      result = await action({
        input: {
          force: true,
          interactive: false,
          dryRun: true,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
        },
        cliTelemetry,
        output,
        config,
        spinnerCreator,
        workspacePath,
      })
    })

    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call restore', () => {
      expect(restore).toHaveBeenCalled()
    })

    it('should not update changes', () => {
      const calls = findWsUpdateCalls(workspacePath)
      expect(calls).toHaveLength(0)
    })

    it('should send telemetry events', () => {
      expect(telemetry.getEvents()).toHaveLength(2)
      expect(telemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
    })

    it('should print plan to console, but not deploy', () => {
      expect(output.stdout.content).toContain('The following changes')
      expect(output.stdout.content).toContain('Finished calculating the difference')
      expect(output.stdout.content).not.toContain('Done!')
    })
  })

  describe('should return error when update workspace fails', () => {
    beforeAll(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      cliTelemetry = getCliTelemetry(telemetry, commandName)
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace('exist-on-error'),
        errored: false,
      })
      result = await action({
        input: {
          force: true,
          interactive: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
        },
        cliTelemetry,
        output,
        config,
        spinnerCreator,
        workspacePath: 'exist-on-error',
      })
    })

    it('should return success code', () => {
      expect(result).toBe(CliExitCode.AppError)
    })
  })
  describe('using id filters', () => {
    const workspacePath = 'valid-ws'
    beforeAll(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      cliTelemetry = getCliTelemetry(telemetry, commandName)
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace(workspacePath),
        errored: false,
      })
    })
    it('should fail when invalid filters are provided', async () => {
      result = await action({
        input: {
          force: true,
          interactive: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
          elementSelectors: ['++'],
        },
        cliTelemetry,
        output,
        config,
        spinnerCreator,
        workspacePath,
      })
      expect(result).toBe(CliExitCode.UserInputError)
    })
    it('should succeed when valid filters are provided', async () => {
      result = await action({
        input: {
          force: true,
          interactive: true, // interactive has no effect when force=true
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
          elementSelectors: ['salto.*'],
        },
        cliTelemetry,
        output,
        config,
        spinnerCreator,
        workspacePath,
      })
      expect(result).toBe(CliExitCode.Success)
    })
  })
})
