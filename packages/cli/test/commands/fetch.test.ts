/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { EventEmitter } from 'pietile-eventemitter'
import { InstanceElement } from '@salto-io/adapter-api'
import { adapterCreators } from '@salto-io/adapter-creators'
import { MockWorkspace, mockWorkspace, elements, mockErrors } from '@salto-io/e2e-test-utils'
import { fetch, fetchFromWorkspace, FetchFunc, FetchProgressEvents, StepEmitter } from '@salto-io/core'
import { loadLocalWorkspace } from '@salto-io/local-workspace'
import { createElementSelector, Workspace } from '@salto-io/workspace'
import { mockFunction } from '@salto-io/test-utils'
import { CliError, CliExitCode, CliTelemetry } from '../../src/types'
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
}))

jest.mock('@salto-io/local-workspace', () => ({
  ...jest.requireActual<{}>('@salto-io/local-workspace'),
  loadLocalWorkspace: jest.fn().mockImplementation(() => mockWorkspace({})),
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
        const workspace = mockWorkspace({})
        workspace.errors.mockResolvedValue(
          mockErrors([{ severity: 'Error', message: 'some error', detailedMessage: 'some detailed error' }]),
        )
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
      let workspace: MockWorkspace
      beforeEach(async () => {
        workspace = mockWorkspace({})
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
        expect(telemetry.sendCountEvent).toHaveBeenCalled()
      })
    })

    describe('when using implicit all accounts', () => {
      let workspace: MockWorkspace

      beforeEach(async () => {
        workspace = mockWorkspace({})
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
        expect((fetch as jest.Mock).mock.calls[0][0].accounts).toEqual(['salesforce', 'netsuite'])
      })
    })
    describe('when passing regenerate salto ids for selectors', () => {
      const workspace = mockWorkspace({})

      it('should exit with user error when regenerate salto ids flag is not passed', async () => {
        result = await action({
          ...cliCommandArgs,
          input: {
            force: false,
            mode: 'default',
            stateOnly: false,
            fromState: false,
            regenerateSaltoIds: false,
            regenerateSaltoIdsForSelectors: ['salto.type.instance.*'],
          },
          workspace,
        })
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should exit with user error when selectors are invalid', async () => {
        result = await action({
          ...cliCommandArgs,
          input: {
            force: false,
            mode: 'default',
            stateOnly: false,
            fromState: false,
            regenerateSaltoIds: true,
            regenerateSaltoIdsForSelectors: ['salto.type.*'],
          },
          workspace,
        })
        expect(result).toBe(CliExitCode.UserInputError)
      })
      it('should call core fetch with selectors', async () => {
        result = await action({
          ...cliCommandArgs,
          input: {
            force: true,
            mode: 'default',
            stateOnly: false,
            fromState: false,
            regenerateSaltoIds: true,
            regenerateSaltoIdsForSelectors: ['salto.type.instance.*'],
          },
          workspace,
        })
        expect(result).toBe(CliExitCode.Success)
        expect(fetch).toHaveBeenCalledWith({
          workspace,
          progressEmitter: expect.anything(),
          accounts: workspace.accounts(),
          ignoreStateElemIdMapping: true,
          withChangesDetection: undefined,
          ignoreStateElemIdMappingForSelectors: [createElementSelector('salto.type.instance.*')],
          adapterCreators,
        })
      })
    })

    describe('fetch command', () => {
      const mockFetch = jest.fn().mockResolvedValue({ changes: [], mergeErrors: [], success: true })
      const mockEmptyApprove = jest.fn().mockResolvedValue([])
      const mockUpdateConfig = jest.fn().mockResolvedValue(true)

      describe('with emitters called', () => {
        const mockFetchWithEmitter: jest.Mock = jest.fn(
          (workspace: {
            workspace: Workspace
            progressEmitter: EventEmitter<FetchProgressEvents>
            accounts?: string[]
          }) => {
            const getChangesEmitter = new StepEmitter()
            workspace.progressEmitter.emit('changesWillBeFetched', getChangesEmitter, ['adapterName'])
            workspace.progressEmitter.emit('adapterProgress', 'salesforce', 'fetch', { message: 'fetching message' })
            getChangesEmitter.emit('completed')
            const calculateDiffEmitter = new StepEmitter()
            workspace.progressEmitter.emit('diffWillBeCalculated', calculateDiffEmitter)
            calculateDiffEmitter.emit('failed')
            return Promise.resolve({ changes: [], mergeErrors: [], success: true })
          },
        )
        beforeEach(async () => {
          await fetchCommand({
            workspace: mockWorkspace({}),
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
            regenerateSaltoIdsForSelectors: [],
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
          workspace = mockWorkspace({})
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
            regenerateSaltoIdsForSelectors: [],
          })
        })
        it('should not update workspace', () => {
          expect(workspace.updateNaclFiles).toHaveBeenCalledWith([], 'default')
          expect(telemetry.sendCountEvent).toHaveBeenCalledWith(eventsNames.changes, 0, expect.objectContaining({}))
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
          const workspace = mockWorkspace({})
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
            regenerateSaltoIdsForSelectors: [],
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
            workspace = mockWorkspace({})
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
              regenerateSaltoIdsForSelectors: [],
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
            workspace = mockWorkspace({})
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
              regenerateSaltoIdsForSelectors: [],
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
            workspace = mockWorkspace({})
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
              regenerateSaltoIdsForSelectors: [],
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
            workspace = mockWorkspace({})
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
              regenerateSaltoIdsForSelectors: [],
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
                  workspace: mockWorkspace({}),
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
                  regenerateSaltoIdsForSelectors: [],
                }),
              ).rejects.toThrow())
          })
          describe('when state is updated', () => {
            let workspace: Workspace
            beforeEach(async () => {
              workspace = mockWorkspace({})
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
                regenerateSaltoIdsForSelectors: [],
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
            let workspace: MockWorkspace
            beforeEach(async () => {
              workspace = mockWorkspace({})
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
                regenerateSaltoIdsForSelectors: [],
              })
            })
            it('should return AppError status when state is updated', () => {
              expect(result).toBe(CliExitCode.AppError)
            })
          })
        })
        describe('when initial workspace is empty', () => {
          let workspace: MockWorkspace
          beforeEach(async () => {
            workspace = mockWorkspace({})
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
              regenerateSaltoIdsForSelectors: [],
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
              const workspace = mockWorkspace({})
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
                regenerateSaltoIdsForSelectors: [],
              })
              expect(workspace.updateNaclFiles).toHaveBeenCalledWith([changes[0].change], 'default')
            })

            it('should exit if errors identified in workspace after update', async () => {
              const abortIfErrorCallback = jest.spyOn(callbacks, 'shouldAbortWorkspaceInCaseOfValidationError')
              abortIfErrorCallback.mockResolvedValue(true)

              const workspace = mockWorkspace({})
              workspace.updateNaclFiles.mockImplementation(async () => {
                // Make the workspace errored after updateNaclFiles is called
                workspace.errors.mockResolvedValue(
                  mockErrors([{ severity: 'Error', message: 'BLA Error', detailedMessage: 'detailed BLA Error' }]),
                )
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
                regenerateSaltoIdsForSelectors: [],
              })
              expect(workspace.updateNaclFiles).toHaveBeenCalledWith([changes[0].change], 'default')
              expect(res).toBe(CliExitCode.AppError)

              abortIfErrorCallback.mockRestore()
            })
            it('should not exit if warning identified in workspace after update', async () => {
              const workspace = mockWorkspace({})
              workspace.updateNaclFiles.mockImplementation(async () => {
                // Make the workspace errored after updateNaclFiles is called
                workspace.errors.mockResolvedValue(
                  mockErrors([{ severity: 'Warning', message: 'BLA Error', detailedMessage: 'detailed BLA Error' }]),
                )
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
                regenerateSaltoIdsForSelectors: [],
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
              elements: elements().slice(0, 2),
              error: {
                elemID: elements()[0].elemID,
                error: 'test',
                message: 'test merge error',
                detailedMessage: 'detailed test merge error',
                severity: 'Warning',
              },
            },
          ],
          updatedConfig: {},
          success: true,
          partiallyFetchedAccounts: new Set(['salesforce']),
        })
        beforeEach(async () => {
          const workspace = mockWorkspace({})
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
            regenerateSaltoIdsForSelectors: [],
          })
        })
        it('should succeed', () => {
          expect(result).toBe(CliExitCode.Success)
        })
        it('should print merge errors', () => {
          expect(output.stderr.content).toContain(elements()[0].elemID.getFullName())
          expect(output.stderr.content).toContain('test merge error')
        })
      })
    })
  })

  describe('Verify using env command', () => {
    it('should use current env when env is not provided', async () => {
      const workspace = mockWorkspace({})
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
      const workspace = mockWorkspace({})
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
          workspace: mockWorkspace({}),
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
          const workspace = mockWorkspace({ uid: 'target' })
          const sourceWS = mockWorkspace({ uid: 'source' })
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
          expect(mockLoadLocalWorkspace).toHaveBeenCalledWith({ path: sourcePath, persistent: false, adapterCreators })
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
          const workspace = mockWorkspace({ uid: 'target' })
          const sourceWS = mockWorkspace({ uid: 'source' })
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
          expect(mockLoadLocalWorkspace).toHaveBeenCalledWith({ path: sourcePath, persistent: false, adapterCreators })
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
        const workspace = mockWorkspace({ uid: 'target' })
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
        const workspace = mockWorkspace({ uid: 'target' })
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
        const workspace = mockWorkspace({ uid: 'target' })
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
