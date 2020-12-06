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
import { diff, loadLocalWorkspace } from '@salto-io/core'
import { CliExitCode } from '../../src/types'
import envDef from '../../src/commands/env'
import { expectElementSelector, getSubCommandAction } from '../utils'
import * as mocks from '../mocks'
import * as mockCliWorkspace from '../../src/workspace/workspace'
import { buildEventName } from '../../src/telemetry'
import { CommandAction } from '../../src/command_builder'

const { subCommands } = envDef

const commandName = 'diff'
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
  diff: jest.fn().mockImplementation(() => Promise.resolve([])),
  loadLocalWorkspace: jest.fn(),
}))
jest.mock('../../src/workspace/workspace')
describe('diff command', () => {
  let output: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const mockApplyChangesToWorkspace = mockCliWorkspace.applyChangesToWorkspace as jest.Mock
  const mockUpdateWorkspace = mockCliWorkspace.updateWorkspace as jest.Mock
  const mockUpdateStateOnly = mockCliWorkspace.updateStateOnly as jest.Mock
  const config = { shouldCalcTotalSize: true }
  mockApplyChangesToWorkspace.mockImplementation(
    ({ workspace, output: cliOutput, changes, isIsolated }) => (
      mockUpdateWorkspace(workspace, cliOutput, changes, isIsolated)
    )
  )
  mockUpdateWorkspace.mockImplementation(ws =>
    Promise.resolve(ws.name !== 'exist-on-error'))
  mockUpdateStateOnly.mockResolvedValue(true)
  const mockLoadWorkspace = loadLocalWorkspace as jest.Mock

  let result: number
  let telemetry: mocks.MockTelemetry

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  let diffAction: CommandAction<any>
  beforeAll((() => {
    const diffSubCommandAction = getSubCommandAction(subCommands, commandName)
    expect(diffSubCommandAction).toBeDefined()
    if (diffSubCommandAction !== undefined) {
      diffAction = diffSubCommandAction
    }
  }))
  describe('with invalid source environment', () => {
    const workspaceName = 'valid-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    telemetry = mocks.getMockTelemetry()
    mockLoadWorkspace.mockResolvedValue(workspace)
    it('should throw Error', async () => {
      result = await diffAction({
        input: {
          fromEnv: 'NotExist',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: false,
        },
        output,
        telemetry,
        config,
        workspacePath: workspaceName,
      })
      expect(result).toBe(CliExitCode.UserInputError)
    })
  })

  describe('with invalid destination environment', () => {
    const workspaceName = 'valid-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    telemetry = mocks.getMockTelemetry()
    mockLoadWorkspace.mockResolvedValue(workspace)
    it('should throw Error', async () => {
      result = await diffAction({
        input: {
          fromEnv: 'active',
          toEnv: 'NotExist',
          detailedPlan: true,
          hidden: false,
          state: false,
        },
        output,
        telemetry,
        config,
        workspacePath: workspaceName,
      })
      expect(result).toBe(CliExitCode.UserInputError)
    })
  })

  describe('with valid workspace', () => {
    const workspaceName = 'valid-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    beforeAll(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      mockLoadWorkspace.mockResolvedValue(workspace)
      result = await diffAction({
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: false,
        },
        output,
        telemetry,
        config,
        workspacePath: workspaceName,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
      expect(telemetry.getEvents().length).toEqual(2)
      expect(telemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.success][0].value).toEqual(1)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'active', 'inactive', false, false, workspace.services(), [])
    })
  })

  describe('with show hidden types flag', () => {
    const workspaceName = 'hidden-types-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    beforeAll(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      mockLoadWorkspace.mockResolvedValue(workspace)
      await diffAction({
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: true,
          state: false,
        },
        output,
        telemetry,
        config,
        workspacePath: workspaceName,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
      expect(telemetry.getEvents().length).toEqual(2)
      expect(telemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.success][0].value).toEqual(1)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'active', 'inactive', true, false, workspace.services(), [])
    })
  })

  describe('with state only flag', () => {
    const workspaceName = 'hidden-types-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    beforeAll(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      mockLoadWorkspace.mockResolvedValue(workspace)
      result = await diffAction({
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: true,
        },
        output,
        telemetry,
        config,
        workspacePath: workspaceName,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
      expect(telemetry.getEvents().length).toEqual(2)
      expect(telemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.success][0].value).toEqual(1)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'active', 'inactive', false, true, workspace.services(), [])
    })
  })

  describe('with id filters', () => {
    const workspaceName = 'hidden-types-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const regex = 'account.*'
    beforeAll(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      mockLoadWorkspace.mockResolvedValue(workspace)
      result = await diffAction({
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: true,
          elementSelector: [regex],
        },
        output,
        telemetry,
        config,
        workspacePath: workspaceName,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
      expect(telemetry.getEvents().length).toEqual(2)
      expect(telemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.success][0].value).toEqual(1)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'active', 'inactive',
        false, true, workspace.services(), expectElementSelector(regex))
    })
  })

  describe('with invalid id filters', () => {
    const workspaceName = 'hidden-types-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const regex = '['
    beforeAll(async () => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      mockLoadWorkspace.mockResolvedValue(workspace)
      result = await diffAction({
        input: {
          fromEnv: 'active',
          toEnv: 'inactive',
          detailedPlan: true,
          hidden: false,
          state: true,
          elementSelector: [regex],
        },
        output,
        telemetry,
        config,
        workspacePath: workspaceName,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.UserInputError)
    })
  })
})
