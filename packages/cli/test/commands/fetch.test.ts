/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { EventEmitter } from 'pietile-eventemitter'
import { InstanceElement } from '@salto-io/adapter-api'
import {
  fetch,
  fetchFromWorkspace,
  FetchProgressEvents,
  StepEmitter,
  FetchFunc,
  loadLocalWorkspace,
} from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { mockFunction } from '@salto-io/test-utils'
import { CliExitCode, CliTelemetry, CliError } from '../../src/types'
import * as fetchCmd from '../../src/commands/fetch'
import { action, fetchCommand, FetchCommandArgs } from '../../src/commands/fetch'
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import { buildEventName } from '../../src/telemetry'

const commandName = 'fetch'
const eventsNames = {
  changes: buildEventName(commandName, 'changes'),
}

jest.mock('@salto-io/core', () => ({
  ...jest.requireActual<{}>('@salto-io/core'),
  fetch: jest.fn().mockImplementation(() =>
    Promise.resolve({
      changes: [],
      mergeErrors: [],
      success: true,
    }),
  ),
  fetchFromWorkspace: jest.fn().mockImplementation(() =>
    Promise.resolve({
      changes: [],
      mergeErrors: [],
      success: true,
    }),
  ),
  loadLocalWorkspace: jest.fn().mockImplementation(() => mocks.mockWorkspace({})),
}))
describe('fetch command', () => {
  const accounts = ['salesforce']
  let cliCommandArgs: mocks.MockCommandArgs
  let telemetry: mocks.MockTelemetry
  let cliTelemetry: CliTelemetry
  let output: mocks.MockCliOutput

  beforeEach(() => {
    ;(fetch as jest.Mock).mockClear()
    const cliArgs = mocks.mockCliArgs()
    cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
    telemetry = cliArgs.telemetry
    output = cliArgs.output
    cliTelemetry = cliCommandArgs.cliTelemetry
  })

  describe('execute', () => {
    let result: number
    describe('with errored workspace', () => {
      beforeEach(async () => {
        const workspace = mocks.mockWorkspace({})
        workspace.errors.mockResolvedValue(mocks.mockErrors([{ severity: 'Error', message: 'some error' }]))
        result = await action({
          ...cliCommandArgs,
          input: {
            force: true,
            mode: 'default',
            accounts,
            stateOnly: false,
            regenerateSaltoIds: false,
            fromState: false,
          },
          workspace,
        })
      })

      it('should fail', async () => {
        expect(result).toBe(CliExitCode.AppError)
        expect(fetch).not.toHaveBeenCalled()
      })
    })

    describe('with valid workspace and no changes', () => {
      let workspace: mocks.MockWorkspace
      beforeEach(async () => {
        workspace = mocks.mockWorkspace({})
        result = await action({
          ...cliCommandArgs,
          input: {
            force: true,
            mode: 'default',
            accounts,
            stateOnly: false,
            fromState: false,
            regenerateSaltoIds: false,
          },
          workspace,
        })
      })

      it('should return success code', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should call fetch', () => {
        expect(fetch).toHaveBeenCalled()
      })
      it('should send telemetry events', () => {
        expect(telemetry.getEventsMap()[eventsNames.changes]).toHaveLength(1)
      })
    })

    describe('when using implicit all accounts', () => {
      let workspace: mocks.MockWorkspace

      beforeEach(async () => {
        workspace = mocks.mockWorkspace({})
        result = await action({
          ...cliCommandArgs,
          input: {
            force: true,
            mode: 'default',
            stateOnly: false,
            fromState: false,
            regenerateSaltoIds: false,
          },
          workspace,
        })
      })

      it('should fetch both accounts', () => {
        expect((fetch as jest.Mock).mock.calls[0][2]).toEqual(['salesforce', 'netsuite'])
      })
    })

    describe('fetch command', () => {
      const mockFetch = jest.fn().mockResolvedValue({ changes: [], mergeErrors: [], success: true })
      const mockEmptyApprove = jest.fn().mockResolvedValue([])
      const mockUpdateConfig = jest.fn().mockResolvedValue(true)

      describe('with emitters called', () => {
        const mockFetchWithEmitter: jest.Mock = jest.fn(
          (_workspace, progressEmitter: EventEmitter<FetchProgressEvents>, _accounts) => {
            const getChangesEmitter = new StepEmitter()
            progressEmitter.emit('changesWillBeFetched', getChangesEmitter, ['adapterName'])
            progressEmitter.emit('adapterProgress', 'salesforce', 'fetch', { message: 'fetching message' })
            getChangesEmitter.emit('completed')
            const calculateDiffEmitter = new StepEmitter()
            progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
            calculateDiffEmitter.emit('failed')
            return Promise.resolve({ changes: [], mergeErrors: [], success: true })
          },
        )
        beforeEach(async () => {
          await fetchCommand({
            workspace: mocks.mockWorkspace({}),
            force: true,
            output,
            cliTelemetry,
            fetch: mockFetchWithEmitter,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockUpdateConfig,
            mode: 'default',
            shouldCalcTotalSize: true,
            accounts,
            stateOnly: false,
            regenerateSaltoIds: false,
          })
        })
        it('should start at least one step', () => {
          expect(output.stdout.content).toContain('>>>')
        })
        it('should report at least one adapter fetching progress', () => {
          expect(output.stdout.content).toContain('salesforce adapter:')
        })
        it('should finish one step', () => {
          expect(output.stdout.content).toContain('vvv')
        })
        it('should fail one step', () => {
          expect(output.stdout.content).toContain('xxx')
        })
      })
      describe('with no upstream changes', () => {
        let workspace: Workspace
        beforeEach(async () => {
          workspace = mocks.mockWorkspace({})
          await fetchCommand({
            workspace,
            force: true,
            output,
            accounts,
            cliTelemetry,
            fetch: mockFetch,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockUpdateConfig,
            mode: 'default',
            shouldCalcTotalSize: true,
            stateOnly: false,
            regenerateSaltoIds: false,
          })
        })
        it('should not update workspace', () => {
          expect(workspace.updateNaclFiles).toHaveBeenCalledWith([], 'default')
          expect(telemetry.getEventsMap()[eventsNames.changes]).toHaveLength(1)
          expect(telemetry.getEventsMap()[eventsNames.changes][0].value).toEqual(0)
        })
      })
      describe('with changes to write to config', () => {
        const mockShouldUpdateConfig = jest.fn()
        let fetchArgs: FetchCommandArgs
        let newConfig: InstanceElement

        beforeEach(async () => {
          const { plan, updatedConfig } = mocks.configChangePlan()
          newConfig = updatedConfig
          const mockFetchWithChanges = jest.fn().mockResolvedValue({
            changes: [],
            configChanges: plan,
            updatedConfig: { [newConfig.elemID.adapter]: [newConfig] },
            mergeErrors: [],
            success: true,
          })
          const workspace = mocks.mockWorkspace({})
          fetchArgs = {
            workspace,
            force: false,
            accounts,
            cliTelemetry,
            output,
            fetch: mockFetchWithChanges,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockShouldUpdateConfig,
            mode: 'default',
            shouldCalcTotalSize: true,
            stateOnly: false,
            regenerateSaltoIds: false,
          }
        })

        it('should write config when continue was requested', async () => {
          mockShouldUpdateConfig.mockResolvedValueOnce(Promise.resolve(true))
          result = await fetchCommand(fetchArgs)
          expect(result).toBe(CliExitCode.Success)
          expect(fetchArgs.workspace.updateAccountConfig).toHaveBeenCalledWith('salesforce', [newConfig], 'salesforce')
        })

        it('should not write config when abort was requested', async () => {
          mockShouldUpdateConfig.mockResolvedValueOnce(Promise.resolve(false))
          result = await fetchCommand(fetchArgs)
          expect(result).toBe(CliExitCode.UserInputError)
          expect(fetchArgs.workspace.updateAccountConfig).not.toHaveBeenCalled()
        })
      })
      describe('with upstream changes', () => {
        const changes = mocks.dummyChanges.map(change => ({ change, serviceChanges: [change] }))
        const mockFetchWithChanges = jest.fn().mockResolvedValue({
          changes,
          mergeErrors: [],
          success: true,
        })
        describe('when called with force', () => {
          let workspace: Workspace
          beforeEach(async () => {
            workspace = mocks.mockWorkspace({})
            result = await fetchCommand({
              workspace,
              force: true,
              accounts,
              cliTelemetry,
              output,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              shouldUpdateConfig: mockUpdateConfig,
              mode: 'default',
              shouldCalcTotalSize: true,
              stateOnly: false,
              regenerateSaltoIds: false,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should deploy all changes', () => {
            expect(workspace.updateNaclFiles).toHaveBeenCalledWith(
              changes.map(change => change.change),
              'default',
            )
          })
        })
        describe('when called with isolated', () => {
          let workspace: Workspace
          beforeEach(async () => {
            workspace = mocks.mockWorkspace({})
            result = await fetchCommand({
              workspace,
              force: true,
              accounts,
              cliTelemetry,
              output,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              mode: 'isolated',
              shouldUpdateConfig: mockUpdateConfig,
              shouldCalcTotalSize: true,
              stateOnly: false,
              regenerateSaltoIds: false,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should forward strict mode', () => {
            expect(workspace.updateNaclFiles).toHaveBeenCalledWith(
              changes.map(change => change.change),
              'isolated',
            )
          })
        })
        describe('when called with align', () => {
          let workspace: Workspace
          beforeEach(async () => {
            workspace = mocks.mockWorkspace({})
            result = await fetchCommand({
              workspace,
              force: true,
              accounts,
              cliTelemetry,
              output,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              mode: 'align',
              shouldUpdateConfig: mockUpdateConfig,
              shouldCalcTotalSize: true,
              stateOnly: false,
              regenerateSaltoIds: false,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should forward align mode', () => {
            expect(workspace.updateNaclFiles).toHaveBeenCalledWith(
              changes.map(change => change.change),
              'align',
            )
          })
        })
        describe('when called with override', () => {
          let workspace: Workspace
          beforeEach(async () => {
            workspace = mocks.mockWorkspace({})
            result = await fetchCommand({
              workspace,
              force: true,
              accounts,
              cliTelemetry,
              output,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              mode: 'override',
              shouldUpdateConfig: mockUpdateConfig,
              shouldCalcTotalSize: true,
              stateOnly: false,
              regenerateSaltoIds: false,
            })
            expect(result).toBe(CliExitCode.Success)
          })
          it('should forward override mode', () => {
            expect(workspace.updateNaclFiles).toHaveBeenCalledWith(
              changes.map(change => change.change),
              'override',
            )
          })
        })
        describe('when called with state only', () => {
          describe('should error if mode is not default', () => {
            it('should throw an error', () =>
              expect(
                fetchCommand({
                  workspace: mocks.mockWorkspace({}),
                  force: true,
                  accounts,
                  cliTelemetry,
                  output,
                  fetch: mockFetchWithChanges,
                  getApprovedChanges: mockEmptyApprove,
                  mode: 'align',
                  shouldUpdateConfig: mockUpdateConfig,
                  shouldCalcTotalSize: true,
                  stateOnly: true,
                  regenerateSaltoIds: false,
                }),
              ).rejects.toThrow())
          })
          describe('when state is updated', () => {
            let workspace: Workspace
            beforeEach(async () => {
              workspace = mocks.mockWorkspace({})
              result = await fetchCommand({
                workspace,
                force: true,
                accounts,
                cliTelemetry,
                output,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockEmptyApprove,
                mode: 'default',
                shouldUpdateConfig: mockUpdateConfig,
                shouldCalcTotalSize: true,
                stateOnly: true,
                regenerateSaltoIds: false,
              })
            })
            it('should return OK status when state is updated', () => {
              expect(result).toBe(CliExitCode.Success)
            })
            it('should not apply changes in stateOnlyMode', async () => {
              expect(workspace.updateNaclFiles).toHaveBeenCalledWith(
                changes.map(change => change.change),
                'default',
                true,
              )
            })
          })
          describe('when state failed to update', () => {
            let workspace: mocks.MockWorkspace
            beforeEach(async () => {
              workspace = mocks.mockWorkspace({})
              workspace.flush.mockImplementation(() => {
                throw new Error('failed to flush')
              })
              result = await fetchCommand({
                workspace,
                force: true,
                accounts,
                cliTelemetry,
                output,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockEmptyApprove,
                mode: 'default',
                shouldUpdateConfig: mockUpdateConfig,
                shouldCalcTotalSize: true,
                stateOnly: true,
                regenerateSaltoIds: false,
              })
            })
            it('should return AppError status when state is updated', () => {
              expect(result).toBe(CliExitCode.AppError)
            })
          })
        })
        describe('when initial workspace is empty', () => {
          let workspace: mocks.MockWorkspace
          beforeEach(async () => {
            workspace = mocks.mockWorkspace({})
            workspace.isEmpty.mockResolvedValue(true)
            await fetchCommand({
              workspace,
              force: false,
              accounts,
              cliTelemetry,
              output,
              fetch: mockFetchWithChanges,
              getApprovedChanges: mockEmptyApprove,
              shouldUpdateConfig: mockUpdateConfig,
              mode: 'default',
              shouldCalcTotalSize: true,
              stateOnly: false,
              regenerateSaltoIds: false,
            })
          })
          it('should deploy all changes', () => {
            expect(workspace.updateNaclFiles).toHaveBeenCalledWith(
              changes.map(change => change.change),
              'default',
            )
          })
        })
        describe('when initial workspace is not empty', () => {
          describe('if some changes are approved', () => {
            const mockSingleChangeApprove = jest.fn().mockImplementation(cs => Promise.resolve([cs[0]]))

            it('should update workspace only with approved changes', async () => {
              const workspace = mocks.mockWorkspace({})
              await fetchCommand({
                workspace,
                force: false,
                accounts,
                cliTelemetry,
                output,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockSingleChangeApprove,
                shouldUpdateConfig: mockUpdateConfig,
                mode: 'default',
                shouldCalcTotalSize: true,
                stateOnly: false,
                regenerateSaltoIds: false,
              })
              expect(workspace.updateNaclFiles).toHaveBeenCalledWith([changes[0].change], 'default')
            })

            it('should exit if errors identified in workspace after update', async () => {
              const abortIfErrorCallback = jest.spyOn(callbacks, 'shouldAbortWorkspaceInCaseOfValidationError')
              abortIfErrorCallback.mockResolvedValue(true)

              const workspace = mocks.mockWorkspace({})
              workspace.updateNaclFiles.mockImplementation(async () => {
                // Make the workspace errored after updateNaclFiles is called
                workspace.errors.mockResolvedValue(mocks.mockErrors([{ severity: 'Error', message: 'BLA Error' }]))
                return { naclFilesChangesCount: 0, stateOnlyChangesCount: 0 }
              })

              const res = await fetchCommand({
                workspace,
                force: false,
                accounts,
                cliTelemetry,
                output,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockSingleChangeApprove,
                shouldUpdateConfig: mockUpdateConfig,
                mode: 'default',
                shouldCalcTotalSize: true,
                stateOnly: false,
                regenerateSaltoIds: false,
              })
              expect(workspace.updateNaclFiles).toHaveBeenCalledWith([changes[0].change], 'default')
              expect(res).toBe(CliExitCode.AppError)

              abortIfErrorCallback.mockRestore()
            })
            it('should not exit if warning identified in workspace after update', async () => {
              const workspace = mocks.mockWorkspace({})
              workspace.updateNaclFiles.mockImplementation(async () => {
                // Make the workspace errored after updateNaclFiles is called
                workspace.errors.mockResolvedValue(mocks.mockErrors([{ severity: 'Warning', message: 'BLA Error' }]))
                return { naclFilesChangesCount: 0, stateOnlyChangesCount: 0 }
              })

              const res = await fetchCommand({
                workspace,
                force: false,
                accounts,
                cliTelemetry,
                output,
                fetch: mockFetchWithChanges,
                getApprovedChanges: mockSingleChangeApprove,
                shouldUpdateConfig: mockUpdateConfig,
                mode: 'default',
                shouldCalcTotalSize: true,
                stateOnly: false,
                regenerateSaltoIds: false,
              })
              expect(workspace.updateNaclFiles).toHaveBeenCalledWith([changes[0].change], 'default')
              expect(res).toBe(CliExitCode.Success)
            })
          })
        })
      })
      describe('with merge errors', () => {
        const mockFetchWithChanges = mockFunction<FetchFunc>().mockResolvedValue({
          changes: [],
          fetchErrors: [],
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
          updatedConfig: {},
          success: true,
        })
        beforeEach(async () => {
          const workspace = mocks.mockWorkspace({})
          result = await fetchCommand({
            workspace,
            force: true,
            cliTelemetry,
            output,
            fetch: mockFetchWithChanges,
            getApprovedChanges: mockEmptyApprove,
            shouldUpdateConfig: mockUpdateConfig,
            mode: 'default',
            shouldCalcTotalSize: true,
            stateOnly: false,
            accounts: [],
            regenerateSaltoIds: false,
          })
        })
        it('should succeed', () => {
          expect(result).toBe(CliExitCode.Success)
        })
        it('should print merge errors', () => {
          expect(output.stderr.content).toContain(mocks.elements()[0].elemID.getFullName())
          expect(output.stderr.content).toContain('test merge error')
        })
      })
    })
  })
  describe('multienv - new account in env, with existing common elements', () => {
    let workspace: mocks.MockWorkspace
    beforeEach(() => {
      workspace = mocks.mockWorkspace({})
      workspace.hasElementsInAccounts.mockResolvedValue(true)
      workspace.getStateRecency.mockResolvedValue({
        serviceName: 'salesforce',
        accountName: 'salesforce',
        status: 'Nonexistent',
        date: undefined,
      })
      jest.spyOn(fetchCmd, 'fetchCommand').mockImplementationOnce(() => Promise.resolve(CliExitCode.Success))
    })
    afterEach(() => {
      jest.clearAllMocks()
    })
    afterAll(() => {
      jest.restoreAllMocks()
    })

    it('should prompt to change mode, and continue as-is on "no"', async () => {
      jest.spyOn(callbacks, 'getChangeToAlignAction').mockImplementationOnce(() => Promise.resolve('no'))
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          mode: 'default',
          accounts,
          stateOnly: false,
          fromState: false,
          regenerateSaltoIds: false,
        },
        workspace,
      })

      expect(callbacks.getChangeToAlignAction).toHaveBeenCalledTimes(1)
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('default')
    })
    it('should prompt to change mode, and change to "align" on "yes"', async () => {
      jest.spyOn(callbacks, 'getChangeToAlignAction').mockImplementationOnce(() => Promise.resolve('yes'))

      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          mode: 'override',
          accounts,
          stateOnly: false,
          fromState: true,
          regenerateSaltoIds: false,
        },
        workspace,
      })

      expect(callbacks.getChangeToAlignAction).toHaveBeenCalledTimes(1)
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('align')
    })
    it('should prompt to change mode, and cancel on "cancel operation"', async () => {
      jest.spyOn(callbacks, 'getChangeToAlignAction').mockImplementationOnce(() => Promise.resolve('cancel operation'))
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          mode: 'default',
          accounts,
          stateOnly: false,
          fromState: true,
          regenerateSaltoIds: false,
        },
        workspace,
      })

      expect(callbacks.getChangeToAlignAction).toHaveBeenCalledTimes(1)
      expect(fetchCmd.fetchCommand).not.toHaveBeenCalled()
    })
    it('should not prompt if running with force=true', async () => {
      jest.spyOn(callbacks, 'getChangeToAlignAction').mockImplementationOnce(() => Promise.resolve('no'))
      await action({
        ...cliCommandArgs,
        input: {
          force: true,
          mode: 'override',
          accounts,
          stateOnly: false,
          fromState: false,
          regenerateSaltoIds: false,
        },
        workspace,
      })

      expect(callbacks.getChangeToAlignAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('override')
    })
    it('should not prompt if already ran account', async () => {
      jest.spyOn(callbacks, 'getChangeToAlignAction').mockImplementationOnce(() => Promise.resolve('no'))
      workspace.getStateRecency.mockResolvedValue({
        serviceName: 'salesforce',
        accountName: 'salesforce',
        status: 'Valid',
        date: new Date(),
      })
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          mode: 'default',
          accounts,
          stateOnly: false,
          fromState: false,
          regenerateSaltoIds: false,
        },
        workspace,
      })

      expect(callbacks.getChangeToAlignAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('default')
    })
    it('should not prompt if mode is align', async () => {
      jest.spyOn(callbacks, 'getChangeToAlignAction').mockImplementationOnce(() => Promise.resolve('no'))
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          mode: 'align',
          accounts,
          stateOnly: false,
          fromState: false,
          regenerateSaltoIds: false,
        },
        workspace,
      })
      expect(callbacks.getChangeToAlignAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('align')
    })
    it('should not prompt if nothing is under common', async () => {
      jest.spyOn(callbacks, 'getChangeToAlignAction').mockImplementation(() => Promise.resolve('no'))
      workspace.hasElementsInAccounts.mockResolvedValue(false)
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          mode: 'default',
          accounts,
          stateOnly: false,
          fromState: false,
          regenerateSaltoIds: false,
        },
        workspace,
      })
      expect(callbacks.getChangeToAlignAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('default')
    })

    it('should not prompt if only one of the accounts is new', async () => {
      jest.spyOn(callbacks, 'getChangeToAlignAction').mockImplementationOnce(() => Promise.resolve('no'))
      workspace.getStateRecency.mockImplementation(async accountName => ({
        serviceName: accountName,
        accountName,
        status: accountName === 'salesforce' ? 'Nonexistent' : 'Valid',
        date: accountName === 'salesforce' ? undefined : new Date(),
      }))
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          mode: 'override',
          stateOnly: false,
          fromState: false,
          regenerateSaltoIds: false,
        },
        workspace,
      })
      expect(callbacks.getChangeToAlignAction).not.toHaveBeenCalled()
      expect(fetchCmd.fetchCommand).toHaveBeenCalledTimes(1)
      expect((fetchCmd.fetchCommand as jest.Mock).mock.calls[0][0].mode).toEqual('override')
    })
  })

  describe('Verify using env command', () => {
    it('should use current env when env is not provided', async () => {
      const workspace = mocks.mockWorkspace({})
      await action({
        ...cliCommandArgs,
        input: {
          force: true,
          mode: 'default',
          accounts,
          stateOnly: false,
          fromState: false,
          regenerateSaltoIds: false,
        },
        workspace,
      })
      expect(workspace.setCurrentEnv).not.toHaveBeenCalled()
    })
    it('should use provided env', async () => {
      const workspace = mocks.mockWorkspace({})
      await action({
        ...cliCommandArgs,
        input: {
          force: true,
          mode: 'default',
          accounts,
          stateOnly: false,
          fromState: false,
          env: mocks.withEnvironmentParam,
          regenerateSaltoIds: false,
        },
        workspace,
      })
      expect(workspace.setCurrentEnv).toHaveBeenCalledWith(mocks.withEnvironmentParam, false)
    })
    it('should fail if provided env does not exist', async () => {
      await expect(
        action({
          ...cliCommandArgs,
          input: {
            force: false,
            mode: 'default',
            accounts,
            stateOnly: false,
            fromState: false,
            env: 'envThatDoesNotExist',
            regenerateSaltoIds: false,
          },
          workspace: mocks.mockWorkspace({}),
        }),
      ).rejects.toThrow(new CliError(CliExitCode.AppError))
    })
  })

  describe('fetch from workspace', () => {
    let mockFetchFromWorkspace: jest.Mock
    let mockLoadLocalWorkspace: jest.Mock

    beforeAll(() => {
      mockFetchFromWorkspace = fetchFromWorkspace as jest.Mock
      mockLoadLocalWorkspace = loadLocalWorkspace as jest.Mock
    })

    beforeEach(() => {
      mockFetchFromWorkspace.mockClear()
      mockLoadLocalWorkspace.mockClear()
    })

    describe('success', () => {
      describe('when called with fromState false', () => {
        it('should invoke the fetch from workspace method with fromState false', async () => {
          const workspace = mocks.mockWorkspace({ uid: 'target' })
          const sourceWS = mocks.mockWorkspace({ uid: 'source' })
          const sourcePath = 'path/to/source'
          const env = 'sourceEnv'
          mockLoadLocalWorkspace.mockResolvedValueOnce(sourceWS)
          await action({
            ...cliCommandArgs,
            input: {
              force: true,
              mode: 'default',
              accounts,
              stateOnly: false,
              fromState: false,
              regenerateSaltoIds: false,
              fromEnv: env,
              fromWorkspace: sourcePath,
            },
            workspace,
          })
          expect(mockLoadLocalWorkspace).toHaveBeenCalledWith({ path: sourcePath, persistent: false })
          expect(mockFetchFromWorkspace).toHaveBeenCalled()
          const usedArgs = mockFetchFromWorkspace.mock.calls[0][0]
          expect(usedArgs.workspace).toEqual(workspace)
          expect(usedArgs.otherWorkspace).toEqual(sourceWS)
          expect(usedArgs.accounts).toEqual(accounts)
          expect(usedArgs.fromState).toBeFalsy()
          expect(usedArgs.env).toEqual(env)
        })
      })

      describe('when called with fromState true', () => {
        it('should invoke the fetch from workspace method with fromState false', async () => {
          const workspace = mocks.mockWorkspace({ uid: 'target' })
          const sourceWS = mocks.mockWorkspace({ uid: 'source' })
          const sourcePath = 'path/to/source'
          const env = 'sourceEnv'
          mockLoadLocalWorkspace.mockResolvedValueOnce(sourceWS)
          await action({
            ...cliCommandArgs,
            input: {
              force: true,
              mode: 'default',
              accounts,
              stateOnly: false,
              fromState: true,
              regenerateSaltoIds: false,
              fromEnv: env,
              fromWorkspace: sourcePath,
            },
            workspace,
          })
          expect(mockLoadLocalWorkspace).toHaveBeenCalledWith({ path: sourcePath, persistent: false })
          expect(mockFetchFromWorkspace).toHaveBeenCalled()
          const usedArgs = mockFetchFromWorkspace.mock.calls[0][0]
          expect(usedArgs.workspace).toEqual(workspace)
          expect(usedArgs.otherWorkspace).toEqual(sourceWS)
          expect(usedArgs.accounts).toEqual(accounts)
          expect(usedArgs.fromState).toBeTruthy()
          expect(usedArgs.env).toEqual(env)
        })
      })
    })

    describe('failures', () => {
      it('should throw an informative error if the workspace failed to load', async () => {
        const errMsg = 'All your base are belong to us'
        mockLoadLocalWorkspace.mockRejectedValueOnce(errMsg)
        const workspace = mocks.mockWorkspace({ uid: 'target' })
        await expect(() =>
          action({
            ...cliCommandArgs,
            input: {
              force: true,
              mode: 'default',
              accounts,
              stateOnly: false,
              fromState: false,
              regenerateSaltoIds: false,
              fromEnv: 'what*env*er',
              fromWorkspace: 'where*env*er',
            },
            workspace,
          }),
        ).rejects.toThrow(`Failed to load source workspace: ${errMsg}`)
      })

      it('should return user input error if the from env argument is provided without the from workspace argument', async () => {
        const workspace = mocks.mockWorkspace({ uid: 'target' })
        const retValue = await action({
          ...cliCommandArgs,
          input: {
            force: true,
            mode: 'default',
            accounts,
            stateOnly: false,
            fromState: false,
            regenerateSaltoIds: false,
            fromEnv: 'what*env*er',
          },
          workspace,
        })
        expect(retValue).toEqual(CliExitCode.UserInputError)
      })

      it('should return user input error if the from fromWorkspace argument is provided without the from fromEnv argument', async () => {
        const workspace = mocks.mockWorkspace({ uid: 'target' })
        const retValue = await action({
          ...cliCommandArgs,
          input: {
            force: true,
            mode: 'default',
            accounts,
            stateOnly: false,
            fromState: false,
            regenerateSaltoIds: false,
            fromWorkspace: 'path/to/nowhere',
          },
          workspace,
        })
        expect(retValue).toEqual(CliExitCode.UserInputError)
      })
    })
  })
})
