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
import { ElemID, ObjectType, Element, InstanceElement } from '@salto-io/adapter-api'
import {
  Workspace, fetch, FetchChange,
  DetailedChange, FetchProgressEvents,
  StepEmitter, fetchFunc,
} from '@salto-io/core'
import { Spinner, SpinnerCreator, CliExitCode } from '../../src/types'
import { command, fetchCommand, FetchCommandArgs } from '../../src/commands/fetch'
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
  const mockUpdateWorkspace = mockCliWorkspace.updateWorkspace as jest.Mock
  mockUpdateWorkspace.mockImplementation(ws =>
    Promise.resolve(ws.name !== 'exist-on-error'))
  const findWsUpdateCalls = (name: string): unknown[][][] =>
    mockUpdateWorkspace.mock.calls.filter(args => args[0].name === name)

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
        result = await command('', true, false, mockTelemetry, cliOutput, spinnerCreator, false, services,)
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
          false,
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
        expect(mockTelemetry.getEvents()).toHaveLength(5)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.changes]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.workspaceSize]).toHaveLength(1)
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
      const mockApproveIsolatedModeTrue = jest.fn().mockResolvedValue(true)

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
            inputServices: services,
            inputIsolated: false,
            approveIsolatedMode: mockApproveIsolatedModeTrue,
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
            inputIsolated: false,
            approveIsolatedMode: mockApproveIsolatedModeTrue,
          })
        })
        it('should not update workspace', () => {
          const calls = findWsUpdateCalls(workspaceName)
          expect(calls[0][2]).toHaveLength(0)
          expect(mockTelemetry.getEvents()).toHaveLength(5)
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
            inputIsolated: false,
            approveIsolatedMode: mockApproveIsolatedModeTrue,
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
              inputIsolated: false,
              approveIsolatedMode: mockApproveIsolatedModeTrue,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should deploy all changes', () => {
            const calls = findWsUpdateCalls(workspaceName)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, false])
          })
        })
        describe('when called with strict', () => {
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
              inputIsolated: true,
              shouldUpdateConfig: mockUpdateConfig,
              approveIsolatedMode: mockApproveIsolatedModeTrue,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should forward strict mode', () => {
            const calls = findWsUpdateCalls(workspaceName)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, true])
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
              inputIsolated: false,
              approveIsolatedMode: mockApproveIsolatedModeTrue,
            })
          })
          it('should deploy all changes', () => {
            const calls = findWsUpdateCalls(workspaceName)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, false])
          })
        })
        describe('when initial workspace is not empty', () => {
          describe('if no change is approved', () => {
            let workspace: Workspace
            const workspaceName = 'no-approve'
            beforeEach(async () => {
              mockTelemetry = mocks.getMockTelemetry()
              workspace = mockWorkspace([new ObjectType({ elemID: new ElemID('adapter', 'type') })], workspaceName)
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
                inputIsolated: false,
                approveIsolatedMode: mockApproveIsolatedModeTrue,
              })
            })
            it('should not update workspace', () => {
              const calls = findWsUpdateCalls(workspaceName)
              expect(calls[0][2]).toHaveLength(0)
              expect(mockTelemetry.getEvents()).toHaveLength(5)
              expect(mockTelemetry.getEventsMap()[eventsNames.changes]).not.toBeUndefined()
              expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply]).not.toBeUndefined()
            })
          })
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
                inputIsolated: false,
                approveIsolatedMode: mockApproveIsolatedModeTrue,
              })
              const calls = findWsUpdateCalls(workspaceName)
              expect(calls).toHaveLength(1)
              expect(calls[0][2][0]).toEqual(changes[0])
              expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply]).not.toBeUndefined()
              expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply]).toHaveLength(1)
              expect(mockTelemetry.getEventsMap()[eventsNames.workspaceSize]).toHaveLength(1)
              expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply][0].value).toEqual(1)
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
                inputIsolated: false,
                approveIsolatedMode: mockApproveIsolatedModeTrue,
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
                inputIsolated: false,
                approveIsolatedMode: mockApproveIsolatedModeTrue,
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
                inputIsolated: false,
                approveIsolatedMode: mockApproveIsolatedModeTrue,
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
        const mockFetchWithChanges = mocks.mockFunction<fetchFunc>().mockResolvedValue(
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
            inputIsolated: false,
            approveIsolatedMode: mockApproveIsolatedModeTrue,
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
      describe('isolated mode recommendations', () => {
        const mockApproveIsolatedMode = jest.fn()

        const mockFetchEmpty = jest.fn().mockResolvedValue(
          {
            changes: [],
            mergeErrors: [],
            success: true,
          }
        )
        const runFetchWithExisting = async (
          inputServices: string[],
          existingServices: Record<string, string[]>,
          currentEnv: string,
          isolated: boolean,
        ): Promise<void> => {
          await fetchCommand({
            workspace: mockWorkspace([], undefined, existingServices, currentEnv),
            force: false,
            interactive: false,
            output: cliOutput,
            cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
            fetch: mockFetchEmpty,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockUpdateConfig,
            inputServices,
            inputIsolated: isolated,
            approveIsolatedMode: mockApproveIsolatedMode,
          })
        }

        const verifyUpdateCall = (inputServices: string[], isolated: boolean): boolean => {
          const invokedServices = mockFetchEmpty.mock.calls[0][2]
          const invokedIsolated = mockUpdateWorkspace.mock.calls[0][3]
          return isolated === invokedIsolated
            && _.isEqual(inputServices, invokedServices)
        }

        beforeEach(() => {
          mockUpdateWorkspace.mockClear()
          mockApproveIsolatedMode.mockReset()
          mockFetchEmpty.mockClear()
        })

        describe('when user accept changes', () => {
          it('should not suggest when no new services exist', async () => {
            mockApproveIsolatedMode.mockResolvedValueOnce(true)
            await runFetchWithExisting(
              ['salesforce'],
              { dev: ['salesforce'], prod: ['salesforce'] },
              'dev',
              false
            )
            expect(mockApproveIsolatedMode).not.toHaveBeenCalled()
            expect(verifyUpdateCall(['salesforce'], false)).toBeTruthy()
          })
          it('should not suggest when no multiple envs exist', async () => {
            mockApproveIsolatedMode.mockResolvedValueOnce(true)
            await runFetchWithExisting(
              ['salesforce'],
              { dev: [] },
              'dev',
              false
            )
            expect(mockApproveIsolatedMode).not.toHaveBeenCalled()
            expect(verifyUpdateCall(['salesforce'], false)).toBeTruthy()
          })
          it('should not suggest when fetching in isolated mode for only for new services', async () => {
            mockApproveIsolatedMode.mockResolvedValueOnce(true)
            await runFetchWithExisting(
              ['salesforce'],
              { dev: ['hubspot'], prod: ['salesforce', 'hubspot'] },
              'dev',
              true
            )
            expect(mockApproveIsolatedMode).not.toHaveBeenCalled()
            expect(verifyUpdateCall(['salesforce'], true)).toBeTruthy()
          })
          it('should not suggest when fetching in isolated mode mode and all services are old', async () => {
            mockApproveIsolatedMode.mockResolvedValueOnce(true)
            await runFetchWithExisting(
              ['salesforce', 'hubspot'],
              { dev: ['salesforce', 'hubspot'], prod: ['salesforce', 'hubspot'] },
              'dev',
              true
            )
            expect(mockApproveIsolatedMode).not.toHaveBeenCalled()
            expect(verifyUpdateCall(['salesforce', 'hubspot'], true)).toBeTruthy()
          })
          it('should suggest isolated mode mode when fetching a new env without isolated mode', async () => {
            mockApproveIsolatedMode.mockResolvedValueOnce(true)
            await runFetchWithExisting(
              ['salesforce'],
              { dev: [], prod: ['salesforce'] },
              'dev',
              false
            )
            expect(mockApproveIsolatedMode).toHaveBeenCalled()
            expect(verifyUpdateCall(['salesforce'], true)).toBeTruthy()
          })
          it('should suggest when fetching in isolated mode with existing services and new services', async () => {
            mockApproveIsolatedMode.mockResolvedValueOnce(true)
            await runFetchWithExisting(
              ['salesforce', 'hubspot'],
              { dev: ['salesforce'], prod: ['salesforce', 'hubspot'] },
              'dev',
              true
            )
            expect(mockApproveIsolatedMode).toHaveBeenCalled()
            expect(verifyUpdateCall(['hubspot'], true)).toBeTruthy()
          })
        })

        describe('when the user rejects the recommendation', () => {
          it('should not modify fetch parameters it the user rejects the recommendation without isolated', async () => {
            mockApproveIsolatedMode.mockResolvedValueOnce(false)
            await runFetchWithExisting(
              ['salesforce'],
              { dev: [], prod: ['salesforce'] },
              'dev',
              false
            )
            expect(mockApproveIsolatedMode).toHaveBeenCalled()
            expect(verifyUpdateCall(['salesforce'], false)).toBeTruthy()
          })
          it('should not modify fetch parameters it the user rejects the recommendation with isolated', async () => {
            mockApproveIsolatedMode.mockResolvedValueOnce(false)
            await runFetchWithExisting(
              ['salesforce', 'hubspot'],
              { dev: [], prod: ['salesforce'] },
              'dev',
              true
            )
            expect(mockApproveIsolatedMode).toHaveBeenCalled()
            expect(verifyUpdateCall(['salesforce', 'hubspot'], true)).toBeTruthy()
          })
        })
      })
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
        false,
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
        false,
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
