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
import { Workspace } from '@salto-io/workspace'
import * as core from '@salto-io/core'
import { ElemID, ObjectType } from '@salto-io/adapter-api'
import { LoginStatus } from '@salto-io/core'
import open from 'open'
import { Spinner, SpinnerCreator, CliExitCode, CliTelemetry } from '../../src/types'
import { cloneAction, moveToEnvsAction, moveToCommonAction, listUnresolvedAction, openAction } from '../../src/commands/element'
import * as mocks from '../mocks'
import * as mockCliWorkspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'
import Prompts from '../../src/prompts'
import { formatTargetEnvRequired } from '../../src/formatter'

const eventsNames = (cmdName: string): Record<string, string> => ({
  success: buildEventName(cmdName, 'success'),
  start: buildEventName(cmdName, 'start'),
  failure: buildEventName(cmdName, 'failure'),
})

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
jest.mock('open')
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  listUnresolvedReferences: jest.fn().mockImplementation((_ws, env) => mockedList(_ws, env)),
  getLoginStatuses: jest.fn().mockImplementation((
    _workspace: Workspace,
    serviceNames: string[],
  ) => {
    const loginStatuses: Record<string, LoginStatus> = {}
    serviceNames.forEach(serviceName => {
      if (serviceName === 'salesforce') {
        loginStatuses[serviceName] = {
          isLoggedIn: true,
          configTypeOptions: mocks.mockAdapterAuthentication(mocks.mockConfigType(serviceName)),
        }
      } else if (serviceName === 'oauthAdapter') {
        loginStatuses[serviceName] = {
          isLoggedIn: true,
          configTypeOptions: mocks.mockOauthCredentialsType(serviceName, { url: '', accessTokenField: '' }),
        }
      } else {
        loginStatuses[serviceName] = {
          isLoggedIn: false,
          configTypeOptions: mocks.mockAdapterAuthentication(mocks.mockConfigType(serviceName)),
        }
      }
    })
    return loginStatuses
  }),
}))
describe('Element command group', () => {
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']
  const serviceUrlAccount = 'http://acme.com'
  const mockOpen = open as jest.Mock
  const config = { shouldCalcTotalSize: true }
  let output: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const mockLoadWorkspace = mockCliWorkspace.loadWorkspace as jest.Mock

  beforeEach(() => {
    spinners = []
    spinnerCreator = mocks.mockSpinnerCreator(spinners)
  })

  let result: number
  let telemetry: mocks.MockTelemetry
  let cliTelemetry: CliTelemetry

  describe('Clone command', () => {
    const cloneName = 'clone'
    describe('with errored workspace', () => {
      beforeEach(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, cloneName)
        const erroredWorkspace = {
          hasErrors: () => true,
          errors: { strings: () => ['some error'] },
          config: { services },
        } as unknown as Workspace
        mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })
        result = await cloneAction({
          input: {
            elementSelector: ['salto.Account'],
            toEnvs: ['incative'],
            env: 'active',
            force: false,
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
        })
      })

      it('should fail', async () => {
        expect(result).toBe(CliExitCode.AppError)
        expect(telemetry.getEvents().length).toEqual(1)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).failure]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).failure][0].value).toEqual(1)
      })
    })

    describe('when workspace throws an error on clone', () => {
      const workspacePath = 'unexpected-error'
      const workspace = {
        ...mocks.mockLoadWorkspace(workspacePath),
        flush: async () => {
          throw new Error('Oy Vey Zmir')
        },
      }
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, cloneName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await cloneAction({
          input: {
            elementSelector: ['salto.Account'],
            toEnvs: ['inactive'],
            env: 'active',
            force: false,
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.AppError)
      })

      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).failure]).toHaveLength(1)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content)
          .toContain('Failed to clone the specified elements to the target environments')
      })
    })

    describe('with invalid element selectors', () => {
      const workspacePath = 'invalid-input'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, cloneName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await cloneAction({
          input: {
            elementSelector: ['a.b.c.d'],
            toEnvs: ['inactive'],
            env: 'active',
            force: false,
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
          workspacePath,
        })
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
        expect(telemetry.getEvents()).toHaveLength(0)
      })

      it('should print clone to console', () => {
        expect(output.stderr.content).toContain('Failed to created element ID filters')
      })
    })

    describe('valid clone', () => {
      const workspacePath = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, cloneName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        workspace.getElementIdsBySelectors = jest.fn().mockResolvedValue([selector])
        result = await cloneAction({
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: ['inactive'],
            env: 'active',
            force: false,
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
          workspacePath,
        })
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
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).success]).toHaveLength(1)
      })

      it('should print clone to console', () => {
        expect(output.stdout.content).toContain('Cloning the specified elements to inactive.')
      })
    })

    describe('clone with invalid target envs', () => {
      const workspacePath = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, cloneName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await cloneAction({
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: ['inactive', 'unknown', 'unknown2'],
            env: 'active',
            force: false,
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).failure]).toHaveLength(1)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content)
          .toContain('Unknown target environment')
      })
    })

    describe('clone with invalid env', () => {
      const workspacePath = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, cloneName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await cloneAction({
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: ['inactive', 'unknown'],
            env: 'active',
            force: false,
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).failure]).toHaveLength(1)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content)
          .toContain('Unknown target environment')
      })
    })
    describe('clone with empty list as target envs', () => {
      const workspacePath = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, cloneName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await cloneAction({
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: [],
            env: 'active',
            force: false,
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).failure]).toHaveLength(1)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content)
          .toContain(formatTargetEnvRequired())
      })
    })
    describe('clone with current env as target env', () => {
      const workspacePath = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, cloneName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await cloneAction({
          input: {
            elementSelector: [selector.getFullName()],
            toEnvs: ['active'],
            env: 'active',
            force: false,
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(cloneName).failure]).toHaveLength(1)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content)
          .toContain(Prompts.INVALID_ENV_TARGET_CURRENT)
      })
    })
  })

  describe('move-to-envs command', () => {
    const moveToEnvsName = 'move-to-envs'
    describe('when workspace throws an error', () => {
      const workspacePath = 'unexpected-error'
      const workspace = {
        ...mocks.mockLoadWorkspace(workspacePath),
        flush: async () => {
          throw new Error('Oy Vey Zmir')
        },
      }
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, moveToEnvsName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await moveToEnvsAction({
          input: {
            elementSelector: ['salto.Account'],
          },
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.AppError)
      })

      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(moveToEnvsName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(moveToEnvsName).failure]).toHaveLength(1)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content)
          .toContain(Prompts.MOVE_FAILED('Oy Vey Zmir'))
      })
    })

    describe('with invalid element selectors', () => {
      const workspacePath = 'invalid-input'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, moveToEnvsName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await moveToEnvsAction({
          input: {
            elementSelector: ['a.b.c.d'],
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should not call workspace demote', () => {
        expect(workspace.demote).not.toHaveBeenCalled()
      })

      it('should not flush workspace', () => {
        expect(workspace.flush).not.toHaveBeenCalled()
      })

      it('should not send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(0)
      })

      it('should print failed to console', () => {
        expect(output.stderr.content).toContain('Failed')
      })
    })

    describe('valid move to envs', () => {
      const workspacePath = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, moveToEnvsName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        workspace.getElementIdsBySelectors = jest.fn().mockResolvedValue([selector])
        result = await moveToEnvsAction({
          input: {
            elementSelector: [selector.getFullName()],
          },
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
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
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(moveToEnvsName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(moveToEnvsName).success]).toHaveLength(1)
      })

      it('should print deployment to console', () => {
        expect(output.stdout.content).toContain('Moving the specified elements to environment-specific folders.')
      })
    })
  })

  describe('move-to-common command', () => {
    const moveToCommonName = 'move-to-common'
    describe('when workspace throws an error on move-to-common', () => {
      const workspacePath = 'unexpected-error'
      const workspace = {
        ...mocks.mockLoadWorkspace(workspacePath),
        flush: async () => {
          throw new Error('Oy Vey Zmir')
        },
      }
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, moveToCommonName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await moveToCommonAction({
          input: {
            elementSelector: ['salto.Account'],
          },
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.AppError)
      })

      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(moveToCommonName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(moveToCommonName).failure]).toHaveLength(1)
      })

      it('should print failure to console', () => {
        expect(output.stderr.content)
          .toContain(Prompts.MOVE_FAILED('Oy Vey Zmir'))
      })
    })

    describe('with invalid element selectors', () => {
      const workspacePath = 'invalid-input'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, moveToCommonName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await moveToCommonAction({
          input: {
            elementSelector: ['a.b.c.d', 'e.f.g.h'],
          },
          output,
          cliTelemetry,
          config,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure code', () => {
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should not call workspace promote', () => {
        expect(workspace.promote).not.toHaveBeenCalled()
      })

      it('should not flush workspace', () => {
        expect(workspace.flush).not.toHaveBeenCalled()
      })

      it('should not send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(0)
      })

      it('should print failed to console', () => {
        expect(output.stderr.content).toContain('Failed')
      })
    })

    describe('Without env option', () => {
      const workspacePath = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, moveToCommonName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        workspace.getElementIdsBySelectors = jest.fn().mockResolvedValue([selector])
        result = await moveToCommonAction({
          input: {
            elementSelector: ['salto.Account'],
            env: 'active',
          },
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
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
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(moveToCommonName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(moveToCommonName).success]).toHaveLength(1)
      })

      it('should print deployment to console', () => {
        expect(output.stdout.content).toContain('Moving the specified elements to common')
      })
    })

    describe('With env option', () => {
      const workspacePath = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      const selector = new ElemID('salto', 'Account')
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, moveToCommonName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        workspace.getElementIdsBySelectors = jest.fn().mockResolvedValue([selector])
        result = await moveToCommonAction({
          input: {
            elementSelector: ['salto.Account'],
            env: 'active',
          },
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
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
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(moveToCommonName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(moveToCommonName).success]).toHaveLength(1)
      })

      it('should print deployment to console', () => {
        expect(output.stdout.content).toContain('Moving the specified elements to common')
      })
    })
  })

  describe('list-unresolved command', () => {
    const listUnresolvedName = 'list-unresolved'
    const mockListUnresolved = core.listUnresolvedReferences as jest.MockedFunction<
      typeof core.listUnresolvedReferences>

    describe('success - all unresolved references are found in complete-from', () => {
      const workspacePath = 'valid-ws'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, listUnresolvedName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        result = await listUnresolvedAction({
          input: {
            completeFrom: 'inactive',
            env: 'active',
          },
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })

      it('should ignore unresolved references when loading the workspace', () => {
        expect(mockLoadWorkspace).toHaveBeenCalledWith(
          workspacePath,
          output,
          expect.objectContaining({
            ignoreUnresolvedRefs: true,
          })
        )
      })
      it('should call listUnresolvedReferences', () => {
        expect(core.listUnresolvedReferences).toHaveBeenCalledWith(workspace, 'inactive')
      })

      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(listUnresolvedName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(listUnresolvedName).success]).toHaveLength(1)
      })

      it('should print found to console', () => {
        expect(output.stdout.content).toContain('The following unresolved references can be copied from inactive:')
        expect(output.stdout.content).toMatch(/salesforce.aaa(\s*)salesforce.bbb.instance.ccc/)
        expect(output.stdout.content).not.toContain('The following unresolved references could not be found:')
      })
    })

    describe('success - no unresolved references', () => {
      const workspacePath = 'empty'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, listUnresolvedName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        mockListUnresolved.mockImplementationOnce(() => Promise.resolve({
          found: [],
          missing: [],
        }))

        result = await listUnresolvedAction({
          input: {},
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call listUnresolvedReferences', () => {
        expect(core.listUnresolvedReferences).toHaveBeenCalledWith(workspace, undefined)
      })

      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(listUnresolvedName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(listUnresolvedName).success]).toHaveLength(1)
      })

      it('should print list to console', () => {
        expect(output.stdout.content).toContain('All references in active were resolved successfully!')
      })
    })

    describe('success - some references do not exist', () => {
      const workspacePath = 'missing'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, listUnresolvedName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        mockListUnresolved.mockImplementationOnce(() => Promise.resolve({
          found: [new ElemID('salesforce', 'aaa'), new ElemID('salesforce', 'bbb', 'instance', 'ccc')],
          missing: [new ElemID('salesforce', 'fail')],
        }))
        result = await listUnresolvedAction({
          input: {
            completeFrom: 'inactive',
          },
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call listUnresolvedReferences', () => {
        expect(core.listUnresolvedReferences).toHaveBeenCalledWith(workspace, 'inactive')
      })

      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(listUnresolvedName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(listUnresolvedName).success]).toHaveLength(1)
      })

      it('should print list to console', () => {
        expect(output.stdout.content).toMatch(/The following unresolved references can be copied from inactive:(\s*)salesforce.aaa(\s*)salesforce.bbb.instance.ccc/)
        expect(output.stdout.content).toMatch(/The following unresolved references could not be found:(\s*)salesforce.fail/)
      })
    })

    describe('failure - unexpected error', () => {
      const workspacePath = 'fail'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, listUnresolvedName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        mockListUnresolved.mockImplementationOnce(() => {
          throw new Error('oh no')
        })

        result = await listUnresolvedAction({
          input: {
            completeFrom: 'inactive',
          },
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure', () => {
        expect(result).toBe(CliExitCode.AppError)
      })
      it('should call listUnresolvedReferences', () => {
        expect(core.listUnresolvedReferences).toHaveBeenCalledWith(workspace, 'inactive')
      })

      it('should send telemetry events', () => {
        expect(telemetry.getEvents()).toHaveLength(2)
        expect(telemetry.getEventsMap()[eventsNames(listUnresolvedName).start]).toHaveLength(1)
        expect(telemetry.getEventsMap()[eventsNames(listUnresolvedName).success]).toBeUndefined()
        expect(telemetry.getEventsMap()[eventsNames(listUnresolvedName).failure]).toHaveLength(1)
      })

      it('should print the error', () => {
        expect(output.stderr.content).toContain('Failed to list unresolved references: oh no')
      })
    })

    describe('failure - invalid complete-from env', () => {
      const workspacePath = 'not-called'
      const workspace = mocks.mockLoadWorkspace(workspacePath)
      beforeAll(async () => {
        output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
        telemetry = mocks.getMockTelemetry()
        cliTelemetry = getCliTelemetry(telemetry, listUnresolvedName)
        mockLoadWorkspace.mockResolvedValue({
          workspace,
          errored: false,
        })
        await listUnresolvedAction({
          input: {
            completeFrom: 'invalid',
          },
          output,
          config,
          cliTelemetry,
          spinnerCreator,
          workspacePath,
        })
      })

      it('should return failure', () => {
        expect(result).toBe(CliExitCode.AppError)
      })
    })
  })
  describe('open command', () => {
    const mockWorkspaceForOpenCommand = {
      ...mocks.mockLoadWorkspace('workspacePath', ['env'], false, true, ['netsuite', 'salesforceNotLoggedIn', 'salesforce']),
      currentEnv: () => 'env',
      getValue: (elemId: ElemID) => {
        if (elemId.getFullName() === 'salesforce.Account.instance.variable.variable2') {
          return Promise.resolve(new ObjectType({
            elemID: new ElemID('salesforce', 'Account', 'instance', 'variable', 'variable2'),
            // eslint-disable-next-line quote-props
            annotations: {},
          }))
        }
        if (elemId.getFullName() === 'salesforce.Account.instance.variable') {
          return Promise.resolve(new ObjectType({
            elemID: new ElemID('salesforce', 'Account', 'instance', 'variable'),
            // eslint-disable-next-line quote-props
            annotations: { '_service_url': serviceUrlAccount },
          }))
        }
        if (elemId.getFullName() === 'salesforce.Account') {
          return Promise.resolve(new ObjectType({
            elemID: new ElemID('salesforce', 'Account'),
            // eslint-disable-next-line quote-props
            annotations: { '_service_url': serviceUrlAccount },
          }))
        }
        if (elemId.getFullName() === 'salesforce.Date') {
          return Promise.resolve(new ObjectType({
            elemID: new ElemID('salesforce', 'Date'),
            annotations: {},
          }))
        }
        if (elemId.getFullName() === 'salesForce.AccountIntelligenceSettings') {
          return Promise.resolve(new ObjectType({
            elemID: new ElemID('salesforce', 'AccountIntelligenceSettings'),
            annotations: {
              hiddenStrAnno: 'some value',
            },
          }))
        }
        if (elemId.getFullName() === 'salesforce.elementWithoutElementType') {
          return Promise.resolve({})
        }
        return Promise.resolve(undefined)
      },
    }
    beforeEach(() => {
      output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
      telemetry = mocks.getMockTelemetry()
      cliTelemetry = getCliTelemetry(telemetry, 'open')
      mockLoadWorkspace.mockResolvedValue(
        {
          workspace: mockWorkspaceForOpenCommand,
          errored: false,
        }
      )
    })
    it('should return a valid URL for an existing logged in service', async () => {
      const openActionResult = await openAction({
        input: { elementId: 'salesforce.Account', env: 'env1' },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stderr.content).toEqual('')
      expect(mockOpen).toHaveBeenCalledWith(serviceUrlAccount)
      expect(openActionResult).toEqual(CliExitCode.Success)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.success', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
    it('should error out when loading workspace fails', async () => {
      mockLoadWorkspace.mockResolvedValue(
        {
          workspace: mockWorkspaceForOpenCommand,
          errored: true,
        }
      )
      const openActionResult = await openAction({
        input: { elementId: 'salesforce.Account', env: 'env1' },
        output,
        cliTelemetry,
        config,
      })
      expect(openActionResult).toEqual(CliExitCode.AppError)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.failure', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
    it('should return an error when trying to open an non logged in service', async () => {
      const openActionResult = await openAction({
        input: { elementId: 'salesforceNotLoggedIn', env: 'env2' },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stderr.content).toContain('Service salesforceNotLoggedIn in env env2 is not logged. Please run \'salto service login\'')
      expect(openActionResult).toEqual(CliExitCode.UserInputError)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.failure', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
    it('should return an error message when opening an non existing service', async () => {
      const openActionResult = await openAction({
        input: { elementId: 'nonExistingServiceName', env: 'env1' },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stderr.content).toContain('Service nonExistingServiceName is not configured for env env1. Use \'salto service add <service-name>\'')
      expect(openActionResult).toEqual(CliExitCode.UserInputError)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.failure', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
    it('should print the current env to the error message, if one was not provided in the arguments', async () => {
      const openActionResult = await openAction({
        input: { elementId: 'nonExistingServiceName' },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stderr.content).toContain('Service nonExistingServiceName is not configured for env env. Use \'salto service add <service-name>\'')
      expect(openActionResult).toEqual(CliExitCode.UserInputError)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.failure', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
    it('should return an error when elementId does not contain ServiceURL annotation', async () => {
      const openActionResult = await openAction({
        input: { elementId: 'salesforce.Date', env: 'env1' },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stderr.content).toEqual('Go to service is not supported for element salesforce.Date\n')
      expect(openActionResult).toEqual(CliExitCode.AppError)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.failure', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
    it('should return an error when trying to open a non existing element', async () => {
      const openActionResult = await openAction({
        input: { elementId: 'salesforce.Nonexisting', env: 'env' },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stderr.content).toEqual('Did not find any matches for element salesforce.Nonexisting\n')
      expect(openActionResult).toEqual(CliExitCode.UserInputError)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.failure', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
    it('should return an error when trying to open an invalid elementId', async () => {
      const openActionResult = await openAction({
        input: { elementId: 'salesforce.element.invalidType', env: 'env' },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stderr.content).toEqual('Did not find any matches for element salesforce.element.invalidType\n')
      expect(openActionResult).toEqual(CliExitCode.UserInputError)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.failure', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
    it('should return the service URL from the top level parent if one does not exists on the elementId', async () => {
      const openActionResult = await openAction({
        input: { elementId: 'salesforce.Account.instance.variable.variable2', env: 'env' },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stderr.content).toEqual('')
      expect(mockOpen).toHaveBeenCalledWith(serviceUrlAccount)
      expect(openActionResult).toEqual(CliExitCode.Success)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.success', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
    it('should return an error when trying to open an elementId that is not of type Element', async () => {
      const openActionResult = await openAction({
        input: { elementId: 'salesforce.elementWithoutElementType', env: 'env' },
        output,
        cliTelemetry,
        config,
      })
      expect(output.stderr.content).toEqual('Did not find any matches for element salesforce.elementWithoutElementType\n')
      expect(openActionResult).toEqual(CliExitCode.UserInputError)
      expect(telemetry.getEvents()).toContainEqual({ name: 'workspace.open.failure', tags: {}, timestamp: '', type: 'counter', value: 1 })
    })
  })
})
