/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { restore, restorePaths } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { mockWorkspace, mockErrors } from '@salto-io/e2e-test-utils'
import { DetailedChangeWithBaseChange, ElemID, ModificationChange, StaticFile, Values } from '@salto-io/adapter-api'
import { getUserBooleanInput } from '../../src/callbacks'
import { CliExitCode } from '../../src/types'
import { action } from '../../src/commands/restore'
import * as mocks from '../mocks'
import { buildEventName } from '../../src/telemetry'
import Prompts from '../../src/prompts'

const commandName = 'restore'
const eventsNames = {
  success: buildEventName(commandName, 'success'),
  start: buildEventName(commandName, 'start'),
  failure: buildEventName(commandName, 'failure'),
  changes: buildEventName(commandName, 'changes'),
  changesToApply: buildEventName(commandName, 'changesToApply'),
  workspaceSize: buildEventName(commandName, 'workspaceSize'),
}

jest.mock('../../src/callbacks', () => ({
  ...jest.requireActual<{}>('../../src/callbacks'),
  getUserBooleanInput: jest.fn(),
}))
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual<{}>('@salto-io/core'),
  restore: jest.fn().mockImplementation(() => Promise.resolve([])),
  restorePaths: jest.fn().mockImplementation(() => Promise.resolve([])),
}))

