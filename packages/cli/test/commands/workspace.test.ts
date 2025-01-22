/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import * as core from '@salto-io/core'
import { adapterCreators } from '@salto-io/adapter-creators'
import { MockWorkspace, mockWorkspace } from '@salto-io/e2e-test-utils'
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import { cacheUpdateAction, cleanAction, setStateProviderAction, wsValidateAction } from '../../src/commands/workspace'
import { CliExitCode, Spinner } from '../../src/types'
import * as workspaceFunctions from '../../src/workspace/workspace'

jest.mock('../../src/workspace/workspace', () => ({
  ...jest.requireActual('../../src/workspace/workspace'),
  validateWorkspace: jest.fn(),
  printWorkspaceErrors: jest.fn(),
}))

const mockedWorkspaceFunctions = jest.mocked(workspaceFunctions)

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
        expect(
          await cleanAction({
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
            workspace: mockWorkspace({}),
          }),
        ).toBe(CliExitCode.UserInputError)
        expect(output.stdout.content).toContain('Nothing to do.')
      })
    })

    describe('with all args and no force flag', () => {
      it('should prompt user and exit if no', async () => {
        jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(() => Promise.resolve(false))
        expect(
          await cleanAction({
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
            workspace: mockWorkspace({}),
          }),
        ).toBe(CliExitCode.Success)
        expect(callbacks.getUserBooleanInput).toHaveBeenCalledWith('Do you want to perform these actions?')
        expect(output.stdout.content.search('Canceling...')).toBeGreaterThan(0)
      })
      it('should prompt user and exit if no (regenerate-cache)', async () => {
        jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(() => Promise.resolve(false))
        expect(
          await cleanAction({
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
            workspace: mockWorkspace({}),
          }),
        ).toBe(CliExitCode.Success)
        expect(callbacks.getUserBooleanInput).toHaveBeenCalledWith('Do you want to perform these actions?')
        expect(output.stdout.content.search('Canceling...')).toBeGreaterThan(0)
      })
      it('should fail if trying to clean static resources without all dependent components', async () => {
        expect(
          await cleanAction({
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
            workspace: mockWorkspace({}),
          }),
        ).toBe(CliExitCode.UserInputError)
        expect(callbacks.getUserBooleanInput).not.toHaveBeenCalled()
        expect(
          output.stderr.content.search('Cannot clear static resources without clearing the state, cache and nacls'),
        ).toBeGreaterThanOrEqual(0)
      })

      it('should prompt user and continue if yes', async () => {
        const workspace = mockWorkspace({})
        expect(
          await cleanAction({
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
          }),
        ).toBe(CliExitCode.Success)
        expect(callbacks.getUserBooleanInput).toHaveBeenCalledWith('Do you want to perform these actions?')
        expect(core.cleanWorkspace).toHaveBeenCalledWith(
          workspace,
          {
            nacl: true,
            state: true,
            cache: true,
            staticResources: true,
            credentials: true,
            accountConfig: true,
          },
          adapterCreators,
        )

        expect(output.stdout.content.search('Starting to clean')).toBeGreaterThan(0)
        expect(output.stdout.content.search('Finished cleaning')).toBeGreaterThan(0)
      })
      it('should exit cleanly on error', async () => {
        jest.spyOn(core, 'cleanWorkspace').mockImplementationOnce(() => {
          throw new Error('something bad happened')
        })
        expect(
          await cleanAction({
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
            workspace: mockWorkspace({}),
          }),
        ).toBe(CliExitCode.AppError)

        expect(output.stdout.content.search('Starting to clean')).toBeGreaterThan(0)
        expect(output.stderr.content.search('Error encountered while cleaning')).toBeGreaterThan(0)
      })
    })

    describe('with force flag', () => {
      it('should clean without prompting user', async () => {
        jest.spyOn(callbacks, 'getUserBooleanInput').mockImplementationOnce(() => Promise.resolve(false))
        const workspace = mockWorkspace({})
        expect(
          await cleanAction({
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
          }),
        ).toBe(CliExitCode.Success)
        expect(callbacks.getUserBooleanInput).not.toHaveBeenCalled()
        expect(core.cleanWorkspace).toHaveBeenCalledWith(
          workspace,
          {
            nacl: true,
            state: true,
            cache: true,
            staticResources: true,
            credentials: true,
            accountConfig: true,
          },
          adapterCreators,
        )
        expect(output.stdout.content.search('Starting to clean')).toBeGreaterThan(0)
        expect(output.stdout.content.search('Finished cleaning')).toBeGreaterThan(0)
      })
    })
  })

  describe('cache command group', () => {
    describe('cache update command', () => {
      const commandName = 'update'
      let cliCommandArgs: mocks.MockCommandArgs
      let workspace: MockWorkspace
      let result: CliExitCode

      beforeEach(async () => {
        cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
        workspace = mockWorkspace({})
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

  describe('set state provider', () => {
    const commandName = 'set-state-provider'
    let cliCommandArgs: mocks.MockCommandArgs
    let workspace: MockWorkspace
    beforeEach(async () => {
      cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
      workspace = mockWorkspace({})
    })

    describe('when provider is undefined', () => {
      let result: CliExitCode
      beforeEach(async () => {
        result = await setStateProviderAction({
          ...cliCommandArgs,
          input: {},
          workspace,
        })
      })
      it('should return success', () => {
        expect(result).toEqual(CliExitCode.Success)
      })
      it('should set the state config to be undefined', () => {
        expect(workspace.updateStateProvider).toHaveBeenCalledWith(undefined)
      })
    })

    describe('when provider is file', () => {
      it('should set the state config to have a file provider', async () => {
        const result = await setStateProviderAction({
          ...cliCommandArgs,
          input: { provider: 'file' },
          workspace,
        })
        expect(result).toEqual(CliExitCode.Success)
        expect(workspace.updateStateProvider).toHaveBeenCalledWith({ provider: 'file' })
      })
      it('should fail if it gets an unexpected parameter', async () => {
        const result = await setStateProviderAction({
          ...cliCommandArgs,
          input: { provider: 'file', bucket: 'my-bucket' },
          workspace,
        })
        expect(result).toEqual(CliExitCode.UserInputError)
        expect(workspace.updateStateProvider).not.toHaveBeenCalled()
      })
    })
    describe('when provider is s3', () => {
      it('should set the state config to have a s3 provider', async () => {
        const result = await setStateProviderAction({
          ...cliCommandArgs,
          input: { provider: 's3', bucket: 'my-bucket', prefix: 'prefix' },
          workspace,
        })
        expect(result).toEqual(CliExitCode.Success)
        expect(workspace.updateStateProvider).toHaveBeenCalledWith({
          provider: 's3',
          options: { s3: { bucket: 'my-bucket', prefix: 'prefix' } },
        })
      })
      it('should fail if the bucket argument is missing', async () => {
        const result = await setStateProviderAction({
          ...cliCommandArgs,
          input: { provider: 's3' },
          workspace,
        })
        expect(result).toEqual(CliExitCode.UserInputError)
        expect(workspace.updateStateProvider).not.toHaveBeenCalled()
      })
    })
  })

  describe('validate command', () => {
    const commandName = 'validate'
    let cliCommandArgs: mocks.MockCommandArgs
    let workspace: MockWorkspace
    let spinner: Spinner
    let spinnerOutput: string[]

    beforeEach(() => {
      spinnerOutput = []
      cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
      workspace = mockWorkspace({})
      spinner = {
        succeed: (text: string) => spinnerOutput.push(text),
        fail: (text: string) => spinnerOutput.push(text),
      }
    })

    describe('when workspace is valid', () => {
      beforeEach(async () => {
        mockedWorkspaceFunctions.validateWorkspace.mockResolvedValueOnce(
          Promise.resolve({
            status: 'Valid',
            errors: [],
          }),
        )
        await wsValidateAction({
          ...cliCommandArgs,
          input: {},
          workspace,
          spinnerCreator: () => spinner,
        })
      })
      it('should indicate the workspace is valid', () => {
        expect(workspaceFunctions.printWorkspaceErrors).not.toHaveBeenCalled()
        expect(spinnerOutput.length).toEqual(1)
        expect(spinnerOutput[0]).toContain('valid')
      })
    })
    describe('when workspace is not valid', () => {
      describe('when workspace has a warning', () => {
        beforeEach(async () => {
          mockedWorkspaceFunctions.validateWorkspace.mockResolvedValueOnce(
            Promise.resolve({
              status: 'Warning',
              errors: [],
            }),
          )
          await wsValidateAction({
            ...cliCommandArgs,
            input: {},
            workspace,
            spinnerCreator: () => spinner,
          })
        })
        it('should indicate the workspace is not valid and specify the warnings', () => {
          expect(workspaceFunctions.printWorkspaceErrors).toHaveBeenCalled()
          expect(spinnerOutput.length).toEqual(1)
          expect(spinnerOutput[0]).toContain('warning')
        })
      })
      describe('when workspace has an error', () => {
        beforeEach(async () => {
          mockedWorkspaceFunctions.validateWorkspace.mockResolvedValueOnce({
            status: 'Error',
            errors: [],
          })
          await wsValidateAction({
            ...cliCommandArgs,
            input: {},
            workspace,
            spinnerCreator: () => spinner,
          })
        })
        it('should indicate the workspace is not valid and specify the errors', () => {
          expect(workspaceFunctions.printWorkspaceErrors).toHaveBeenCalled()
          expect(spinnerOutput.length).toEqual(1)
          expect(spinnerOutput[0]).toContain('error')
        })
      })
    })
  })
})
