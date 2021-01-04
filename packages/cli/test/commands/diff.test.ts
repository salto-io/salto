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
import { diff, loadLocalWorkspace } from '@salto-io/core'
import { CliExitCode, CliTelemetry } from '../../src/types'
import { diffAction } from '../../src/commands/env'
import { expectElementSelector } from '../utils'
import * as mocks from '../mocks'
import * as mockCliWorkspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'

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
  let cliTelemetry: CliTelemetry

  describe('with invalid source environment', () => {
    const workspaceName = 'valid-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    telemetry = mocks.getMockTelemetry()
    cliTelemetry = getCliTelemetry(telemetry, commandName)
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
        cliTelemetry,
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
    cliTelemetry = getCliTelemetry(telemetry, commandName)
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
        cliTelemetry,
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
      cliTelemetry = getCliTelemetry(telemetry, commandName)
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
        cliTelemetry,
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
      cliTelemetry = getCliTelemetry(telemetry, commandName)
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
        cliTelemetry,
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
      cliTelemetry = getCliTelemetry(telemetry, commandName)
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
        cliTelemetry,
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
      cliTelemetry = getCliTelemetry(telemetry, commandName)
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
        cliTelemetry,
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
      cliTelemetry = getCliTelemetry(telemetry, commandName)
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
        cliTelemetry,
        config,
        workspacePath: workspaceName,
      })
    })

    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.UserInputError)
    })
  })
})
