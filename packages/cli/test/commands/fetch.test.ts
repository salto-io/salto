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
import _ from 'lodash'
import { EventEmitter } from 'pietile-eventemitter'
import { Element, InstanceElement,
  DetailedChange } from '@salto-io/adapter-api'
import { fetch, FetchChange, FetchProgressEvents, StepEmitter, FetchFunc } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { Spinner, SpinnerCreator, CliExitCode } from '../../src/types'
import * as fetchCmd from '../../src/commands/fetch'
import { command, fetchCommand, FetchCommandArgs } from '../../src/commands/fetch'
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import Prompts from '../../src/prompts'
import * as mockCliWorkspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'

const commandName = 'fetch'
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
  fetch: jest.fn().mockImplementation(() => Promise.resolve({
    changes: [],
    mergeErrors: [],
    success: true,
  })),
}))
jest.mock('../../src/workspace/workspace')
describe('fetch command', () => {
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const mockLoadWorkspace = mockCliWorkspace.loadWorkspace as jest.Mock
  const mockApplyChangesToWorkspace = mockCliWorkspace.applyChangesToWorkspace as jest.Mock
  const mockUpdateWorkspace = mockCliWorkspace.updateWorkspace as jest.Mock
  const mockUpdateStateOnly = mockCliWorkspace.updateStateOnly as jest.Mock
  mockApplyChangesToWorkspace.mockImplementation(
    ({ workspace, output, changes, mode }) => (
      mockUpdateWorkspace(workspace, output, changes, mode)
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

  describe('execute', () => {
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
        result = await command('', true, false, mockTelemetry, cliOutput, spinnerCreator, 'default', true, services)
          .execute()
      })

      it('should fail', async () => {
        expect(result).toBe(CliExitCode.AppError)
        expect(fetch).not.toHaveBeenCalled()
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
          'default',
          true,
          services,
        ).execute()
      })

      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call fetch', () => {
        expect(fetch).toHaveBeenCalled()
      })

      it('should update changes', () => {
        const calls = findWsUpdateCalls(workspaceName)
        expect(calls).toHaveLength(1)
        expect(_.isEmpty(calls[0][2])).toBeTruthy()
      })

      it('should send telemetry events', () => {
        expect(mockTelemetry.getEvents()).toHaveLength(3)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.changes]).toHaveLength(1)
      })
    })

    describe('fetch command', () => {
      const mockFetch = jest.fn().mockResolvedValue(
        { changes: [], mergeErrors: [], success: true }
      )
      const mockFailedFetch = jest.fn().mockResolvedValue(
        { changes: [], mergeErrors: [], success: false }
      )
      const mockEmptyApprove = jest.fn().mockResolvedValue([])
      const mockUpdateConfig = jest.fn().mockResolvedValue(true)

      const mockWorkspace = (
        elements?: Element[],
        name?: string,
        existingServices: Record<string, string[]> = { default: [] },
        currentEnv = 'default'
      ): Workspace => ({
        name,
        hasErrors: () => false,
        elements: () => (elements || []),
        services: () => services,
        updateNaclFiles: jest.fn(),
        flush: jest.fn(),
        state: (envName? : string) => ({
          existingServices: jest.fn().mockResolvedValue(existingServices[envName || currentEnv]),
        }),
        getTotalSize: jest.fn().mockResolvedValue(0),
        isEmpty: () => (elements || []).length === 0,
        updateServiceConfig: jest.fn(),
        servicesCredentials: jest.fn().mockResolvedValue({}),
        envs: () => _.keys(existingServices),
        currentEnv: () => currentEnv,
      } as unknown as Workspace)

      describe('with emitters called', () => {
        const mockFetchWithEmitter: jest.Mock = jest.fn((
          _workspace,
          progressEmitter: EventEmitter<FetchProgressEvents>,
          _services,
        ) => {
          const getChangesEmitter = new StepEmitter()
          progressEmitter.emit('changesWillBeFetched', getChangesEmitter, ['adapterName'])
          getChangesEmitter.emit('completed')
          const calculateDiffEmitter = new StepEmitter()
          progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
          calculateDiffEmitter.emit('failed')
          return Promise.resolve(
            { changes: [], mergeErrors: [], success: true }
          )
        })
        beforeEach(async () => {
          mockTelemetry = mocks.getMockTelemetry()
          await fetchCommand({
            workspace: mockWorkspace(),
            force: true,
            interactive: false,
            output: cliOutput,
            cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
            fetch: mockFetchWithEmitter,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockUpdateConfig,
            mode: 'default',
            shouldCalcTotalSize: true,
            inputServices: services,
            stateOnly: false,
          })
        })
        it('should start at least one step', () => {
          expect(cliOutput.stdout.content).toContain('>>>')
        })
        it('should finish one step', () => {
          expect(cliOutput.stdout.content).toContain('vvv')
        })
        it('should fail one step', () => {
          expect(cliOutput.stdout.content).toContain('xxx')
        })
      })
      describe('with no upstream changes', () => {
        let workspace: Workspace
        const workspaceName = 'no-changes'
        beforeEach(async () => {
          mockTelemetry = mocks.getMockTelemetry()
          workspace = mockWorkspace(undefined, workspaceName)
          await fetchCommand({
            workspace,
            force: true,
            interactive: false,
            output: cliOutput,
            inputServices: services,
            cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
            fetch: mockFetch,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockUpdateConfig,
            mode: 'default',
            shouldCalcTotalSize: true,
            stateOnly: false,
          })
        })
        it('should not update workspace', () => {
          const calls = findWsUpdateCalls(workspaceName)
          expect(calls[0][2]).toHaveLength(0)
          expect(mockTelemetry.getEvents()).toHaveLength(3)
          expect(mockTelemetry.getEventsMap()[eventsNames.changes]).not.toBeUndefined()
          expect(mockTelemetry.getEventsMap()[eventsNames.changes]).toHaveLength(1)
          expect(mockTelemetry.getEventsMap()[eventsNames.changes][0].value).toEqual(0)
        })
      })
      describe('with changes to write to config', () => {
        const mockShouldUpdateConfig = jest.fn()
        let fetchArgs: FetchCommandArgs
        let newConfig: InstanceElement

        beforeEach(async () => {
          const workspaceName = 'with-config-changes'
          const { plan, updatedConfig } = mocks.configChangePlan()
          newConfig = updatedConfig
          const mockFetchWithChanges = jest.fn().mockResolvedValue(
            {
              changes: [],
              configChanges: plan,
              mergeErrors: [],
              success: true,
            }
          )
          mockTelemetry = mocks.getMockTelemetry()
          const workspace = mockWorkspace(undefined, workspaceName)
          fetchArgs = {
            workspace,
            force: false,
            interactive: false,
            inputServices: services,
            cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
            output: cliOutput,
            fetch: mockFetchWithChanges,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockShouldUpdateConfig,
            mode: 'default',
            shouldCalcTotalSize: true,
            stateOnly: false,
          }
        })

        it('should write config when continue was requested', async () => {
          mockShouldUpdateConfig.mockResolvedValueOnce(Promise.resolve(true))
          result = await fetchCommand(fetchArgs)
          expect(result).toBe(CliExitCode.Success)
          expect(fetchArgs.workspace.updateServiceConfig).toHaveBeenCalledWith('salesforce', newConfig)
        })

        it('should not write config when abort was requested', async () => {
          mockShouldUpdateConfig.mockResolvedValueOnce(Promise.resolve(false))
          result = await fetchCommand(fetchArgs)
          expect(result).toBe(CliExitCode.UserInputError)
          expect(fetchArgs.workspace.updateServiceConfig).not.toHaveBeenCalled()
        })
      })
      describe('with upstream changes', () => {
        const changes = mocks.dummyChanges.map(
          (change: DetailedChange): FetchChange => ({ change, serviceChange: change })
        )
        const mockFetchWithChanges = jest.fn().mockResolvedValue(
          {
            changes,
            mergeErrors: [],
            success: true,
          }
        )
        describe('when called with force', () => {
          const workspaceName = 'with-force'
          let workspace: Workspace
          beforeEach(async () => {
            mockTelemetry = mocks.getMockTelemetry()
            workspace = mockWorkspace(undefined, workspaceName)
            result = await fetchCommand({
              workspace,
              force: true,
              interactive: false,
              inputServices: services,
              cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
              output: cliOutput,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              shouldUpdateConfig: mockUpdateConfig,
              mode: 'default',
              shouldCalcTotalSize: true,
              stateOnly: false,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should deploy all changes', () => {
            const calls = findWsUpdateCalls(workspaceName)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, 'default'])
          })
        })
        describe('when called with isolated', () => {
          const workspaceName = 'with-strict'
          let workspace: Workspace
          beforeEach(async () => {
            mockTelemetry = mocks.getMockTelemetry()
            workspace = mockWorkspace(undefined, workspaceName)
            result = await fetchCommand({
              workspace,
              force: true,
              interactive: false,
              inputServices: services,
              cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
              output: cliOutput,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              mode: 'isolated',
              shouldUpdateConfig: mockUpdateConfig,
              shouldCalcTotalSize: true,
              stateOnly: false,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should forward strict mode', () => {
            const calls = findWsUpdateCalls(workspaceName)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, 'isolated'])
          })
        })
        describe('when called with align', () => {
          const workspaceName = 'with-align'
          let workspace: Workspace
          beforeEach(async () => {
            mockTelemetry = mocks.getMockTelemetry()
            workspace = mockWorkspace(undefined, workspaceName)
            result = await fetchCommand({
              workspace,
              force: true,
              interactive: false,
              inputServices: services,
              cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
              output: cliOutput,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              mode: 'align',
              shouldUpdateConfig: mockUpdateConfig,
              shouldCalcTotalSize: true,
              stateOnly: false,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should forward align mode', () => {
            const calls = findWsUpdateCalls(workspaceName)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, 'align'])
          })
        })
        describe('when called with override', () => {
          const workspaceName = 'with-override'
          let workspace: Workspace
          beforeEach(async () => {
            mockTelemetry = mocks.getMockTelemetry()
            workspace = mockWorkspace(undefined, workspaceName)
            result = await fetchCommand({
              workspace,
              force: true,
              interactive: false,
              inputServices: services,
              cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
              output: cliOutput,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              mode: 'override',
              shouldUpdateConfig: mockUpdateConfig,
              shouldCalcTotalSize: true,
              stateOnly: false,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should forward override mode', () => {
            const calls = findWsUpdateCalls(workspaceName)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, 'override'])
          })
        })
        describe('when called with state only', () => {
          const workspaceName = 'with-state-only'
          let workspace: Workspace
          describe('should error if mode is not default', () => {
            it('should throw an error', () => expect(fetchCommand({
              workspace,
              force: true,
              interactive: false,
              inputServices: services,
              cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
              output: cliOutput,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              mode: 'align',
              shouldUpdateConfig: mockUpdateConfig,
              shouldCalcTotalSize: true,
              stateOnly: true,
            })).rejects.toThrow())
          })
          describe('when state is updated', () => {
            beforeAll(async () => {
              mockTelemetry = mocks.getMockTelemetry()
              workspace = mockWorkspace(undefined, workspaceName)
              result = await fetchCommand({
                workspace,
                force: true,
                interactive: false,
                inputServices: services,
                cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
                output: cliOutput,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockEmptyApprove,
                mode: 'default',
                shouldUpdateConfig: mockUpdateConfig,
                shouldCalcTotalSize: true,
                stateOnly: true,
              })
            })
            it('should return OK status when state is updated', () => {
              expect(result).toBe(CliExitCode.Success)
            })
            it('should not apply any changes', async () => {
              const calls = findWsUpdateCalls(workspaceName)
              expect(calls).toHaveLength(0)
            })
          })
          describe('when state failed to update', () => {
            beforeAll(async () => {
              mockUpdateStateOnly.mockResolvedValueOnce(false)
              mockTelemetry = mocks.getMockTelemetry()
              workspace = mockWorkspace(undefined, workspaceName)
              result = await fetchCommand({
                workspace,
                force: true,
                interactive: false,
                inputServices: services,
                cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
                output: cliOutput,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockEmptyApprove,
                mode: 'default',
                shouldUpdateConfig: mockUpdateConfig,
                shouldCalcTotalSize: true,
                stateOnly: true,
              })
            })
            it('should return AppError status when state is updated', () => {
              expect(result).toBe(CliExitCode.AppError)
            })
            it('should not apply any changes', async () => {
              const calls = findWsUpdateCalls(workspaceName)
              expect(calls).toHaveLength(0)
            })
          })
        })
        describe('when initial workspace is empty', () => {
          const workspaceName = 'ws-empty'
          const workspace = mockWorkspace(undefined, workspaceName)
          beforeEach(async () => {
            mockTelemetry = mocks.getMockTelemetry()
            await fetchCommand({
              workspace,
              force: false,
              interactive: false,
              inputServices: services,
              cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
              output: cliOutput,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              shouldUpdateConfig: mockUpdateConfig,
              mode: 'default',
              shouldCalcTotalSize: true,
              stateOnly: false,
            })
          })
          it('should deploy all changes', () => {
            const calls = findWsUpdateCalls(workspaceName)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, 'default'])
          })
        })
        describe('when initial workspace is not empty', () => {
          describe('if some changes are approved', () => {
            const mockSingleChangeApprove = jest.fn().mockImplementation(cs =>
              Promise.resolve([cs[0]]))

            it('should update workspace only with approved changes', async () => {
              const workspaceName = 'single-approve'
              const workspace = mockWorkspace(mocks.elements(), workspaceName)
              mockTelemetry = mocks.getMockTelemetry()
              await fetchCommand({
                workspace,
                force: false,
                interactive: false,
                inputServices: services,
                cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
                output: cliOutput,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockSingleChangeApprove,
                shouldUpdateConfig: mockUpdateConfig,
                mode: 'default',
                shouldCalcTotalSize: true,
                stateOnly: false,
              })
              const calls = findWsUpdateCalls(workspaceName)
              expect(calls).toHaveLength(1)
              expect(calls[0][2][0]).toEqual(changes[0])
            })

            it('should exit if errors identified in workspace after update', async () => {
              const workspaceName = 'exist-on-error'
              const workspace = mockWorkspace(mocks.elements(), workspaceName)
              workspace.errors = async () => mocks.mockErrors([
                { message: 'BLA Error', severity: 'Error' },
              ])
              workspace.hasErrors = () => Promise.resolve(true)

              const res = await fetchCommand({
                workspace,
                force: false,
                interactive: false,
                inputServices: services,
                cliTelemetry: getCliTelemetry(mocks.getMockTelemetry(), 'fetch'),
                output: cliOutput,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockSingleChangeApprove,
                shouldUpdateConfig: mockUpdateConfig,
                mode: 'default',
                shouldCalcTotalSize: true,
                stateOnly: false,
              })
              const calls = findWsUpdateCalls(workspaceName)
              expect(calls).toHaveLength(1)
              expect(calls[0][2][0]).toEqual(changes[0])
              expect(res).toBe(CliExitCode.AppError)
            })
            it('should not exit if warning identified in workspace after update', async () => {
              const workspaceName = 'warn'
              const workspace = mockWorkspace(mocks.elements(), workspaceName)
              workspace.errors = async () => mocks.mockErrors([
                { message: 'BLA Warning', severity: 'Warning' },
              ])
              workspace.hasErrors = () => Promise.resolve(true)

              const res = await fetchCommand({
                workspace,
                force: false,
                interactive: false,
                inputServices: services,
                cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
                output: cliOutput,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockSingleChangeApprove,
                shouldUpdateConfig: mockUpdateConfig,
                mode: 'default',
                shouldCalcTotalSize: true,
                stateOnly: false,
              })
              const calls = findWsUpdateCalls(workspaceName)
              expect(calls).toHaveLength(1)
              expect(calls[0][2][0]).toEqual(changes[0])
              expect(cliOutput.stderr.content).not.toContain(Prompts.SHOULD_CONTINUE(1))
              expect(cliOutput.stdout.content).not.toContain(Prompts.SHOULD_CONTINUE(1))
              expect(res).toBe(CliExitCode.Success)
            })
            it('should not update workspace if fetch failed', async () => {
              const workspaceName = 'fail'
              const workspace = mockWorkspace(mocks.elements(), workspaceName)
              mockTelemetry = mocks.getMockTelemetry()
              await fetchCommand({
                workspace,
                force: false,
                interactive: false,
                inputServices: services,
                cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
                output: cliOutput,
                fetch: mockFailedFetch,
                getApprovedChanges: mockSingleChangeApprove,
                shouldUpdateConfig: mockUpdateConfig,
                mode: 'default',
                shouldCalcTotalSize: true,
                stateOnly: false,
              })
              expect(cliOutput.stderr.content).toContain('Error')
              const calls = findWsUpdateCalls(workspaceName)
              expect(calls).toHaveLength(0)
              expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
              expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
              expect(mockTelemetry.getEventsMap()[eventsNames.workspaceSize]).toBeUndefined()
            })
          })
        })
      })
      describe('with merge errors', () => {
        const mockFetchWithChanges = mocks.mockFunction<FetchFunc>().mockResolvedValue(
          {
            changes: [],
            mergeErrors: [
              {
                elements: mocks.elements().slice(0, 2),
                error: {
                  elemID: mocks.elements()[0].elemID,
                  error: 'test',
                  message: 'test merge error',
                  severity: 'Warning',
                },
              },
            ],
            success: true,
          }
        )
        beforeEach(async () => {
          mockTelemetry = mocks.getMockTelemetry()
          const workspace = mockWorkspace()
          result = await fetchCommand({
            workspace,
            force: true,
            interactive: false,
            cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
            output: cliOutput,
            fetch: mockFetchWithChanges,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockUpdateConfig,
            mode: 'default',
            shouldCalcTotalSize: true,
            stateOnly: false,
          })
        })
        it('should succeed', () => {
          expect(result).toBe(CliExitCode.Success)
        })
        it('should print merge errors', () => {
          expect(cliOutput.stderr.content).toContain(mocks.elements()[0].elemID.getFullName())
          expect(cliOutput.stderr.content).toContain('test merge error')
        })
      })
    })
  })
  describe('multienv - new service in env, with existing common elements', () => {
    const mockTelemetry: mocks.MockTelemetry = mocks.getMockTelemetry()
    const workspaceDir = 'valid-ws'
    beforeEach(() => {
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace(workspaceDir, undefined, false, true),
        errored: false,
        stateRecencies: [{ serviceName: 'salesforce', status: 'Nonexistent' }],
      })
      jest.spyOn(fetchCmd, 'fetchCommand').mockImplementationOnce(() => Promise.resolve(
        CliExitCode.Success
      ))
    })
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should prompt to change mode, and continue as-is on "no"', async () => {
      jest.spyOn(callbacks, 'getFetchModeChangeAction').mockImplementationOnce(
        () => Promise.resolve('no')
      )
      await command(
        workspaceDir,
        false, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        'default',
        true,
        services,
      ).execute()

      expect(callbacks.getFetchModeChangeAction).toHaveBeenCalledTimes(1)
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('default')
    })
    it('should prompt to change mode, and change to "align" on "yes"', async () => {
      jest.spyOn(callbacks, 'getFetchModeChangeAction').mockImplementationOnce(
        () => Promise.resolve('yes')
      )
      await command(
        workspaceDir,
        false, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        'override',
        true,
        services,
      ).execute()

      expect(callbacks.getFetchModeChangeAction).toHaveBeenCalledTimes(1)
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('align')
    })
    it('should prompt to change mode, and cancel on "cancel operation"', async () => {
      jest.spyOn(callbacks, 'getFetchModeChangeAction').mockImplementationOnce(
        () => Promise.resolve('cancel operation')
      )
      await command(
        workspaceDir,
        false, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        'default',
        true,
        services,
      ).execute()

      expect(callbacks.getFetchModeChangeAction).toHaveBeenCalledTimes(1)
      expect(fetchCmd.fetchCommand).not.toHaveBeenCalled()
    })
    it('should not prompt if running with force=true', async () => {
      jest.spyOn(callbacks, 'getFetchModeChangeAction').mockImplementationOnce(
        () => Promise.resolve('no')
      )
      await command(
        workspaceDir,
        true, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        'override',
        true,
        services,
      ).execute()

      expect(callbacks.getFetchModeChangeAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('override')
    })
    it('should not prompt if already ran service', async () => {
      jest.spyOn(callbacks, 'getFetchModeChangeAction').mockImplementationOnce(
        () => Promise.resolve('no')
      )
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace(workspaceDir, undefined, false, true),
        errored: false,
        stateRecencies: [{ serviceName: 'salesforce', status: 'Valid' }],
      })
      await command(
        workspaceDir,
        false, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        'default',
        true,
        services,
      ).execute()

      expect(callbacks.getFetchModeChangeAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('default')
    })
    it('should not prompt if mode is align', async () => {
      jest.spyOn(callbacks, 'getFetchModeChangeAction').mockImplementationOnce(
        () => Promise.resolve('no')
      )
      await command(
        workspaceDir,
        false, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        'align',
        true,
        services,
      ).execute()

      expect(callbacks.getFetchModeChangeAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('align')
    })
    it('should not prompt if nothing is under common', async () => {
      jest.spyOn(callbacks, 'getFetchModeChangeAction').mockImplementation(
        () => Promise.resolve('no')
      )
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace(workspaceDir, undefined, false, false),
        errored: false,
        stateRecencies: [{ serviceName: 'salesforce', status: 'Nonexistent' }],
      })
      await command(
        workspaceDir,
        false, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        'default',
        true,
        services,
      ).execute()

      expect(callbacks.getFetchModeChangeAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('default')
    })

    it('should not prompt if only one of the services is new', async () => {
      jest.spyOn(callbacks, 'getFetchModeChangeAction').mockImplementationOnce(
        () => Promise.resolve('no')
      )
      mockLoadWorkspace.mockResolvedValue({
        workspace: mocks.mockLoadWorkspace(workspaceDir, undefined, false, false),
        errored: false,
        stateRecencies: [
          { serviceName: 'salesforce', status: 'Nonexistent' },
          { serviceName: 'netsuite', status: 'Valid' },
        ],
      })
      await command(
        workspaceDir,
        false, false,
        mockTelemetry,
        cliOutput,
        spinnerCreator,
        'override',
        true,
      ).execute()

      expect(callbacks.getFetchModeChangeAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('override')
    })
  })

  describe('Verify using env command', () => {
    const mockTelemetry: mocks.MockTelemetry = mocks.getMockTelemetry()
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
        'default',
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
        'default',
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
})
