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
import { Plan, PlanItem } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { Spinner, SpinnerCreator, CliExitCode } from '../../src/types'
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import deployDef from '../../src/commands/deploy'
import * as workspace from '../../src/workspace/workspace'
import { buildEventName } from '../../src/telemetry'

const { action } = deployDef

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
jest.mock('../../src/workspace/workspace')

const commandName = 'deploy'
const eventsNames = {
  failure: buildEventName(commandName, 'failure'),
}

describe('deploy command', () => {
  let telemetry: mocks.MockTelemetry
  const config = { shouldCalcTotalSize: true }
  const spinners: Spinner[] = []
  let spinnerCreator: SpinnerCreator
  let output: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  const services = ['salesforce']
  const env = 'inactive'

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(mocks.mockLoadWorkspaceEnvironment)

  beforeEach(() => {
    output = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    spinnerCreator = mocks.mockSpinnerCreator(spinners)
  })

  describe('should deploy considering user input', () => {
    let content: string
    const mockGetUserBooleanInput = callbacks.getUserBooleanInput as jest.Mock
    beforeEach(() => {
      telemetry = mocks.getMockTelemetry()
    })

    it('should continue with deploy when user input is y', async () => {
      mockGetUserBooleanInput.mockResolvedValueOnce(true)
      await action({
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          services,
        },
        output,
        telemetry,
        spinnerCreator,
        config,
      })
      content = output.stdout.content
      expect(content).toContain('Starting the deployment plan')
      expect(content).toContain('Deployment succeeded')
    })

    it('should not deploy when user input is n', async () => {
      mockGetUserBooleanInput.mockResolvedValueOnce(false)
      await action({
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          services,
        },
        output,
        telemetry,
        spinnerCreator,
        config,
      })
      content = output.stdout.content
      expect(content).toContain('Cancelling deploy')
      expect(content).not.toContain('Deployment succeeded')
    })
  })

  describe('should not deploy on dry-run', () => {
    let content: string
    it('should not deploy when dry-run flag is set', async () => {
      telemetry = mocks.getMockTelemetry()
      const result = await action({
        input: {
          force: false,
          dryRun: true,
          detailedPlan: false,
          services,
        },
        output,
        telemetry,
        spinnerCreator,
        config,
      })
      expect(result).toBe(CliExitCode.Success)
      content = output.stdout.content
      // exit without attempting to deploy
      expect(content).not.toContain('Cancelling deploy')
      expect(content).not.toContain('Deployment succeeded')
    })
  })

  describe('detailed plan', () => {
    let content: string

    it('should include value changes when detailed-plan is set', async () => {
      telemetry = mocks.getMockTelemetry()
      await action({
        input: {
          force: false,
          dryRun: false,
          detailedPlan: true,
          services,
        },
        output,
        telemetry,
        spinnerCreator,
        config,
      })
      content = output.stdout.content
      expect(content).toMatch(/M.*name: "FirstEmployee" => "PostChange"/)
    })
  })

  describe('invalid deploy', () => {
    it('should fail gracefully', async () => {
      telemetry = mocks.getMockTelemetry()
      // Running with base dir 'errorDir' will cause the mock to throw an error
      const result = await action({
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          services,
        },
        output,
        telemetry,
        spinnerCreator,
        config,
        workingDir: 'errorDir',
      })
      expect(result).toBe(CliExitCode.AppError)
      expect(telemetry.getEvents()).toHaveLength(1)
      expect(telemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
    })
  })
  describe('when deploy result makes the workspace invalid', () => {
    beforeEach(() => {
      telemetry = mocks.getMockTelemetry()
      const mockWs = mocks.mockLoadWorkspaceEnvironment('', output, {})
      mockLoadWorkspace.mockResolvedValueOnce(mockWs)
      const mockUpdateNacls = mockWs.workspace.updateNaclFiles as jest.Mock
      const mockWorkspaceErrors = mockWs.workspace.errors as jest.Mock
      mockUpdateNacls.mockImplementationOnce(async () => {
        mockWorkspaceErrors.mockResolvedValueOnce(mocks.mockErrors([
          { severity: 'Error', message: '' },
        ]))
      })
      const mockGetUserBooleanInput = callbacks.getUserBooleanInput as jest.Mock
      mockGetUserBooleanInput.mockClear()
      mockGetUserBooleanInput.mockReturnValue(true)
    })
    describe('when called without force', () => {
      it('should fail after asking whether to write', async () => {
        const result = await action({
          input: {
            force: false,
            dryRun: false,
            detailedPlan: false,
            services,
          },
          output,
          telemetry,
          spinnerCreator,
          config,
        })
        expect(result).toBe(CliExitCode.AppError)
        expect(callbacks.getUserBooleanInput).toHaveBeenCalled()
      })
    })
    describe('when called with force', () => {
      it('should fail without user interaction', async () => {
        const result = await action({
          input: {
            force: true,
            dryRun: false,
            detailedPlan: false,
            services,
          },
          output,
          telemetry,
          spinnerCreator,
          config,
        })
        expect(result).toBe(CliExitCode.AppError)
        expect(callbacks.getUserBooleanInput).not.toHaveBeenCalled()
      })
    })
  })
  describe('Using environment variable', () => {
    it('should use provided env', async () => {
      telemetry = mocks.getMockTelemetry()
      mockLoadWorkspace.mockClear()
      await action({
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          services,
          env,
        },
        output,
        telemetry,
        spinnerCreator,
        config,
      })
      expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv()).toEqual(env)
      expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
    })
  })
})
