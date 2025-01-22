/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import * as saltoCoreModule from '@salto-io/core'
import { DeployResult, GroupProperties } from '@salto-io/core'
import { MockWorkspace, mockWorkspace, mockErrors } from '@salto-io/e2e-test-utils'
import { Workspace } from '@salto-io/workspace'
import * as saltoFileModule from '@salto-io/file'
import { Artifact, Change } from '@salto-io/adapter-api'
import chalk from 'chalk'
import Prompts from '../../src/prompts'
import { CliExitCode } from '../../src/types'
import * as callbacks from '../../src/callbacks'
import * as mocks from '../mocks'
import * as deployModule from '../../src/commands/deploy'
import { action } from '../../src/commands/deploy'

const mockDeploy = mocks.deploy
const mockPreview = mocks.preview

const mockDeployImpl =
  (extraProperties?: DeployResult['extraProperties']): typeof saltoCoreModule.deploy =>
  async (...args) =>
    // Deploy with Nacl files will fail, doing this trick as we cannot reference vars, we get error:
    // "The module factory of `jest.mock()` is not allowed to reference any
    // out-of-scope variables."
    // Notice that Nacl files are ignored in mockDeploy.
    ({
      ...(await mockDeploy(...args)),
      extraProperties,
    })

jest.mock('../../src/callbacks')
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual<{}>('@salto-io/core'),
  deploy: jest.fn(),
  preview: jest.fn().mockImplementation((_workspace: Workspace, _accounts: string[]) => mockPreview()),
  summarizeDeployChanges: jest
    .fn()
    .mockImplementation((requested: Change[], applied: Change[]) =>
      jest.requireActual<typeof saltoCoreModule>('@salto-io/core').summarizeDeployChanges(requested, applied),
    ),
}))
const mockedCore = jest.mocked(saltoCoreModule)
const mockedDeploy = jest.mocked(deployModule)

jest.mock('@salto-io/file', () => ({
  ...jest.requireActual('@salto-io/file'),
  writeFile: jest.fn(),
  mkdirp: jest.fn(),
}))
const mockedSaltoFile = jest.mocked(saltoFileModule)

const commandName = 'deploy'

