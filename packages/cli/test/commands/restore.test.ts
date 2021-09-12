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
import { CliExitCode } from '../../src/types'
import { action } from '../../src/commands/restore'

import * as mocks from '../mocks'
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
  ...jest.requireActual<{}>('@salto-io/core'),
  restore: jest.fn().mockImplementation(() => Promise.resolve([])),
}))

describe('restore command', () => {
  const services = ['salesforce']
  let cliCommandArgs: mocks.MockCommandArgs
  let telemetry: mocks.MockTelemetry
  let output: mocks.MockCliOutput
  let mockRestore: jest.MockedFunction<typeof restore>

  beforeEach(() => {
    const cliArgs = mocks.mockCliArgs()
    cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
    telemetry = cliArgs.telemetry
    output = cliArgs.output
    mockRestore = restore as typeof mockRestore
    mockRestore.mockReset()
    mockRestore.mockResolvedValue(
      mocks.dummyChanges.map(change => ({ change, serviceChange: change }))
    )
  })

  describe('with errored workspace', () => {
    let result: number
    beforeEach(async () => {
      const workspace = mocks.mockWorkspace({})
      workspace.errors.mockResolvedValue(
        mocks.mockErrors([{ severity: 'Error', message: 'some error' }])
      )
      result = await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
        },
        workspace,
      })
    })

    it('should fail', async () => {
      expect(result).toBe(CliExitCode.AppError)
      expect(restore).not.toHaveBeenCalled()
    })
  })

  describe('with valid workspace', () => {
    let result: number
    let workspace: Workspace
    beforeEach(async () => {
      workspace = mocks.mockWorkspace({})
      jest.spyOn(workspace, 'updateNaclFiles').mockResolvedValue({
        naclFilesChangesCount: 2,
        stateOnlyChangesCount: 0,
      })

      result = await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
        },
        workspace,
      })
    })

    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call restore', () => {
      expect(restore).toHaveBeenCalled()
    })

    it('should update changes', () => {
      expect(workspace.updateNaclFiles).toHaveBeenCalledWith(mocks.dummyChanges, 'default')
    })

    it('should send telemetry events', () => {
      expect(telemetry.getEventsMap()[eventsNames.changesToApply]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.workspaceSize]).toHaveLength(1)
    })

    it('should print deployment to console', () => {
      expect(output.stdout.content).toContain('Finished calculating the difference')
      expect(output.stdout.content).toContain('2 changes were applied to the local workspace')
      expect(output.stdout.content).toContain('Done!')
    })
  })
  describe('Verify using env command', () => {
    it('should use current env when env is not provided', async () => {
      const workspace = mocks.mockWorkspace({})
      await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
        },
        workspace,
      })
      expect(workspace.setCurrentEnv).not.toHaveBeenCalled()
    })
    it('should use provided env', async () => {
      const workspace = mocks.mockWorkspace({})
      await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
          env: mocks.withEnvironmentParam,
        },
        workspace,
      })
      expect(workspace.setCurrentEnv).toHaveBeenCalledWith(mocks.withEnvironmentParam, false)
    })
  })

  describe('dry-run', () => {
    let result: number
    let workspace: Workspace
    beforeEach(async () => {
      workspace = mocks.mockWorkspace({})
      result = await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: true,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
        },
        workspace,
      })
    })

    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call restore', () => {
      expect(restore).toHaveBeenCalled()
    })

    it('should not update changes', () => {
      expect(workspace.updateNaclFiles).not.toHaveBeenCalled()
    })

    it('should print plan to console, but not deploy', () => {
      expect(output.stdout.content).toContain('The following changes')
      expect(output.stdout.content).toContain('Finished calculating the difference')
      expect(output.stdout.content).not.toContain('Done!')
    })
  })

  it('should return error when update workspace fails', async () => {
    const workspace = mocks.mockWorkspace({})
    workspace.updateNaclFiles.mockImplementation(async () => {
      workspace.errors.mockResolvedValue(
        mocks.mockErrors([{ severity: 'Error', message: 'some error ' }])
      )
      return { naclFilesChangesCount: 0, stateOnlyChangesCount: 0 }
    })
    const result = await action({
      ...cliCommandArgs,
      input: {
        force: true,
        dryRun: false,
        detailedPlan: false,
        listPlannedChanges: false,
        mode: 'default',
        services,
      },
      workspace,
    })
    expect(result).toBe(CliExitCode.AppError)
  })
  describe('using id filters', () => {
    it('should fail when invalid filters are provided', async () => {
      const result = await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
          elementSelectors: ['++'],
        },
        workspace: mocks.mockWorkspace({}),
      })
      expect(result).toBe(CliExitCode.UserInputError)
    })
    it('should succeed when valid filters are provided', async () => {
      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          services,
          elementSelectors: ['salto.*'],
        },
        workspace: mocks.mockWorkspace({}),
      })
      expect(result).toBe(CliExitCode.Success)
    })
  })
})
