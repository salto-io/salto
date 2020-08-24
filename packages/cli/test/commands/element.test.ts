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
import { command, ElementArgs } from '../../src/commands/element'

import * as mocks from '../mocks'
import * as mockCliWorkspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'

const commandName = 'element'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
}

jest.mock('../../src/workspace/workspace')
describe('element command', () => {
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
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
      const erroredWorkspace = {
        hasErrors: () => true,
        errors: { strings: () => ['some error'] },
        config: { services },
      } as unknown as Workspace
      mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })
      const commandArgs = {
        command: 'copy',
        fromEnv: 'active',
        toEnvs: ['inactive'],
      } as ElementArgs

      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        commandArgs
      ).execute()
    })

    it('should fail', async () => {
      expect(result).toBe(CliExitCode.AppError)
      expect(mockTelemetry.getEvents().length).toEqual(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure][0].value).toEqual(1)
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
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      const commandArgs = {
        command: 'copy',
        fromEnv: 'active',
        toEnvs: ['inactive'],
        elmSelectors: ['salto.Account'],
      } as ElementArgs
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        commandArgs,
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

  describe('with invalid element selectors', () => {
    const workspaceName = 'invalid-input'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      const commandArgs = {
        command: 'copy',
        fromEnv: 'active',
        toEnvs: ['inactive'],
        elmSelectors: ['a.b.c.d'],
      } as ElementArgs
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        commandArgs,
      ).execute()
    })


    it('should return failure code', () => {
      expect(result).toBe(CliExitCode.UserInputError)
    })
    it('should not call workspace copyTo', () => {
      expect(workspace.copyTo).not.toHaveBeenCalled()
    })
    it('should not call workspace promote', () => {
      expect(workspace.promote).not.toHaveBeenCalled()
    })
    it('should not call workspace demote', () => {
      expect(workspace.demote).not.toHaveBeenCalled()
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

  describe('with invalid element command', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    mockTelemetry = mocks.getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
    mockLoadWorkspace.mockResolvedValue({
      workspace,
      errored: false,
    })
    const commandArgs = {
      command: 'InvalidCommand',
      fromEnv: 'active',
      toEnvs: ['inactive'],
    } as ElementArgs
    it('should fail', async () => {
      await expect(command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        commandArgs,
      ).execute()).rejects.toThrow(Error)
    })
  })

  describe('valid copy', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const selector = new ElemID('salto', 'Account')
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      const commandArgs = {
        command: 'copy',
        fromEnv: 'active',
        toEnvs: ['inactive'],
        elmSelectors: [selector.getFullName()],
      } as ElementArgs
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        commandArgs
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

  describe('copy with invalid envs', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const selector = new ElemID('salto', 'Account')
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      const commandArgs = {
        command: 'copy',
        fromEnv: 'active',
        toEnvs: ['inactive', 'unknown'],
        elmSelectors: [selector.getFullName()],
      } as ElementArgs
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        commandArgs,
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
  describe('copy with current env as target env', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const selector = new ElemID('salto', 'Account')
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      const commandArgs = {
        command: 'copy',
        fromEnv: 'active',
        toEnvs: ['active'],
        elmSelectors: [selector.getFullName()],
      } as ElementArgs
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        commandArgs,
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

  describe('valid move to common', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const selector = new ElemID('salto', 'Account')
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      const commandArgs = {
        command: 'move',
        to: 'common',
        elmSelectors: [selector.getFullName()],
      } as ElementArgs
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        commandArgs,
      ).execute()
    })


    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call workspace promote', () => {
      expect(workspace.promote).toHaveBeenCalledWith([selector])
    })

    it('should flush workspace', () => {
      expect(workspace.flush).toHaveBeenCalled()
    })

    it('should send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
    })

    it('should print deployment to console', () => {
      expect(cliOutput.stdout.content).toContain('Moving the selected elements from envs to common')
      expect(cliOutput.stdout.content).toContain('Done moving elements.')
    })
  })

  describe('valid move to envs', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    const selector = new ElemID('salto', 'Account')
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      const commandArgs = {
        command: 'move',
        to: 'envs',
        elmSelectors: [selector.getFullName()],
      } as ElementArgs
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        commandArgs,
      ).execute()
    })


    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call workspace demote', () => {
      expect(workspace.demote).toHaveBeenCalledWith([selector])
    })

    it('should flush workspace', () => {
      expect(workspace.flush).toHaveBeenCalled()
    })

    it('should send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
    })

    it('should print deployment to console', () => {
      expect(cliOutput.stdout.content).toContain('Moving the selected elements from common to envs.')
      expect(cliOutput.stdout.content).toContain('Done moving elements.')
    })
  })
})
