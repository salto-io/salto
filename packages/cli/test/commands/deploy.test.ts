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
import semver from 'semver'
import moment from 'moment'
import { Plan, PlanItem } from '@salto-io/core'
import { Workspace, state, remoteMap, elementSource } from '@salto-io/workspace'
import { CliExitCode } from '../../src/types'
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import { action } from '../../src/commands/deploy'
import { version as currentVersion } from '../../src/generated/version.json'

const { InMemoryRemoteMap } = remoteMap
const { createInMemoryElementSource } = elementSource

const mockDeploy = mocks.deploy
const mockPreview = mocks.preview
jest.mock('../../src/callbacks')
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual<{}>('@salto-io/core'),
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
  let workspace: mocks.MockWorkspace
  let output: mocks.MockCliOutput
  let cliCommandArgs: mocks.MockCommandArgs
  const services = ['salesforce']
  const mockGetUserBooleanInput = callbacks.getUserBooleanInput as jest.Mock
  const mockShouldCancel = callbacks.shouldCancelCommand as jest.Mock

  beforeEach(() => {
    const cliArgs = mocks.mockCliArgs()
    cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
    output = cliArgs.output
    workspace = mocks.mockWorkspace({})
    workspace.getStateRecency.mockImplementation(async serviceName => ({
      serviceName, status: 'Valid', date: new Date(),
    }))
    mockGetUserBooleanInput.mockReset()
    mockShouldCancel.mockReset()
  })

  describe('should deploy considering user input', () => {
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
        workspace,
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
        workspace,
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
        workspace,
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
        workspace,
      })
      expect(output.stdout.content).toMatch(/M.*name: "FirstEmployee" => "PostChange"/)
    })
  })

  describe('invalid deploy', () => {
    it('should fail gracefully', async () => {
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
    it('should allow the user to cancel when there are warnings', async () => {
      workspace.errors.mockResolvedValue(
        mocks.mockErrors([{ severity: 'Warning', message: 'some warning' }])
      )
      mockGetUserBooleanInput.mockResolvedValue(false)
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
      expect(callbacks.shouldContinueInCaseOfWarnings).toHaveBeenCalled()
    })
  })
  describe('when deploy result makes the workspace invalid', () => {
    beforeEach(() => {
      workspace.updateNaclFiles.mockImplementationOnce(async () => {
        // Make the workspace errored after the call to updateNaclFiles
        workspace.errors.mockResolvedValueOnce(
          mocks.mockErrors([{ severity: 'Error', message: '' }])
        )
        return 0
      })
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
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          services,
          env: mocks.withEnvironmentParam,
        },
        workspace,
      })
      expect(workspace.setCurrentEnv).toHaveBeenCalledWith(mocks.withEnvironmentParam, false)
    })
  })
  describe('recommend fetch flow', () => {
    const mockState = (
      data: Partial<state.StateData>,
      saltoVersion?: string
    ): state.State => {
      const metaData = saltoVersion ? [
        { key: 'version', value: saltoVersion },
      ] as {key: state.StateMetadataKey; value: string}[] : []
      const saltoMetadata = new InMemoryRemoteMap<string, state.StateMetadataKey>(metaData)
      return state.buildInMemState(async () => ({
        elements: createInMemoryElementSource(),
        pathIndex: new InMemoryRemoteMap(),
        servicesUpdateDate: data.servicesUpdateDate ?? new InMemoryRemoteMap(),
        saltoMetadata,
      }))
    }
    const inputOptions = {
      force: false,
      dryRun: false,
      detailedPlan: false,
    }
    describe('when state salto version does not exist', () => {
      beforeEach(async () => {
        mockShouldCancel.mockResolvedValue(true)
        workspace.state.mockReturnValue(mockState({}))
        await action({
          ...cliCommandArgs,
          input: inputOptions,
          workspace,
        })
      })
      it('should recommend cancel', () => {
        expect(callbacks.shouldCancelCommand).toHaveBeenCalledTimes(1)
      })
    })
    describe('when state version is newer than the current version', () => {
      beforeEach(async () => {
        mockShouldCancel.mockResolvedValue(true)
        workspace.state.mockReturnValue(mockState({},
          semver.inc(currentVersion, 'patch') as string,))
        await action({
          ...cliCommandArgs,
          input: inputOptions,
          workspace,
        })
      })
      it('should recommend cancel', () => {
        expect(callbacks.shouldCancelCommand).toHaveBeenCalledTimes(1)
      })
    })
    describe('when state version is the current version', () => {
      beforeEach(async () => {
        // answer false so we do not continue with deploy
        mockGetUserBooleanInput.mockResolvedValue(false)

        workspace.state.mockReturnValue(mockState({ },
          currentVersion,))
      })
      describe('when all services are valid', () => {
        beforeEach(async () => {
          await action({
            ...cliCommandArgs,
            input: inputOptions,
            workspace,
          })
        })
        it('should not recommend cancel', () => {
          expect(callbacks.shouldCancelCommand).not.toHaveBeenCalled()
        })
      })
      describe('when some services were never fetched', () => {
        beforeEach(async () => {
          workspace.getStateRecency.mockImplementationOnce(async serviceName => ({
            serviceName, status: 'Nonexistent', date: undefined,
          }))
          await action({
            ...cliCommandArgs,
            input: inputOptions,
            workspace,
          })
        })
        it('should recommend cancel', () => {
          expect(callbacks.shouldCancelCommand).toHaveBeenCalledTimes(1)
        })
      })
      describe('when some services are old', () => {
        beforeEach(async () => {
          workspace.getStateRecency.mockImplementationOnce(async serviceName => ({
            serviceName, status: 'Old', date: moment(new Date()).subtract(1, 'month').toDate(),
          }))
          await action({
            ...cliCommandArgs,
            input: inputOptions,
            workspace,
          })
        })
        it('should recommend cancel', () => {
          expect(callbacks.shouldCancelCommand).toHaveBeenCalledTimes(1)
        })
      })
    })
    describe('when state version is older than the current version by more than one patch', () => {
      const decreaseVersion = (version: semver.SemVer): semver.SemVer => {
        const prev = new semver.SemVer(version)
        if (prev.patch > 1) {
          prev.patch -= 2
        } else if (prev.minor > 0) {
          prev.minor -= 1
        } else if (prev.major > 0) {
          prev.major -= 1
        } else {
          throw new Error(`Cannot decrease version ${version.format()}`)
        }
        return prev
      }
      beforeEach(async () => {
        mockShouldCancel.mockResolvedValue(true)
        const prevVersion = decreaseVersion(semver.parse(currentVersion) as semver.SemVer)

        workspace.state.mockReturnValue(mockState({},
          prevVersion.format(),))
        await action({
          ...cliCommandArgs,
          input: inputOptions,
          workspace,
        })
      })
      it('should recommend cancel', () => {
        expect(callbacks.shouldCancelCommand).toHaveBeenCalledTimes(1)
      })
    })
  })
})
