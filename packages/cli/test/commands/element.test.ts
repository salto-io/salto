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
import * as core from '@salto-io/core'
import { ElemID } from '@salto-io/adapter-api'
import { Spinner, SpinnerCreator, CliExitCode, CliTelemetry } from '../../src/types'
import { command } from '../../src/commands/element'

import * as mocks from '../mocks'
import { expectElementSelector } from '../utils'
import * as mockCliWorkspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'
import Prompts from '../../src/prompts'
import { formatTargetEnvRequired } from '../../src/formatter'

const commandName = 'element'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
}

const mockedList: typeof core.listUnresolvedReferences = (_workspace, completeFromEnv) => (
  completeFromEnv !== undefined
    ? Promise.resolve({
      found: [new ElemID('salesforce', 'aaa'), new ElemID('salesforce', 'bbb', 'instance', 'ccc')],
      missing: [],
    })
    : Promise.resolve({
      found: [],
      missing: [new ElemID('salesforce', 'fail')],
    })
)

jest.mock('../../src/workspace/workspace')
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  listUnresolvedReferences: jest.fn().mockImplementation((_ws, env) => mockedList(_ws, env)),
}))
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'clone',
        false,
        ['salto.Account'],
        'active',
        ['incative'],
        undefined,
      ).execute()
    })

    it('should fail', async () => {
      expect(result).toBe(CliExitCode.AppError)
      expect(mockTelemetry.getEvents().length).toEqual(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure][0].value).toEqual(1)
    })
  })

  describe('when workspace throws an error on clone', () => {
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'clone',
        false,
        ['salto.Account'],
        'active',
        ['inactive'],
        undefined,
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
      expect(cliOutput.stderr.content)
        .toContain('Failed to clone the specified elements to the target environments')
    })
  })

  describe('when workspace throws an error on move-to-envs', () => {
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'move-to-envs',
        false,
        ['salto.Account'],
        undefined,
        undefined,
        undefined
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
      expect(cliOutput.stderr.content)
        .toContain(Prompts.MOVE_FAILED('Oy Vey Zmir'))
    })
  })

  describe('when workspace throws an error on move-to-common', () => {
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'move-to-common',
        false,
        ['salto.Account'],
        undefined,
        undefined,
        undefined
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
      expect(cliOutput.stderr.content)
        .toContain(Prompts.MOVE_FAILED('Oy Vey Zmir'))
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'clone',
        false,
        ['a.b.c.d'],
        'active',
        ['inactive'],
        undefined,

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

    it('should print clone to console', () => {
      expect(cliOutput.stderr.content).toContain('Failed to created element ID filters')
    })
  })

  describe('with missing element selectors', () => {
    const workspaceName = 'missing-selectors'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    beforeAll(async () => {
      cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      mockTelemetry = mocks.getMockTelemetry()
      mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
      mockLoadWorkspace.mockResolvedValue({
        workspace,
        errored: false,
      })
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'clone',
        false,
        [],
        'active',
        ['inactive'],
        undefined,

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

    it('should print clone to console', () => {
      expect(cliOutput.stderr.content).toContain('No element selectors specified')
    })
  })

  describe('with clone without to-envs', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    mockTelemetry = mocks.getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
    mockLoadWorkspace.mockResolvedValue({
      workspace,
      errored: false,
    })
    it('should fail', async () => {
      await expect(await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'clone',
        false,
        ['salesforce.Account'],
        undefined,
        ['inactive'],
        undefined,
      ).execute()).toBe(CliExitCode.UserInputError)
    })
  })

  describe('with move-to-common without env option', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    mockTelemetry = mocks.getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
    mockLoadWorkspace.mockResolvedValue({
      workspace,
      errored: false,
    })
    it('should succeed', async () => {
      await expect(await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'move-to-common',
        false,
        ['salesforce.Account'],
        undefined,
        undefined,
        undefined,
      ).execute()).toBe(CliExitCode.Success)
    })
  })

  describe('with move-to-envs without env option', () => {
    const workspaceName = 'valid-ws'
    const workspace = mocks.mockLoadWorkspace(workspaceName)
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    mockTelemetry = mocks.getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
    mockLoadWorkspace.mockResolvedValue({
      workspace,
      errored: false,
    })
    it('should succeed', async () => {
      await expect(await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'move-to-envs',
        false,
        ['salesforce.Account'],
        undefined,
        undefined,
        undefined,
      ).execute()).toBe(CliExitCode.Success)
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
    it('should fail', async () => {
      await expect(await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'InvalidCommand',
        false,
        ['salesforce.Account'],
        'active',
        ['inactive'],
        undefined,
      ).execute()).toBe(CliExitCode.UserInputError)
    })
  })

  describe('valid clone', () => {
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'clone',
        false,
        [selector.getFullName()],
        'active',
        ['inactive'],
        undefined,
      ).execute()
    })


    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call workspace copyTo', () => {
      expect(workspace.copyTo).toHaveBeenCalledWith(expectElementSelector(selector.getFullName()), ['inactive'])
    })

    it('should flush workspace', () => {
      expect(workspace.flush).toHaveBeenCalled()
    })

    it('should send telemetry events', () => {
      expect(mockTelemetry.getEvents()).toHaveLength(2)
      expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
    })

    it('should print clone to console', () => {
      expect(cliOutput.stdout.content).toContain('Cloning the specified elements to inactive.')
    })
  })

  describe('clone with invalid envs', () => {
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'clone',
        false,
        [selector.getFullName()],
        'active',
        ['inactive', 'unknown'],
        undefined,
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
      expect(cliOutput.stderr.content)
        .toContain('Unknown target environment')
    })
  })
  describe('clone with empty list as target envs', () => {
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'clone',
        false,
        [selector.getFullName()],
        'active',
        [],
        undefined
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
      expect(cliOutput.stderr.content)
        .toContain(formatTargetEnvRequired())
    })
  })
  describe('clone with current env as target env', () => {
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'clone',
        false,
        [selector.getFullName()],
        'active',
        ['active'],
        undefined
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
      expect(cliOutput.stderr.content)
        .toContain(Prompts.INVALID_ENV_TARGET_CURRENT)
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'move-to-common',
        false,
        [selector.getFullName()],
        undefined,
        undefined,
        'active',
      ).execute()
    })


    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call workspace promote', () => {
      expect(workspace.promote).toHaveBeenCalledWith(expectElementSelector(selector.getFullName()))
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
      expect(cliOutput.stdout.content).toContain('Moving the specified elements to common')
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
      result = await command(
        '',
        cliOutput,
        mockCliTelemetry,
        spinnerCreator,
        'move-to-envs',
        false,
        [selector.getFullName()],
        undefined,
        undefined,
        'active',
      ).execute()
    })


    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call workspace demote', () => {
      expect(workspace.demote).toHaveBeenCalledWith(expectElementSelector(selector.getFullName()))
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
      expect(cliOutput.stdout.content).toContain('Moving the specified elements to environment-specific folders.')
    })
  })

  describe('list-unresolved', () => {
    const mockListUnresolved = core.listUnresolvedReferences as jest.MockedFunction<
      typeof core.listUnresolvedReferences>

    describe('success - all unresolved references are found in complete-from', () => {
      const workspaceName = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspaceName)
      beforeAll(async () => {
        cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        mockTelemetry = mocks.getMockTelemetry()
        mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await command(
          '',
          cliOutput,
          mockCliTelemetry,
          spinnerCreator,
          'list-unresolved',
          false,
          [],
          'active',
          ['inactive'],
          undefined,
          'inactive',
        ).execute()
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })

      it('should ignore unresolved references when loading the workspace', () => {
        expect(mockLoadWorkspace).toHaveBeenCalledWith('', cliOutput, expect.objectContaining({
          ignoreUnresolvedRefs: true,
        }))
      })
      it('should call listUnresolvedReferences', () => {
        expect(core.listUnresolvedReferences).toHaveBeenCalledWith(workspace, 'inactive')
      })

      it('should send telemetry events', () => {
        expect(mockTelemetry.getEvents()).toHaveLength(2)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      })

      it('should print found to console', () => {
        expect(cliOutput.stdout.content).toContain('The following unresolved references can be copied from inactive:')
        expect(cliOutput.stdout.content).toMatch(/salesforce.aaa(\s*)salesforce.bbb.instance.ccc/)
        expect(cliOutput.stdout.content).not.toContain('The following unresolved references could not be found:')
      })
    })

    describe('success - no unresolved references', () => {
      const workspaceName = 'empty'
      const workspace = mocks.mockLoadWorkspace(workspaceName)
      beforeAll(async () => {
        cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        mockTelemetry = mocks.getMockTelemetry()
        mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        mockListUnresolved.mockImplementationOnce(() => Promise.resolve({
          found: [],
          missing: [],
        }))

        result = await command(
          '',
          cliOutput,
          mockCliTelemetry,
          spinnerCreator,
          'list-unresolved',
          false,
          [],
          'active',
          ['inactive'],
        ).execute()
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call listUnresolvedReferences', () => {
        expect(core.listUnresolvedReferences).toHaveBeenCalledWith(workspace, undefined)
      })

      it('should send telemetry events', () => {
        expect(mockTelemetry.getEvents()).toHaveLength(2)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      })

      it('should print list to console', () => {
        expect(cliOutput.stdout.content).toContain('All references in active were resolved successfully!')
      })
    })

    describe('success - some references do not exist', () => {
      const workspaceName = 'missing'
      const workspace = mocks.mockLoadWorkspace(workspaceName)
      beforeAll(async () => {
        cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        mockTelemetry = mocks.getMockTelemetry()
        mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        mockListUnresolved.mockImplementationOnce(() => Promise.resolve({
          found: [new ElemID('salesforce', 'aaa'), new ElemID('salesforce', 'bbb', 'instance', 'ccc')],
          missing: [new ElemID('salesforce', 'fail')],
        }))

        result = await command(
          '',
          cliOutput,
          mockCliTelemetry,
          spinnerCreator,
          'list-unresolved',
          false,
          [],
          'active',
          ['inactive'],
          undefined,
          'inactive',
        ).execute()
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call listUnresolvedReferences', () => {
        expect(core.listUnresolvedReferences).toHaveBeenCalledWith(workspace, 'inactive')
      })

      it('should send telemetry events', () => {
        expect(mockTelemetry.getEvents()).toHaveLength(2)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.success]).toHaveLength(1)
      })

      it('should print list to console', () => {
        expect(cliOutput.stdout.content).toMatch(/The following unresolved references can be copied from inactive:(\s*)salesforce.aaa(\s*)salesforce.bbb.instance.ccc/)
        expect(cliOutput.stdout.content).toMatch(/The following unresolved references could not be found:(\s*)salesforce.fail/)
      })
    })

    describe('failure - unexpected error', () => {
      const workspaceName = 'fail'
      const workspace = mocks.mockLoadWorkspace(workspaceName)
      beforeAll(async () => {
        cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        mockTelemetry = mocks.getMockTelemetry()
        mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        mockListUnresolved.mockImplementationOnce(() => {
          throw new Error('oh no')
        })

        result = await command(
          '',
          cliOutput,
          mockCliTelemetry,
          spinnerCreator,
          'list-unresolved',
          false,
          [],
          'active',
          ['inactive'],
          undefined,
          'inactive',
        ).execute()
      })

      it('should return failure', () => {
        expect(result).toBe(CliExitCode.AppError)
      })
      it('should call listUnresolvedReferences', () => {
        expect(core.listUnresolvedReferences).toHaveBeenCalledWith(workspace, 'inactive')
      })

      it('should send telemetry events', () => {
        expect(mockTelemetry.getEvents()).toHaveLength(2)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.success]).toBeUndefined()
        expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
      })

      it('should print the error', () => {
        expect(cliOutput.stderr.content).toContain('Failed to list unresolved references: oh no')
      })
    })

    describe('failure - invalid complete-from env', () => {
      const workspaceName = 'not-called'
      const workspace = mocks.mockLoadWorkspace(workspaceName)
      beforeAll(async () => {
        cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        mockTelemetry = mocks.getMockTelemetry()
        mockCliTelemetry = getCliTelemetry(mockTelemetry, 'element')
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await command(
          '',
          cliOutput,
          mockCliTelemetry,
          spinnerCreator,
          'list-unresolved',
          false,
          [],
          'active',
          ['inactive'],
          undefined,
          'invalid',
        ).execute()
      })

      it('should return failure', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
    })
  })
})