describe('deploy command', () => {
  let workspace: MockWorkspace
  let output: mocks.MockCliOutput
  let cliCommandArgs: mocks.MockCommandArgs
  const accounts = ['salesforce']
  const mockGetUserBooleanInput = callbacks.getUserBooleanInput as jest.Mock
  const mockShouldCancel = callbacks.shouldCancelCommand as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockedCore.deploy.mockImplementation(mockDeployImpl())
    const cliArgs = mocks.mockCliArgs()
    cliCommandArgs = mocks.mockCliCommandArgs(commandName, cliArgs)
    output = cliArgs.output
    workspace = mockWorkspace({})
    mockGetUserBooleanInput.mockReset()
    mockShouldCancel.mockReset()
    jest.spyOn(deployModule, 'shouldDeploy')
  })

  describe('when deploying changes', () => {
    let result: number

    beforeEach(async () => {
      mockGetUserBooleanInput.mockResolvedValueOnce(true)
      result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          checkOnly: false,
          accounts,
        },
        workspace,
      })
    })
    it('should return success error code', () => {
      expect(result).toBe(CliExitCode.Success)
    })

    it('should print success message', () => {
      expect(output.stdout.content).toContain('Deployment succeeded')
    })
  })

  describe('deploy artifacts', () => {
    const ARTIFACTS_DIR = '/tmp/artifacts'

    const ARTIFACT: Artifact = {
      name: 'testArtifact.txt',
      content: Buffer.from('test'),
    }

    let groups: GroupProperties[]

    beforeEach(async () => {
      mockGetUserBooleanInput.mockResolvedValueOnce(true)
      groups = [
        {
          id: 'testGroup',
          accountName: 'dummy',
          artifacts: [ARTIFACT],
        },
        {
          id: 'testGroup',
          accountName: 'dummy2',
          artifacts: [ARTIFACT],
        },
      ]
    })
    describe('when artifactsDir param is provided', () => {
      describe('when DeployResult has artifacts', () => {
        beforeEach(() => {
          mockedCore.deploy.mockImplementation(
            mockDeployImpl({
              groups,
            }),
          )
        })
        it('should write artifacts', async () => {
          const result = await action({
            ...cliCommandArgs,
            input: {
              force: false,
              dryRun: false,
              detailedPlan: false,
              checkOnly: false,
              artifactsDir: ARTIFACTS_DIR,
              accounts,
            },
            workspace,
          })
          expect(result).toBe(CliExitCode.Success)
          expect(mockedSaltoFile.mkdirp).toHaveBeenCalledWith(`${ARTIFACTS_DIR}/dummy`)
          expect(mockedSaltoFile.mkdirp).toHaveBeenCalledWith(`${ARTIFACTS_DIR}/dummy2`)
          expect(mockedSaltoFile.writeFile).toHaveBeenCalledWith(
            `${ARTIFACTS_DIR}/dummy/${ARTIFACT.name}`,
            ARTIFACT.content,
          )
          expect(mockedSaltoFile.writeFile).toHaveBeenCalledWith(
            `${ARTIFACTS_DIR}/dummy2/${ARTIFACT.name}`,
            ARTIFACT.content,
          )
        })
      })
      describe('when DeployResult has no artifacts', () => {
        beforeEach(() => {
          mockedCore.deploy.mockImplementation(
            mockDeployImpl({
              groups: [
                {
                  id: 'testGroup',
                  accountName: 'dummy',
                },
              ],
            }),
          )
        })
        it('should not write artifacts', async () => {
          const result = await action({
            ...cliCommandArgs,
            input: {
              force: false,
              dryRun: false,
              detailedPlan: false,
              checkOnly: false,
              artifactsDir: ARTIFACTS_DIR,
              accounts,
            },
            workspace,
          })
          expect(result).toBe(CliExitCode.Success)
          expect(mockedSaltoFile.mkdirp).not.toHaveBeenCalledWith(`${ARTIFACTS_DIR}/dummy`)
          expect(mockedSaltoFile.mkdirp).not.toHaveBeenCalledWith(`${ARTIFACTS_DIR}/dummy2`)
          expect(mockedSaltoFile.writeFile).not.toHaveBeenCalledWith(
            `${ARTIFACTS_DIR}/dummy/${ARTIFACT.name}`,
            ARTIFACT.content,
          )
          expect(mockedSaltoFile.writeFile).not.toHaveBeenCalledWith(
            `${ARTIFACTS_DIR}/dummy2/${ARTIFACT.name}`,
            ARTIFACT.content,
          )
        })
      })
    })
    describe('when artifactsDir param is not provided', () => {
      beforeEach(async () => {
        mockGetUserBooleanInput.mockResolvedValueOnce(true)
      })
      describe('when DeployResult has artifacts', () => {
        beforeEach(() => {
          mockedCore.deploy.mockImplementation(
            mockDeployImpl({
              groups,
            }),
          )
        })
        it('should not write artifacts', async () => {
          const result = await action({
            ...cliCommandArgs,
            input: {
              force: false,
              dryRun: false,
              detailedPlan: false,
              checkOnly: false,
              accounts,
            },
            workspace,
          })
          expect(result).toBe(CliExitCode.Success)
          expect(mockedSaltoFile.mkdirp).not.toHaveBeenCalledWith(`${ARTIFACTS_DIR}/dummy`)
          expect(mockedSaltoFile.mkdirp).not.toHaveBeenCalledWith(`${ARTIFACTS_DIR}/dummy2`)
          expect(mockedSaltoFile.writeFile).not.toHaveBeenCalledWith(
            `${ARTIFACTS_DIR}/dummy/${ARTIFACT.name}`,
            ARTIFACT.content,
          )
          expect(mockedSaltoFile.writeFile).not.toHaveBeenCalledWith(
            `${ARTIFACTS_DIR}/dummy2/${ARTIFACT.name}`,
            ARTIFACT.content,
          )
        })
      })
      describe('when DeployResult has no artifacts', () => {
        beforeEach(() => {
          mockedCore.deploy.mockImplementation(
            mockDeployImpl({
              groups: [
                {
                  id: 'testGroup',
                  accountName: 'dummy',
                },
              ],
            }),
          )
        })
        it('should not write artifacts', async () => {
          const result = await action({
            ...cliCommandArgs,
            input: {
              force: false,
              dryRun: false,
              detailedPlan: false,
              checkOnly: false,
              accounts,
            },
            workspace,
          })
          expect(result).toBe(CliExitCode.Success)
          expect(mockedSaltoFile.mkdirp).not.toHaveBeenCalledWith(`${ARTIFACTS_DIR}/dummy`)
          expect(mockedSaltoFile.mkdirp).not.toHaveBeenCalledWith(`${ARTIFACTS_DIR}/dummy2`)
          expect(mockedSaltoFile.writeFile).not.toHaveBeenCalledWith(
            `${ARTIFACTS_DIR}/dummy/${ARTIFACT.name}`,
            ARTIFACT.content,
          )
          expect(mockedSaltoFile.writeFile).not.toHaveBeenCalledWith(
            `${ARTIFACTS_DIR}/dummy2/${ARTIFACT.name}`,
            ARTIFACT.content,
          )
        })
      })
    })
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
          checkOnly: false,
          accounts,
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
          checkOnly: false,
          accounts,
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
          checkOnly: false,
          accounts,
        },
        workspace,
      })
      expect(result).toBe(CliExitCode.Success)
      // exit without attempting to deploy
      expect(output.stdout.content).not.toContain('Cancelling deploy')
      expect(output.stdout.content).not.toContain('Deployment succeeded')
      expect(output.stdout.content).not.toContain(Prompts.DEPLOYMENT_SUMMARY_HEADLINE)
      expect(mockedDeploy.shouldDeploy).not.toHaveBeenCalled()
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
          checkOnly: false,
          accounts,
        },
        workspace,
      })
      expect(output.stdout.content).toMatch(/M.*name: "FirstEmployee" => "PostChange"/)
    })
  })

  describe('invalid deploy', () => {
    it('should fail gracefully', async () => {
      workspace.errors.mockResolvedValue(
        mockErrors([{ severity: 'Error', message: 'some error', detailedMessage: 'some error' }]),
      )
      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          checkOnly: false,
          accounts,
        },
        workspace,
      })
      expect(result).toBe(CliExitCode.AppError)
    })
    it('should allow the user to cancel when there are warnings', async () => {
      workspace.errors.mockResolvedValue(
        mockErrors([{ severity: 'Warning', message: 'some warning', detailedMessage: 'some warning' }]),
      )
      mockGetUserBooleanInput.mockResolvedValue(false)
      const result = await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          checkOnly: false,
          accounts,
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
        workspace.errors.mockResolvedValueOnce(mockErrors([{ severity: 'Error', message: '', detailedMessage: '' }]))
        return { naclFilesChangesCount: 0, stateOnlyChangesCount: 0 }
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
            checkOnly: false,
            accounts,
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
            checkOnly: false,
            accounts,
          },
          workspace,
        })
        expect(result).toBe(CliExitCode.AppError)
        expect(callbacks.getUserBooleanInput).not.toHaveBeenCalled()
        expect(output.stderr.content).toContain('Failed')
        expect(mockedDeploy.shouldDeploy).not.toHaveBeenCalled()
      })
    })
  })
  describe('when there are deploy actions', () => {
    const testDeployActionsVisibility = async (userBooleanInput: boolean): Promise<void> => {
      mockGetUserBooleanInput.mockResolvedValueOnce(userBooleanInput)
      await action({
        ...cliCommandArgs,
        input: {
          force: false,
          dryRun: false,
          detailedPlan: false,
          checkOnly: false,
          accounts,
          env: mocks.withEnvironmentParam,
        },
        workspace,
      })
      if (userBooleanInput) {
        expect(output.stdout.content).not.toContain('Cancelling deploy')
        expect(output.stdout.content).toContain('Deployment succeeded')
        expect(output.stdout.content).toContain('Successful change - postDeployAction with showOnFailure=true')
        expect(output.stdout.content).toContain('Successful change - postDeployAction with showOnFailure=false')
        expect(output.stdout.content).toContain('Failed change - postDeployAction with showOnFailure=true')
        expect(output.stdout.content).not.toContain('Failed change - postDeployAction with showOnFailure=false')
      } else {
        expect(output.stdout.content).toContain('Cancelling deploy')
        expect(output.stdout.content).not.toContain('Deployment succeeded')
      }
      expect(output.stdout.content).toContain(Prompts.DEPLOY_PRE_ACTION_HEADER)
      expect(output.stdout.content).toContain(Prompts.DEPLOY_POST_ACTION_HEADER)
      expect(output.stdout.content).toMatch(/preDeployAction/s)
      expect(output.stdout.content).toMatch(/preDeployAction2/s)
      expect(output.stdout.content).toMatch(/first subtext/s)
      expect(output.stdout.content).toMatch(/second subtext/s)
      expect(output.stdout.content).toMatch(/third subtext/s)
      expect(output.stdout.content).toMatch(/fourth subtext/s)
      expect(output.stdout.content).toMatch(/first subtext2/s)
      expect(output.stdout.content).toMatch(/second subtext2/s)
      expect(output.stdout.content).toMatch(/third subtext2/s)
      expect(output.stdout.content).toMatch(/fourth subtext2/s)
      expect(mockedDeploy.shouldDeploy).toHaveBeenCalled()
    }
    it('should print deploy actions when deploy is done', async () => {
      await testDeployActionsVisibility(true)
    })
    it('should print deploy actions when deploy is canceled', async () => {
      await testDeployActionsVisibility(false)
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
          checkOnly: false,
          accounts,
          env: mocks.withEnvironmentParam,
        },
        workspace,
      })
      expect(workspace.setCurrentEnv).toHaveBeenCalledWith(mocks.withEnvironmentParam, false)
    })
  })
  describe('Post deployment summary', () => {
    describe('when all elements deployed successfully', () => {
      beforeEach(async () => {
        mockedCore.summarizeDeployChanges.mockReturnValue({
          a: 'success',
          b: 'success',
        })
        mockGetUserBooleanInput.mockResolvedValueOnce(true)
        await action({
          ...cliCommandArgs,
          input: {
            force: false,
            dryRun: false,
            detailedPlan: true,
            checkOnly: false,
            accounts,
          },
          workspace,
        })
      })
      it('should not print legend or instances', async () => {
        expect(output.stdout.content).not.toContain(Prompts.DEPLOYMENT_SUMMARY_LEGEND)
        expect(output.stdout.content).not.toContain(chalk.green('S'))
        expect(output.stdout.content).not.toContain(chalk.yellow('P'))
        expect(output.stdout.content).not.toContain(chalk.red('F'))
      })
      it('should print headline and success message', async () => {
        expect(output.stdout.content).toContain(Prompts.DEPLOYMENT_SUMMARY_HEADLINE)
        expect(output.stdout.content).toContain(Prompts.ALL_DEPLOYMENT_ELEMENTS_SUCCEEDED)
      })
    })
    describe('when all elements failed deployment', () => {
      beforeEach(async () => {
        mockedCore.summarizeDeployChanges.mockReturnValue({
          instance_test: 'failure',
          test_instance: 'failure',
        })
        mockGetUserBooleanInput.mockResolvedValueOnce(true)
        await action({
          ...cliCommandArgs,
          input: {
            force: false,
            dryRun: false,
            detailedPlan: true,
            checkOnly: false,
            accounts,
          },
          workspace,
        })
      })
      it('should print all failed elements as failed', async () => {
        expect(output.stdout.content).toContain(Prompts.DEPLOYMENT_SUMMARY_HEADLINE)
        expect(output.stdout.content).toContain(Prompts.ALL_DEPLOYMENT_ELEMENTS_FAILED)
      })
      it('should not print elements', async () => {
        expect(output.stdout.content).not.toContain(chalk.green('S'))
        expect(output.stdout.content).not.toContain(chalk.yellow('P'))
        expect(output.stdout.content).not.toContain(`${chalk.red('F')} instance_test`)
        expect(output.stdout.content).not.toContain(`${chalk.red('F')} test_instance`)
      })
    })
    describe('when deployment is partially successful', () => {
      beforeEach(async () => {
        mockedCore.summarizeDeployChanges.mockReturnValue({
          instance_test: 'failure',
          test_instance: 'success',
          tester_instance: 'partial-success',
        })
        mockGetUserBooleanInput.mockResolvedValueOnce(true)
        await action({
          ...cliCommandArgs,
          input: {
            force: false,
            dryRun: false,
            detailedPlan: true,
            checkOnly: false,
            accounts,
          },
          workspace,
        })
      })
      it('should print all the elements and their deployment status', async () => {
        expect(output.stdout.content).toContain(`${chalk.red('F')} instance_test`)
        expect(output.stdout.content).toContain(`${chalk.green('S')} test_instance`)
        expect(output.stdout.content).toContain(`${chalk.yellow('P')} tester_instance`)
        expect(output.stdout.content).toContain(Prompts.DEPLOYMENT_SUMMARY_HEADLINE)
        expect(output.stdout.content).toContain(Prompts.DEPLOYMENT_SUMMARY_LEGEND)
      })
    })
    describe('when all elements are partially successful', () => {
      beforeEach(async () => {
        mockedCore.summarizeDeployChanges.mockReturnValue({
          instance_test: 'partial-success',
          test_instance: 'partial-success',
        })
        mockGetUserBooleanInput.mockResolvedValueOnce(true)
        await action({
          ...cliCommandArgs,
          input: {
            force: false,
            dryRun: false,
            detailedPlan: true,
            checkOnly: false,
            accounts,
          },
          workspace,
        })
      })
      it('should print all elements as partially successful', async () => {
        expect(output.stdout.content).toContain(Prompts.DEPLOYMENT_SUMMARY_HEADLINE)
        expect(output.stdout.content).toContain(Prompts.DEPLOYMENT_SUMMARY_LEGEND)
        expect(output.stdout.content).toContain(`${chalk.yellow('P')} instance_test`)
        expect(output.stdout.content).toContain(`${chalk.yellow('P')} test_instance`)
      })
    })
  })
})