describe('restore command', () => {
  const accounts = ['salesforce']
  let cliCommandArgs: mocks.MockCommandArgs
  let telemetry: mocks.MockTelemetry
  let output: mocks.MockCliOutput
  let mockRestore: jest.MockedFunction<typeof restore>
  let mockRestorePaths: jest.MockedFunction<typeof restorePaths>
  let mockGetUserBooleanInput: jest.MockedFunction<typeof getUserBooleanInput>

  beforeEach(() => {
    const cliArgs = mocks.mockCliArgs()
    cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
    telemetry = cliArgs.telemetry
    output = cliArgs.output
    mockRestore = restore as typeof mockRestore
    mockRestore.mockReset()
    mockRestore.mockResolvedValue(mocks.dummyChanges.map(change => ({ change, serviceChanges: [change] })))
    mockRestorePaths = restorePaths as typeof mockRestorePaths
    mockRestorePaths.mockReset()
    mockRestorePaths.mockResolvedValue(mocks.dummyChanges.map(change => ({ change, serviceChanges: [change] })))
    mockGetUserBooleanInput = getUserBooleanInput as typeof mockGetUserBooleanInput
    mockGetUserBooleanInput.mockReset()
    mockGetUserBooleanInput.mockResolvedValue(true)
  })

  describe('with errored workspace', () => {
    let result: number
    beforeEach(async () => {
      const workspace = mockWorkspace({})
      workspace.errors.mockResolvedValue(
        mockErrors([{ severity: 'Error', message: 'some error', detailedMessage: 'some error' }]),
      )
      result = await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
        },
        workspace,
      })
    })

    it('should fail', async () => {
      expect(result).toBe(CliExitCode.AppError)
      expect(restore).not.toHaveBeenCalled()
    })
  })

  describe('with valid workspace', () => {
    let result: number
    let workspace: Workspace
    beforeEach(async () => {
      workspace = mockWorkspace({})
      jest.spyOn(workspace, 'updateNaclFiles').mockResolvedValue({
        naclFilesChangesCount: 2,
        stateOnlyChangesCount: 0,
      })

      result = await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
        },
        workspace,
      })
    })

    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call restore', () => {
      expect(restore).toHaveBeenCalled()
    })

    it('should update changes', () => {
      expect(workspace.updateNaclFiles).toHaveBeenCalledWith(mocks.dummyChanges, 'default')
    })

    it('should send telemetry events', () => {
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(
        eventsNames.changesToApply,
        expect.anything(),
        expect.objectContaining({}),
      )
      expect(telemetry.sendCountEvent).toHaveBeenCalledWith(
        eventsNames.workspaceSize,
        expect.anything(),
        expect.objectContaining({}),
      )
    })

    it('should print deployment to console', () => {
      expect(output.stdout.content).toContain('Finished calculating the difference')
      expect(output.stdout.content).toContain('2 changes were applied to the local workspace')
      expect(output.stdout.content).toContain('Done!')
    })
  })
  describe('Verify using env command', () => {
    it('should use current env when env is not provided', async () => {
      const workspace = mockWorkspace({})
      await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
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
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
          env: mocks.withEnvironmentParam,
        },
        workspace,
      })
      expect(workspace.setCurrentEnv).toHaveBeenCalledWith(mocks.withEnvironmentParam, false)
    })
  })

  describe('dry-run', () => {
    let result: number
    let workspace: Workspace
    beforeEach(async () => {
      workspace = mockWorkspace({})
      result = await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: true,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
        },
        workspace,
      })
    })

    it('should return success code', () => {
      expect(result).toBe(CliExitCode.Success)
    })
    it('should call restore', () => {
      expect(restore).toHaveBeenCalled()
    })

    it('should not update changes', () => {
      expect(workspace.updateNaclFiles).not.toHaveBeenCalled()
    })

    it('should print plan to console, but not deploy', () => {
      expect(output.stdout.content).toContain('The following changes')
      expect(output.stdout.content).toContain('Finished calculating the difference')
      expect(output.stdout.content).not.toContain('Done!')
    })
  })

  describe('when prompting whether to perform the restore', () => {
    let workspace: Workspace
    beforeEach(async () => {
      workspace = mockWorkspace({})
    })

    describe('when user input is y', () => {
      beforeEach(async () => {
        mockGetUserBooleanInput.mockResolvedValueOnce(true)
        await action({
          ...cliCommandArgs,
          input: {
            force: false,
            dryRun: false,
            detailedPlan: false,
            listPlannedChanges: false,
            mode: 'default',
            accounts,
          },
          workspace,
        })
      })

      it('should apply changes', () => {
        expect(output.stdout.content).toContain('Applying changes')
        expect(workspace.updateNaclFiles).toHaveBeenCalled()
      })
    })

    describe('when user input is n', () => {
      let result: number

      beforeEach(async () => {
        mockGetUserBooleanInput.mockResolvedValueOnce(false)
        result = await action({
          ...cliCommandArgs,
          input: {
            force: false,
            dryRun: false,
            detailedPlan: false,
            listPlannedChanges: false,
            mode: 'default',
            accounts,
          },
          workspace,
        })
      })

      it('should return success error code', () => {
        expect(result).toBe(CliExitCode.Success)
      })

      it('should print a message before exiting', () => {
        expect(output.stdout.content).toContain('Canceling...')
      })

      it('should not restore any Nacls', () => {
        expect(workspace.updateNaclFiles).not.toHaveBeenCalled()
      })
    })

    describe('when there are no changes', () => {
      let result: number

      beforeEach(async () => {
        mockRestore.mockResolvedValue([])

        result = await action({
          ...cliCommandArgs,
          input: {
            force: false,
            dryRun: false,
            detailedPlan: false,
            listPlannedChanges: false,
            mode: 'default',
            accounts,
          },
          workspace,
        })
      })

      it('should not prompt the user', () => {
        expect(mockGetUserBooleanInput).not.toHaveBeenCalled()
      })
      it('should return success', () => {
        expect(result).toBe(CliExitCode.Success)
      })
      it('should print that there are not changes', () => {
        expect(output.stdout.content).toContain('No changes found')
      })
    })

    describe('when force flag is true', () => {
      beforeEach(async () => {
        await action({
          ...cliCommandArgs,
          input: {
            force: true,
            dryRun: false,
            detailedPlan: false,
            listPlannedChanges: false,
            mode: 'default',
            accounts,
          },
          workspace,
        })
      })

      it('should not prompt the user', () => {
        expect(mockGetUserBooleanInput).not.toHaveBeenCalled()
      })

      it('should execute the restore', () => {
        expect(workspace.updateNaclFiles).toHaveBeenCalled()
      })
    })
  })

  it('should return error when update workspace fails', async () => {
    const workspace = mockWorkspace({})
    workspace.updateNaclFiles.mockImplementation(async () => {
      workspace.errors.mockResolvedValue(
        mockErrors([{ severity: 'Error', message: 'some error ', detailedMessage: 'some error ' }]),
      )
      return { naclFilesChangesCount: 0, stateOnlyChangesCount: 0 }
    })
    const result = await action({
      ...cliCommandArgs,
      input: {
        force: true,
        dryRun: false,
        detailedPlan: false,
        listPlannedChanges: false,
        mode: 'default',
        accounts,
      },
      workspace,
    })
    expect(result).toBe(CliExitCode.AppError)
  })
  describe('using id filters', () => {
    it('should fail when invalid filters are provided', async () => {
      const result = await action({
        ...cliCommandArgs,
        input: {
          force: true,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
          elementSelectors: ['++'],
        },
        workspace: mockWorkspace({}),
      })
      expect(result).toBe(CliExitCode.UserInputError)
    })
    it('should succeed when valid filters are provided', async () => {
      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
          elementSelectors: ['salto.*'],
        },
        workspace: mockWorkspace({}),
      })
      expect(result).toBe(CliExitCode.Success)
    })
  })
  describe('restoring modified static files', () => {
    it('should not print about removal changes of static files', async () => {
      const workspace = mockWorkspace({})
      mockRestore.mockResolvedValueOnce([
        { change: mocks.staticFileChange('remove'), serviceChanges: [mocks.staticFileChange('add')] },
      ])

      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
        },
        workspace,
      })

      expect(output.stdout.content).not.toContain('Static resources are not supported')
      expect(result).toBe(CliExitCode.Success)
    })

    it('should warn of unrestoring modified static files without content', async () => {
      const workspace = mockWorkspace({})
      mockRestore.mockResolvedValueOnce([
        { change: mocks.staticFileChange('modify'), serviceChanges: [mocks.staticFileChange('modify')] },
      ])

      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
        },
        workspace,
      })

      expect(output.stdout.content).toContain('salesforce/advancedpdftemplate/custtmpl_103_t2257860_156.xml')
      expect(result).toBe(CliExitCode.Success)
    })

    it('should warn of inner unrestoring modified static files without content', async () => {
      const workspace = mockWorkspace({})
      const change: ModificationChange<Values> & DetailedChangeWithBaseChange = {
        data: {
          before: {
            file: new StaticFile({
              filepath: 'filepath',
              hash: 'hash',
            }),
          },
          after: {
            file: new StaticFile({
              filepath: 'filepath',
              hash: 'hash2',
            }),
          },
        },
        action: 'modify',
        id: new ElemID('adapter', 'type', 'instance', 'inst', 'value'),
        baseChange: mocks.baseChange('modify'),
      }
      mockRestore.mockResolvedValueOnce([
        {
          change,
          serviceChanges: [change],
        },
      ])

      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
        },
        workspace,
      })

      expect(output.stdout.content).toContain('filepath')
      expect(result).toBe(CliExitCode.Success)
    })

    it('should not warn about modified static files with content', async () => {
      const workspace = mockWorkspace({})
      mockRestore.mockResolvedValueOnce([
        { change: mocks.staticFileChange('modify', true), serviceChanges: [mocks.staticFileChange('modify', true)] },
      ])

      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
        },
        workspace,
      })

      expect(output.stdout.content).not.toContain('Static resources are not supported')
      expect(result).toBe(CliExitCode.Success)
    })

    it('should warn of unrestoring added static files', async () => {
      const workspace = mockWorkspace({})
      mockRestore.mockResolvedValueOnce([
        { change: mocks.staticFileChange('add'), serviceChanges: [mocks.staticFileChange('remove')] },
      ])

      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
        },
        workspace,
      })

      expect(output.stdout.content).toContain('salesforce/advancedpdftemplate/custtmpl_103_t2257860_156.xml')
      expect(result).toBe(CliExitCode.Success)
    })

    it('should not warn of added static files with content', async () => {
      const workspace = mockWorkspace({})
      mockRestore.mockResolvedValueOnce([
        { change: mocks.staticFileChange('add', true), serviceChanges: [mocks.staticFileChange('remove', true)] },
      ])

      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
        },
        workspace,
      })

      expect(output.stdout.content).not.toContain('Static resources are not supported')
      expect(result).toBe(CliExitCode.Success)
    })
  })

  describe('restore paths', () => {
    it('should call the restorePaths api', async () => {
      const workspace = mockWorkspace({})

      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
          reorganizeDirStructure: true,
        },
        workspace,
      })

      expect(restorePaths).toHaveBeenCalled()
      expect(restore).not.toHaveBeenCalled()

      expect(workspace.updateNaclFiles).toHaveBeenCalledWith(mocks.dummyChanges, 'default')

      expect(result).toBe(CliExitCode.Success)
    })

    it('should fail when requesting to restore paths with specific selectors', async () => {
      const workspace = mockWorkspace({})

      const result = await action({
        ...cliCommandArgs,
        input: {
          elementSelectors: ['salto.*'],
          force: false,
          dryRun: false,
          detailedPlan: false,
          listPlannedChanges: false,
          mode: 'default',
          accounts,
          reorganizeDirStructure: true,
        },
        workspace,
      })

      expect(output.stderr.content).toContain(Prompts.REORGANIZE_DIR_STRUCTURE_WITH_ELEMENT_SELECTORS)
      expect(result).toBe(CliExitCode.UserInputError)
    })
  })
})
