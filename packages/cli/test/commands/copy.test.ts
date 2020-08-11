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
import { Workspace } from '@salto-io/workspace'
import { ElemID } from '@salto-io/adapter-api'
import { Spinner, SpinnerCreator, CliExitCode, CliTelemetry } from '../../src/types'
import { command } from '../../src/commands/copy'

import * as mocks from '../mocks'
import * as mockCliWorkspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'

const commandName = 'copy'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
}

jest.mock('../../src/workspace/workspace')
describe('copy command', () => {
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const mockLoadWorkspace = mockCliWorkspace.loadWorkspace as jest.Mock

  beforeEach(() => {
    spinners = []
    spinnerCreator = mocks.mockSpinnerCreator(spinners)
  })

  let result: number
  let mockTelemetry: mocks.MockTelemetry
  let mockCliTelemetry: CliTelemetry
  describe('with errored workspace', () => {
    beforeEach(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'copy')
      const erroredWorkspace = {
        hasErrors: () => true,
        errors: { strings: () => ['some error'] },
        config: { services },
      } as unknown as Workspace
      mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })

      result = await command(
        '',
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        []
      ).execute()
    })

    it('should fail', async () => {
      expect(result).toBe(CliExitCode.AppError)
      expect(mockTelemetry.getEvents().length).toEqual(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure][0].value).toEqual(1)
    })
  })


  describe('with valid workspace', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const selector = new ElemID('salto', 'Account')
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'copy')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        [selector.getFullName()]
      ).execute()
    })


    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call workspace copyTo', () => {
      expect(workspace.copyTo).toHaveBeenCalledWith([selector], undefined)
    })

    it('should flush workspace', () => {
      expect(workspace.flush).toHaveBeenCalled()
    })

    it('should send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
    })

    it('should print copy to console', () => {
      expect(cliOutput.stdout.content).toContain('Copying the selected elements to all environments.')
      expect(cliOutput.stdout.content).toContain('Done copying elements.')
    })
  })

  describe('with valid workspace and specific env', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const selector = new ElemID('salto', 'Account')
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'copy')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        [selector.getFullName()],
        ['inactive'],
      ).execute()
    })


    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call workspace copyTo', () => {
      expect(workspace.copyTo).toHaveBeenCalledWith([selector], ['inactive'])
    })

    it('should flush workspace', () => {
      expect(workspace.flush).toHaveBeenCalled()
    })

    it('should send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
    })

    it('should print copy to console', () => {
      expect(cliOutput.stdout.content).toContain('Copying the selected elements to inactive.')
      expect(cliOutput.stdout.content).toContain('Done copying elements.')
    })
  })
  describe('with invalid input', () => {
    const workspaceName = 'invalid-input'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'copy')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        ['a.b.c.d']
      ).execute()
    })


    it('should return failure code', () => {
      expect(result).toBe(CliExitCode.UserInputError)
    })
    it('should not call workspace copyTo', () => {
      expect(workspace.copyTo).not.toHaveBeenCalled()
    })

    it('should not flush workspace', () => {
      expect(workspace.flush).not.toHaveBeenCalled()
    })

    it('should not send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(0)
    })

    it('should print copy to console', () => {
      expect(cliOutput.stdout.content).toContain('Failed to created element ID filters')
    })
  })
  describe('with invalid envs', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const selector = new ElemID('salto', 'Account')
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'copy')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        [selector.getFullName()],
        ['inactive', 'unknown'],
      ).execute()
    })


    it('should return failure code', () => {
      expect(result).toBe(CliExitCode.UserInputError)
    })
    it('should send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
    })

    it('should print failure to console', () => {
      expect(cliOutput.stdout.content)
        .toContain('Unknown target environment')
    })
  })
  describe('with current env as target env', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const selector = new ElemID('salto', 'Account')
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'copy')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        [selector.getFullName()],
        ['active'],
      ).execute()
    })


    it('should return failure code', () => {
      expect(result).toBe(CliExitCode.UserInputError)
    })
    it('should send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
    })

    it('should print failure to console', () => {
      expect(cliOutput.stdout.content)
        .toContain('The current environment cannot be a target environment')
    })
  })
  describe('when workspace throws an error', () => {
    const workspaceName = 'unexpected-error'
    const workspace = {
      ...mocks.mockLoadWorkspace(workspaceName),
      flush: async () => {
        throw new Error('Oy Vey Zmir')
      },
    }
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'copy')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        false,
        ['salto.Account']
      ).execute()
    })


    it('should return failure code', () => {
      expect(result).toBe(CliExitCode.AppError)
    })

    it('should send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
    })

    it('should print failure to console', () => {
      expect(cliOutput.stdout.content)
        .toContain('Failed to copy the selected elements to the target environments')
    })
  })
})
