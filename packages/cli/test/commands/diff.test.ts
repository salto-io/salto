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
import { diff } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { Spinner, SpinnerCreator, CliExitCode, CliTelemetry } from '../../src/types'
import { command } from '../../src/commands/diff'

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
}))
jest.mock('../../src/workspace/workspace')
describe('diff command', () => {
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
  mockUpdateStateOnly.mockResolvedValue(true)

  beforeEach(() => {
    spinners = []
    spinnerCreator = mocks.mockSpinnerCreator(spinners)
  })

  let result: number
  let mockTelemetry: mocks.MockTelemetry
  let mockCliTelemetry: CliTelemetry
  describe('with errored workspace', () => {
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'diff')
      const erroredWorkspace = {
        hasErrors: () => true,
        errors: { strings: () => ['some error'] },
        config: { services },
      } as unknown as Workspace
      mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })

      result = await command(
        '',
        true,
        false,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        'other',
        false,
        false,
      ).execute()
    })

    it('should fail', async () => {
      expect(result).toBe(CliExitCode.AppError)
      expect(diff).not.toHaveBeenCalled()
      expect(mockTelemetry.getEvents().length).toEqual(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure][0].value).toEqual(1)
    })
  })

  describe('with valid workspace', () => {
    const workspaceName = 'valid-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'diff')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        true,
        false,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        'other',
        false,
        false,
      ).execute()
    })


    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
      expect(mockTelemetry.getEvents().length).toEqual(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.success][0].value).toEqual(1)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'other', false, false, undefined, [])
    })
  })

  describe('with show hidden types flag', () => {
    const workspaceName = 'hidden-types-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'diff')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        true,
        false,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        'other',
        true,
        false,
      ).execute()
    })


    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
      expect(mockTelemetry.getEvents().length).toEqual(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.success][0].value).toEqual(1)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'other', true, false, undefined, [])
    })
  })

  describe('with state only flag', () => {
    const workspaceName = 'hidden-types-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'diff')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        true,
        false,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        'other',
        false,
        true,
      ).execute()
    })


    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
      expect(mockTelemetry.getEvents().length).toEqual(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.success][0].value).toEqual(1)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'other', false, true, undefined, [])
    })
  })

  describe('with id filters', () => {
    const workspaceName = 'hidden-types-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const regex = 'account.*'
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'diff')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        true,
        false,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        'other',
        false,
        true,
        undefined,
        undefined,
        [regex]
      ).execute()
    })


    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.Success)
      expect(mockTelemetry.getEvents().length).toEqual(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.success][0].value).toEqual(1)
    })
    it('should invoke the diff api command', async () => {
      expect(diff).toHaveBeenCalledWith(workspace, 'other', false, true, undefined, [new RegExp(regex)])
    })
  })

  describe('with invalid id filters', () => {
    const workspaceName = 'hidden-types-workspace'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const regex = '['
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'diff')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        true,
        false,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        'other',
        false,
        true,
        undefined,
        undefined,
        [regex]
      ).execute()
    })


    it('should return success status', async () => {
      expect(result).toBe(CliExitCode.UserInputError)
    })
  })
})
