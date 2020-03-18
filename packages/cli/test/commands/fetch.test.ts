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
  StepEmitter,
} from '@salto-io/core'
import { Spinner, SpinnerCreator, CliExitCode } from '../../src/types'
import { command, fetchCommand } from '../../src/commands/fetch'
import * as mocks from '../mocks'
import Prompts from '../../src/prompts'
import * as mockCliWorkspace from '../../src/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'

const commandName = 'fetch'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
  changes: buildEventName(commandName, 'changes'),
  changesToApply: buildEventName(commandName, 'changesToApply'),
}

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  fetch: jest.fn().mockImplementation(() => Promise.resolve({
    changes: [],
    mergeErrors: [],
    configChanges: [],
    success: true,
  })),
}))
jest.mock('../../src/workspace')
describe('fetch command', () => {
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const mockLoadWorkspace = mockCliWorkspace.loadWorkspace as jest.Mock
  const mockUpdateWorkspace = mockCliWorkspace.updateWorkspace as jest.Mock
  mockUpdateWorkspace.mockImplementation(ws =>
    Promise.resolve(ws.config.baseDir !== 'exist-on-error'))
  const findWsUpdateCalls = (workspaceDir: string): unknown[][][] =>
    mockUpdateWorkspace.mock.calls.filter(args => args[0].config.baseDir === workspaceDir)

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
          getWorkspaceErrors: mocks.getWorkspaceErrors,
        } as unknown as Workspace
        mockLoadWorkspace.mockResolvedValueOnce({ workspace: erroredWorkspace, errored: true })
        result = await command('', true, false, mockTelemetry, cliOutput, spinnerCreator, services, false)
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
      const workspaceDir = 'valid-ws'
      beforeAll(async () => {
        mockTelemetry = mocks.getMockTelemetry()
        mockLoadWorkspace.mockResolvedValue({
          workspace: mocks.mockLoadWorkspace(workspaceDir),
          errored: false,
        })
        result = await command(
          workspaceDir,
          true, false,
          mockTelemetry,
          cliOutput,
          spinnerCreator,
          services,
          false
        ).execute()
      })

      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call fetch', () => {
        expect(fetch).toHaveBeenCalled()
      })

      it('should update changes', () => {
        const calls = findWsUpdateCalls(workspaceDir)
        expect(calls).toHaveLength(1)
        expect(_.isEmpty(calls[0][2])).toBeTruthy()
      })

      it('should send telemetry events', () => {
        expect(mockTelemetry.getEvents()).toHaveLength(4)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.start]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.changes]).toHaveLength(1)
        expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply]).toHaveLength(1)
      })
    })

    describe('fetch command', () => {
      const mockFetch = jest.fn().mockResolvedValue(
        { changes: [], mergeErrors: [], configChanges: [], success: true }
      )
      const mockFailedFetch = jest.fn().mockResolvedValue(
        { changes: [], mergeErrors: [], configChanges: [], success: false }
      )
      const mockEmptyApprove = jest.fn().mockResolvedValue([])
      const mockUpdateConfig = jest.fn().mockResolvedValue(true)
      const mockConfigSourceSet = jest.fn()

      const mockWorkspace = (elements?: Element[]): Workspace => ({
        hasErrors: () => false,
        elements: elements || [],
        config: { services },
        adapterConfig: { get: jest.fn(), set: mockConfigSourceSet },
        updateBlueprints: jest.fn(),
        flush: jest.fn(),
        isEmpty: () => (elements || []).length === 0,
      } as unknown as Workspace)

      describe('with emitters called', () => {
        const mockFetchWithEmitter: jest.Mock = jest.fn((
          _workspace,
          _services,
          progressEmitter: EventEmitter<FetchProgressEvents>
        ) => {
          const getChangesEmitter = new StepEmitter()
          progressEmitter.emit('changesWillBeFetched', getChangesEmitter, ['adapterName'])
          getChangesEmitter.emit('completed')
          const calculateDiffEmitter = new StepEmitter()
          progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
          calculateDiffEmitter.emit('failed')
          return Promise.resolve(
            { changes: [], mergeErrors: [], configChanges: [], success: true }
          )
        })
        beforeEach(async () => {
          mockTelemetry = mocks.getMockTelemetry()
          await fetchCommand({
            workspace: mockWorkspace(),
            force: true,
            interactive: false,
            output: cliOutput,
            inputServices: services,
            cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
            fetch: mockFetchWithEmitter,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockUpdateConfig,
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
        const workspaceDir = 'no-changes'
        beforeEach(async () => {
          mockTelemetry = mocks.getMockTelemetry()
          workspace = mockWorkspace()
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
          })
        })
        it('should not update workspace', () => {
          const calls = findWsUpdateCalls(workspaceDir)
          expect(calls).toHaveLength(0)
          expect(mockTelemetry.getEvents()).toHaveLength(4)
          expect(mockTelemetry.getEventsMap()[eventsNames.changes]).not.toBeUndefined()
          expect(mockTelemetry.getEventsMap()[eventsNames.changes]).toHaveLength(1)
          expect(mockTelemetry.getEventsMap()[eventsNames.changes][0].value).toEqual(0)
        })
      })
      describe('with changes to write to config', () => {
        const workspaceDir = 'with-config-changes'
        let workspace: Workspace
        const mockShouldUpdateConfig = jest.fn()
          .mockResolvedValueOnce(Promise.resolve(true))
          .mockResolvedValueOnce(Promise.resolve(false))
        const newConfig = new InstanceElement(
          services[0],
          new ObjectType({ elemID: new ElemID('salesforce') }),
          {
            metadataTypesSkippedList: ['Skipped'],
          }
        )
        const mockFetchWithChanges = jest.fn().mockResolvedValue(
          {
            changes: [],
            configChanges: [
              {
                config: newConfig,
                messages: ['Skipped'],
              },
            ],
            mergeErrors: [],
            success: true,
          }
        )
        beforeEach(async () => {
          mockTelemetry = mocks.getMockTelemetry()
          mockConfigSourceSet.mockReset()
          workspace = mockWorkspace()
          workspace.config.baseDir = workspaceDir
          result = await fetchCommand({
            workspace,
            force: true,
            interactive: false,
            inputServices: services,
            cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
            output: cliOutput,
            fetch: mockFetchWithChanges,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockShouldUpdateConfig,
          })
        })

        it('should write config when continue was requested', () => {
          expect(result).toBe(CliExitCode.Success)
          expect(mockConfigSourceSet).toHaveBeenCalledWith('salesforce', newConfig)
        })

        it('should not write config when abort was requested', () => {
          expect(result).toBe(CliExitCode.UserInputError)
          expect(mockConfigSourceSet).not.toHaveBeenCalled()
        })
      })
      describe('with upstream changes', () => {
        const changes = mocks.dummyChanges.map(
          (change: DetailedChange): FetchChange => ({ change, serviceChange: change })
        )
        const mockFetchWithChanges = jest.fn().mockResolvedValue(
          {
            changes,
            configChanges: [],
            mergeErrors: [],
            success: true,
          }
        )
        describe('when called with force', () => {
          const workspaceDir = 'with-force'
          let workspace: Workspace
          beforeEach(async () => {
            mockTelemetry = mocks.getMockTelemetry()
            workspace = mockWorkspace()
            workspace.config.baseDir = workspaceDir
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
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should deploy all changes', () => {
            const calls = findWsUpdateCalls(workspaceDir)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, undefined])
          })
        })
        describe('when called with strict', () => {
          const workspaceDir = 'with-strict'
          let workspace: Workspace
          beforeEach(async () => {
            mockTelemetry = mocks.getMockTelemetry()
            workspace = mockWorkspace()
            workspace.config.baseDir = workspaceDir
            result = await fetchCommand({
              workspace,
              force: true,
              interactive: false,
              inputServices: services,
              cliTelemetry: getCliTelemetry(mockTelemetry, 'fetch'),
              output: cliOutput,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              strict: true,
              shouldUpdateConfig: mockUpdateConfig,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should forward strict mode', () => {
            const calls = findWsUpdateCalls(workspaceDir)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, true])
          })
        })
        describe('when initial workspace is empty', () => {
          const workspaceDir = 'ws-empty'
          const workspace = mockWorkspace()
          workspace.config.baseDir = workspaceDir
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
            })
          })
          it('should deploy all changes', () => {
            const calls = findWsUpdateCalls(workspaceDir)
            expect(calls).toHaveLength(1)
            expect(calls[0].slice(2)).toEqual([changes, undefined])
          })
        })
        describe('when initial workspace is not empty', () => {
          describe('if no change is approved', () => {
            let workspace: Workspace
            const workspaceDir = 'no-approve'
            beforeEach(async () => {
              mockTelemetry = mocks.getMockTelemetry()
              workspace = mockWorkspace([new ObjectType({ elemID: new ElemID('adapter', 'type') })])
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
              })
            })
            it('should not update workspace', () => {
              const calls = findWsUpdateCalls(workspaceDir)
              expect(calls).toHaveLength(0)
              expect(mockTelemetry.getEvents()).toHaveLength(4)
              expect(mockTelemetry.getEventsMap()[eventsNames.changes]).not.toBeUndefined()
              expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply]).not.toBeUndefined()
            })
          })
          describe('if some changes are approved', () => {
            const mockSingleChangeApprove = jest.fn().mockImplementation(cs =>
              Promise.resolve([cs[0]]))

            it('should update workspace only with approved changes', async () => {
              const workspace = mockWorkspace(mocks.elements())
              const workspaceDir = 'single-approve'
              workspace.config.baseDir = workspaceDir
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
              })
              const calls = findWsUpdateCalls(workspaceDir)
              expect(calls).toHaveLength(1)
              expect(calls[0][2][0]).toEqual(changes[0])
              expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply]).not.toBeUndefined()
              expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply]).toHaveLength(1)
              expect(mockTelemetry.getEventsMap()[eventsNames.changesToApply][0].value).toEqual(1)
            })

            it('should exit if errors identified in workspace after update', async () => {
              const workspace = mockWorkspace(mocks.elements())
              const workspaceDir = 'exist-on-error'
              workspace.config.baseDir = workspaceDir
              workspace.getWorkspaceErrors = async () => [{
                sourceFragments: [],
                message: 'BLA Error',
                severity: 'Error',
              }]
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
              })
              const calls = findWsUpdateCalls(workspaceDir)
              expect(calls).toHaveLength(1)
              expect(calls[0][2][0]).toEqual(changes[0])
              expect(res).toBe(CliExitCode.AppError)
            })
            it('should not exit if warning identified in workspace after update', async () => {
              const workspace = mockWorkspace(mocks.elements())
              const workspaceDir = 'warn'
              workspace.config.baseDir = workspaceDir
              workspace.getWorkspaceErrors = async () => [{
                sourceFragments: [],
                message: 'BLA Warning',
                severity: 'Warning',
              }]
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
              })
              const calls = findWsUpdateCalls(workspaceDir)
              expect(calls).toHaveLength(1)
              expect(calls[0][2][0]).toEqual(changes[0])
              expect(cliOutput.stderr.content).not.toContain(Prompts.SHOULD_CONTINUE(1))
              expect(cliOutput.stdout.content).not.toContain(Prompts.SHOULD_CONTINUE(1))
              expect(res).toBe(CliExitCode.Success)
            })
            it('should not update workspace if fetch failed', async () => {
              const workspace = mockWorkspace(mocks.elements())
              const workspaceDir = 'fail'
              mockTelemetry = mocks.getMockTelemetry()
              workspace.config.baseDir = workspaceDir
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
              })
              expect(cliOutput.stderr.content).toContain('Error')
              const calls = findWsUpdateCalls(workspaceDir)
              expect(calls).toHaveLength(0)
              expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
              expect(mockTelemetry.getEventsMap()[eventsNames.failure]).toHaveLength(1)
            })
          })
        })
      })
    })
  })
})
