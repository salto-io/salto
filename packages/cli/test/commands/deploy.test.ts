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
import { Plan, PlanItem } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { CliExitCode } from '../../src/types'
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import { action } from '../../src/commands/deploy'

const mockDeploy = mocks.deploy
const mockPreview = mocks.preview
jest.mock('../../src/callbacks')
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  deploy: jest.fn().mockImplementation((
    ws: Workspace,
    actionPlan: Plan,
    reportProgress: (action: PlanItem, step: string, details?: string) => void,
    services = new Array<string>(),
  ) =>
  // Deploy with Nacl files will fail, doing this trick as we cannot reference vars, we get error:
  // "The module factory of `jest.mock()` is not allowed to reference any
  // out-of-scope variables."
  // Notice that Nacl files are ignored in mockDeploy.

    mockDeploy(ws, actionPlan, reportProgress, services)),
  preview: jest.fn().mockImplementation((
    _workspace: Workspace,
    _services: string[],
  ) => mockPreview()),
}))

const commandName = 'deploy'

describe('deploy command', () => {
  let output: mocks.MockCliOutput
  let cliCommandArgs: mocks.MockCommandArgs
  const services = ['salesforce']

  beforeEach(() => {
    const cliArgs = mocks.mockCliArgs()
    cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
    output = cliArgs.output
  })

  describe('should deploy considering user input', () => {
    const mockGetUserBooleanInput = callbacks.getUserBooleanInput as jest.Mock

    it('should continue with deploy when user input is y', async () => {
      mockGetUserBooleanInput.mockResolvedValueOnce(true)
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          services,
        },
        workspace: mocks.mockWorkspace({}),
      })
      expect(output.stdout.content).toContain('Starting the deployment plan')
      expect(output.stdout.content).toContain('Deployment succeeded')
    })

    it('should not deploy when user input is n', async () => {
      mockGetUserBooleanInput.mockResolvedValueOnce(false)
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          services,
        },
        workspace: mocks.mockWorkspace({}),
      })
      expect(output.stdout.content).toContain('Cancelling deploy')
      expect(output.stdout.content).not.toContain('Deployment succeeded')
    })
  })

  describe('should not deploy on dry-run', () => {
    it('should not deploy when dry-run flag is set', async () => {
      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: true,
          detailedPlan: false,
          services,
        },
        workspace: mocks.mockWorkspace({}),
      })
      expect(result).toBe(CliExitCode.Success)
      // exit without attempting to deploy
      expect(output.stdout.content).not.toContain('Cancelling deploy')
      expect(output.stdout.content).not.toContain('Deployment succeeded')
    })
  })

  describe('detailed plan', () => {
    it('should include value changes when detailed-plan is set', async () => {
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: true,
          services,
        },
        workspace: mocks.mockWorkspace({}),
      })
      expect(output.stdout.content).toMatch(/M.*name: "FirstEmployee" => "PostChange"/)
    })
  })

  describe('invalid deploy', () => {
    it('should fail gracefully', async () => {
      const workspace = mocks.mockWorkspace({})
      workspace.errors.mockResolvedValue(
        mocks.mockErrors([{ severity: 'Error', message: 'some error' }])
      )
      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          services,
        },
        workspace,
      })
      expect(result).toBe(CliExitCode.AppError)
    })
  })
  describe('when deploy result makes the workspace invalid', () => {
    let workspace: mocks.MockWorkspace
    beforeEach(() => {
      workspace = mocks.mockWorkspace({})
      workspace.updateNaclFiles.mockImplementationOnce(async () => {
        // Make the workspace errored after the call to updateNaclFiles
        workspace.errors.mockResolvedValueOnce(
          mocks.mockErrors([{ severity: 'Error', message: '' }])
        )
      })
      const mockGetUserBooleanInput = callbacks.getUserBooleanInput as jest.Mock
      mockGetUserBooleanInput.mockClear()
      mockGetUserBooleanInput.mockReturnValue(true)
    })
    describe('when called without force', () => {
      it('should fail after asking whether to write', async () => {
        const result = await action({
          ...cliCommandArgs,
          input: {
            force: false,
            dryRun: false,
            detailedPlan: false,
            services,
          },
          workspace,
        })
        expect(result).toBe(CliExitCode.AppError)
        expect(callbacks.getUserBooleanInput).toHaveBeenCalled()
      })
    })
    describe('when called with force', () => {
      it('should fail without user interaction', async () => {
        const result = await action({
          ...cliCommandArgs,
          input: {
            force: true,
            dryRun: false,
            detailedPlan: false,
            services,
          },
          workspace,
        })
        expect(result).toBe(CliExitCode.AppError)
        expect(callbacks.getUserBooleanInput).not.toHaveBeenCalled()
      })
    })
  })
  describe('Using environment variable', () => {
    it('should use provided env', async () => {
      const env = 'foo'
      const workspace = mocks.mockWorkspace({ envs: ['bla', env] })
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          services,
          env,
        },
        workspace,
      })
      expect(workspace.setCurrentEnv).toHaveBeenCalledWith(env, false)
    })
  })
})
