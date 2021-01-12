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
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import { createAction, setAction, currentAction, listAction, deleteAction, renameAction } from '../../src/commands/env'
import { CliExitCode } from '../../src/types'

describe('env command group', () => {
  let cliArgs: mocks.MockCliArgs
  let output: mocks.MockCliOutput

  beforeEach(async () => {
    cliArgs = mocks.mockCliArgs()
    output = cliArgs.output
  })

  describe('create command', () => {
    const commandName = 'create'
    it('should create a new environment', async () => {
      await createAction({
        ...mocks.mockCliCommandArgs(commandName, cliArgs),
        input: {
          envName: 'new-env',
        },
        workspace: mocks.mockWorkspace({}),
      })
      expect(output.stdout.content.search('new-env')).toBeGreaterThan(0)
    })

    describe('create multiple environments', () => {
      let workspace: mocks.MockWorkspace
      beforeEach(() => {
        workspace = mocks.mockWorkspace({ envs: ['me1'] })
        jest.spyOn(callbacks, 'cliApproveIsolateBeforeMultiEnv').mockImplementation(
          () => Promise.resolve(false)
        )
      })

      afterEach(() => {
        jest.clearAllMocks()
      })

      it('should prompt on 2nd environment creation, and do nothing if false', async () => {
        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me2',
          },
          workspace,
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledTimes(1)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).toHaveBeenCalledWith('me1')
        expect(workspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should prompt on 2nd environment creation, and isolate if true', async () => {
        jest.spyOn(callbacks, 'cliApproveIsolateBeforeMultiEnv').mockImplementationOnce(
          () => Promise.resolve(true)
        )

        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me2',
          },
          workspace,
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
          workspace,
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
          workspace,
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
          workspace,
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
          workspace,
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
          workspace,
        })
        expect(output.stdout.content.search('me2')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(workspace.demoteAll).not.toHaveBeenCalled()
      })

      it('should not prompt on 3rd environment creation', async () => {
        workspace = mocks.mockWorkspace({ envs: ['me1', 'me2'] })

        await createAction({
          ...mocks.mockCliCommandArgs(commandName, cliArgs),
          input: {
            envName: 'me3',
          },
          workspace,
        })
        expect(output.stdout.content.search('me3')).toBeGreaterThan(0)
        expect(callbacks.cliApproveIsolateBeforeMultiEnv).not.toHaveBeenCalled()
        expect(workspace.demoteAll).not.toHaveBeenCalled()
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
        workspace: mocks.mockWorkspace({}),
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
        workspace: mocks.mockWorkspace({}),
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
        workspace: mocks.mockWorkspace({}),
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
        workspace: mocks.mockWorkspace({}),
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
        workspace: mocks.mockWorkspace({}),
      })
      expect(result).toBe(CliExitCode.Success)
      expect(output.stdout.content.search('inactive')).toBeGreaterThan(0)
      expect(output.stdout.content.search('new-inactive')).toBeGreaterThan(0)
    })
  })
})
