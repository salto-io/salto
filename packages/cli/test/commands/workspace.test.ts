/*
*                      Copyright 2023 Salto Labs Ltd.
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
import * as core from '@salto-io/core'
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import { cleanAction, cacheUpdateAction } from '../../src/commands/workspace'
import { CliExitCode } from '../../src/types'


jest.mock('@salto-io/core', () => ({
  ...jest.requireActual<{}>('@salto-io/core'),
  getDefaultAdapterConfig: jest.fn().mockImplementation(service => ({ a: 'a', serviceName: service })),
  cleanWorkspace: jest.fn(),
}))

describe('workspace command group', () => {
  let cliArgs: mocks.MockCliArgs
  let output: mocks.MockCliOutput

  beforeEach(async () => {
    cliArgs = mocks.mockCliArgs()
    output = cliArgs.output
  })

  describe('clean command', () => {
    const commandName = 'clean'
    let cliCommandArgs: mocks.MockCommandArgs

    beforeEach(async () => {
      cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
      jest.spyOn(callbacks, 'getUserBooleanInput').mockResolvedValue(true)
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    describe('with no clean args', () => {
      it('should do nothing and return error', async () => {
        expect(await cleanAction({
          ...cliCommandArgs,
          input: {
            force: false,
            nacl: false,
            state: false,
            cache: false,
            staticResources: false,
            credentials: false,
            accountConfig: false,

          },
          workspace: mocks.mockWorkspace({}),
        })).toBe(CliExitCode.UserInputError)
        expect(output.stdout.content).toContain('Nothing to do.')
      })
    })

    describe('with all args and no force flag', () => {
      it('should prompt user and exit if no', async () => {
        jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(() => Promise.resolve(false))
        expect(await cleanAction({
          ...cliCommandArgs,
          input: {
            force: false,
            nacl: true,
            state: true,
            cache: true,
            staticResources: true,
            credentials: true,
            accountConfig: true,

          },
          workspace: mocks.mockWorkspace({}),
        })).toBe(CliExitCode.Success)
        expect(callbacks.getUserBooleanInput).toHaveBeenCalledWith('Do you want to perform these actions?')
        expect(output.stdout.content.search('Canceling...')).toBeGreaterThan(0)
      })
      it('should prompt user and exit if no (regenerate-cache)', async () => {
        jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(() => Promise.resolve(false))
        expect(await cleanAction({
          ...cliCommandArgs,
          input: {
            force: false,
            nacl: true,
            state: false,
            cache: false,
            staticResources: false,
            credentials: false,
            accountConfig: false,

          },
          workspace: mocks.mockWorkspace({}),
        })).toBe(CliExitCode.Success)
        expect(callbacks.getUserBooleanInput).toHaveBeenCalledWith('Do you want to perform these actions?')
        expect(output.stdout.content.search('Canceling...')).toBeGreaterThan(0)
      })
      it('should fail if trying to clean static resources without all dependent components', async () => {
        expect(await cleanAction({
          ...cliCommandArgs,
          input: {
            force: false,
            nacl: true,
            state: false,
            cache: true,
            staticResources: true,
            credentials: true,
            accountConfig: true,

          },
          workspace: mocks.mockWorkspace({}),
        })).toBe(CliExitCode.UserInputError)
        expect(callbacks.getUserBooleanInput).not.toHaveBeenCalled()
        expect(output.stderr.content.search('Cannot clear static resources without clearing the state, cache and nacls')).toBeGreaterThanOrEqual(0)
      })

      it('should prompt user and continue if yes', async () => {
        const workspace = mocks.mockWorkspace({})
        expect(await cleanAction({
          ...cliCommandArgs,
          input: {
            force: false,
            nacl: true,
            state: true,
            cache: true,
            staticResources: true,
            credentials: true,
            accountConfig: true,
          },
          workspace,
        })).toBe(CliExitCode.Success)
        expect(callbacks.getUserBooleanInput).toHaveBeenCalledWith('Do you want to perform these actions?')
        expect(core.cleanWorkspace).toHaveBeenCalledWith(workspace, {
          nacl: true,
          state: true,
          cache: true,
          staticResources: true,
          credentials: true,
          accountConfig: true,
        })

        expect(output.stdout.content.search('Starting to clean')).toBeGreaterThan(0)
        expect(output.stdout.content.search('Finished cleaning')).toBeGreaterThan(0)
      })
      it('should exit cleanly on error', async () => {
        jest.spyOn(core, 'cleanWorkspace').mockImplementationOnce(
          () => { throw new Error('something bad happened') }
        )
        expect(await cleanAction({
          ...cliCommandArgs,
          input: {
            force: false,
            nacl: true,
            state: true,
            cache: true,
            staticResources: true,
            credentials: true,
            accountConfig: true,

          },
          workspace: mocks.mockWorkspace({}),
        })).toBe(CliExitCode.AppError)

        expect(output.stdout.content.search('Starting to clean')).toBeGreaterThan(0)
        expect(output.stderr.content.search('Error encountered while cleaning')).toBeGreaterThan(0)
      })
    })

    describe('with force flag', () => {
      it('should clean without prompting user', async () => {
        jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(
          () => Promise.resolve(false)
        )
        const workspace = mocks.mockWorkspace({})
        expect(await cleanAction({
          ...cliCommandArgs,
          input: {
            force: true,
            nacl: true,
            state: true,
            cache: true,
            staticResources: true,
            credentials: true,
            accountConfig: true,

          },
          workspace,
        })).toBe(CliExitCode.Success)
        expect(callbacks.getUserBooleanInput).not.toHaveBeenCalled()
        expect(core.cleanWorkspace).toHaveBeenCalledWith(workspace, {
          nacl: true,
          state: true,
          cache: true,
          staticResources: true,
          credentials: true,
          accountConfig: true,
        })
        expect(output.stdout.content.search('Starting to clean')).toBeGreaterThan(0)
        expect(output.stdout.content.search('Finished cleaning')).toBeGreaterThan(0)
      })
    })
  })

  describe('cache command group', () => {
    describe('cache update command', () => {
      const commandName = 'update'
      let cliCommandArgs: mocks.MockCommandArgs
      let workspace: mocks.MockWorkspace
      let result: CliExitCode

      beforeEach(async () => {
        cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
        workspace = mocks.mockWorkspace({})
        result = await cacheUpdateAction({
          ...cliCommandArgs,
          input: {},
          workspace,
        })
      })

      it('should flush the workspace', () => {
        expect(workspace.flush).toHaveBeenCalled()
      })
      it('should return success', () => {
        expect(result).toEqual(CliExitCode.Success)
      })
    })
  })
})
