/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { loadLocalWorkspace, locateWorkspaceRoot } from '@salto-io/local-workspace'
import { MockWorkspace, mockWorkspace } from '@salto-io/e2e-test-utils'

import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import { createAction, currentAction, deleteAction, listAction, renameAction, setAction } from '../../src/commands/env'
import { CliExitCode } from '../../src/types'

jest.mock('@salto-io/local-workspace', () => ({
  ...jest.requireActual<{}>('@salto-io/local-workspace'),
  loadLocalWorkspace: jest.fn(),
  localWorkspaceConfigSource: jest.fn().mockResolvedValue({ localStorage: '.' }),
  locateWorkspaceRoot: jest.fn(),
}))

const mockLocateWorkspaceRoot = locateWorkspaceRoot as jest.MockedFunction<typeof locateWorkspaceRoot>
const mockLoadLocalWorkspace = loadLocalWorkspace as jest.MockedFunction<typeof loadLocalWorkspace>

describe('env command group', () => {
  let cliArgs: mocks.MockCliArgs
  let output: mocks.MockCliOutput

  beforeEach(async () => {
    jest.clearAllMocks()
    cliArgs = mocks.mockCliArgs()
    output = cliArgs.output
    mockLocateWorkspaceRoot.mockResolvedValue('.')
  })

  describe('create command', () => {
    const commandName = 'create'
    it('should create a new environment', async () => {
      mockLoadLocalWorkspace.mockResolvedValue(mockWorkspace({}))
      await createAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: {
          envName: 'new-env',
        },
        workspacePath: '.',
      })
      expect(output.stdout.content.search('new-env')).toBeGreaterThan(0)
    })

    describe('create multiple environments', () => {
      let workspace: MockWorkspace
      beforeEach(() => {
        workspace = mockWorkspace({ envs: ['me1'] })
        mockLoadLocalWorkspace.mockResolvedValue(workspace)
        jest.spyOn(callbacks, 'cliApproveIsolateBeforeMultiEnv').mockImplementation(() => Promise.resolve(false))
      })

      it('should prompt on 2nd environment creation, and do nothing if false', async () => {
        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me2',
          },
          workspacePath: '.',
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledTimes(1)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledWith('me1')
        expect(workspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should prompt on 2nd environment creation, and isolate if true', async () => {
        jest.spyOn(callbacks, 'cliApproveIsolateBeforeMultiEnv').mockImplementationOnce(() => Promise.resolve(true))

        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me2',
          },
          workspacePath: '.',
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledTimes(1)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledWith('me1')
        expect(workspace.demoteAll).toHaveBeenCalled()
      })

      it('should not prompt if force=true and acceptSuggestions=false, and do nothing', async () => {
        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me2',
            force: true,
            yesAll: false,
          },
          workspacePath: '.',
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(workspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should isolate without prompting if acceptSuggestions=true', async () => {
        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me2',
            yesAll: true,
          },
          workspacePath: '.',
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(workspace.demoteAll).toHaveBeenCalled()
      })
      it('should isolate without prompting if acceptSuggestions=true and force=true', async () => {
        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me2',
            force: true,
            yesAll: true,
          },
          workspacePath: '.',
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(workspace.demoteAll).toHaveBeenCalled()
      })

      it('should not prompt on 2nd environment creation if workspace is empty', async () => {
        workspace.isEmpty.mockResolvedValue(true)

        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me2',
          },
          workspacePath: '.',
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(workspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should not prompt on 2nd environment creation if env1 folder exists', async () => {
        workspace.hasElementsInEnv.mockResolvedValue(true)

        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me2',
          },
          workspacePath: '.',
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(workspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should not prompt on 3rd environment creation', async () => {
        const newWorkspace = mockWorkspace({ envs: ['me1', 'me2'] })
        mockLoadLocalWorkspace.mockResolvedValue(newWorkspace)

        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me3',
          },
          workspacePath: '.',
        })
        expect(output.stdout.content.search('me3')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(newWorkspace.demoteAll).not.toHaveBeenCalled()
      })
    })
  })

  describe('set command', () => {
    const commandName = 'set'
    it('should set an environment', async () => {
      await setAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: {
          envName: 'active',
        },
        workspace: mockWorkspace({}),
      })
      expect(output.stdout.content.search('active')).toBeGreaterThan(0)
    })
  })

  describe('current command', () => {
    const commandName = 'current'
    it('should display the current environment', async () => {
      await currentAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: {},
        workspace: mockWorkspace({}),
      })
      expect(output.stdout.content.search('active')).toBeGreaterThan(0)
    })
  })

  describe('list command', () => {
    const commandName = 'list'
    it('should list all environments', async () => {
      await listAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: {},
        workspace: mockWorkspace({}),
      })
      expect(output.stdout.content.search('active')).toBeGreaterThan(0)
      expect(output.stdout.content.search('inactive')).toBeGreaterThan(0)
    })
  })

  describe('delete command', () => {
    const commandName = 'delete'
    it('should display the deleted environment', async () => {
      await deleteAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: {
          envName: 'inactive',
        },
        workspace: mockWorkspace({}),
      })
      expect(output.stdout.content.search('inactive')).toBeGreaterThan(0)
    })
    it('should display the deleted environment even if called with keepNacls', async () => {
      await deleteAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: {
          envName: 'inactive',
          keepNacls: true,
        },
        workspace: mockWorkspace({}),
      })
      expect(output.stdout.content.search('inactive')).toBeGreaterThan(0)
    })
  })

  describe('rename command', () => {
    const commandName = 'rename'
    it('should display renamed environment', async () => {
      const result = await renameAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: {
          oldName: 'inactive',
          newName: 'new-inactive',
        },
        workspace: mockWorkspace({}),
      })
      expect(result).toBe(CliExitCode.Success)
      expect(output.stdout.content.search('inactive')).toBeGreaterThan(0)
      expect(output.stdout.content.search('new-inactive')).toBeGreaterThan(0)
    })
  })
})
