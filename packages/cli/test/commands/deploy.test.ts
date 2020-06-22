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
import wu from 'wu'
import { Plan, PlanItem } from '@salto-io/core'
import { Workspace } from '@salto-io/workspace'
import { Spinner, SpinnerCreator, CliExitCode, CliTelemetry } from '../../src/types'
import * as mocks from '../mocks'
import { DeployCommand } from '../../src/commands/deploy'
import * as workspace from '../../src/workspace/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'


const mockDeploy = mocks.deploy
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  deploy: jest.fn().mockImplementation((
    ws: Workspace,
    shouldDeploy: (plan: Plan) => Promise<boolean>,
    reportProgress: (action: PlanItem, step: string, details?: string) => void,
    force = false,
  ) =>
  // Deploy with Nacl files will fail, doing this trick as we cannot reference vars, we get error:
  // "The module factory of `jest.mock()` is not allowed to reference any
  // out-of-scope variables."
  // Notice that Nacl files are ignored in mockDeploy.

    mockDeploy(ws, shouldDeploy, reportProgress, [], force)),
}))
jest.mock('../../src/workspace/workspace')

const commandName = 'deploy'
const eventsNames = {
  failure: buildEventName(commandName, 'failure'),
}

describe('deploy command', () => {
  let cliOutput: { stdout: mocks.MockWriteStream; stderr: mocks.MockWriteStream }
  let command: DeployCommand
  let mockTelemetry: mocks.MockTelemetry
  let mockCliTelemetry: CliTelemetry
  const spinners: Spinner[] = []
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']
  const environment = 'inactive'

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(mocks.mockLoadWorkspaceEnvironment)

  beforeEach(() => {
    cliOutput = { stdout: new mocks.MockWriteStream(), stderr: new mocks.MockWriteStream() }
    mockTelemetry = mocks.getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'deploy')
    spinnerCreator = mocks.mockSpinnerCreator(spinners)
  })

  describe('valid deploy', () => {
    beforeEach(() => {
      command = new DeployCommand(
        '',
        true,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        services,
      )
    })

    describe('report progress upon updates', () => {
      describe('items updated as started', () => {
        beforeEach(() => {
          wu((mocks.preview()).itemsByEvalOrder()).forEach(item => command.updateAction(item, 'started'))
        })
        it('should print action upon started step', async () => {
          expect(cliOutput.stdout.content.search('salesforce.lead')).toBeGreaterThan(0)
          expect(cliOutput.stdout.content.search('Changing')).toBeGreaterThan(0)
        })
        it('should print completion upon finish', async () => {
          wu((mocks.preview()).itemsByEvalOrder()).forEach(item => command.updateAction(item, 'finished'))
          expect(cliOutput.stdout.content.search('Change completed')).toBeGreaterThan(0)
        })
        it('should print failure upon error', async () => {
          wu((mocks.preview()).itemsByEvalOrder()).forEach(item => command.updateAction(item, 'error', 'error reason'))
          expect(cliOutput.stderr.content.search('Failed')).toBeGreaterThan(0)
        })
        it('it should cancel upon cancelling', async () => {
          wu((mocks.preview()).itemsByEvalOrder()).forEach(item => command.updateAction(item, 'cancelled', 'parent-node-name'))
          expect(cliOutput.stderr.content.search('Cancelled')).toBeGreaterThan(0)
        })
      })
    })

    describe('execute deploy', () => {
      let content: string
      beforeAll(async () => {
        await command.execute()
        content = cliOutput.stdout.content
      })
      it('should load workspace', () => {
        expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
      })
      it('should print completeness', () => {
        expect(content).toContain('Deployment succeeded')
      })
      it('should update workspace', () => {
        expect(workspace.updateWorkspace as jest.Mock).toHaveBeenCalledTimes(1)
      })
      it('should use current env when env is not provided', () => {
        expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv()).toEqual('active')
      })
    })
  })

  describe('invalid deploy', () => {
    beforeEach(() => {
      // Creating here with base dir 'errorDir' will cause the mock to throw an error
      command = new DeployCommand(
        'errorDir',
        true,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        services,
      )
    })
    it('should fail gracefully', async () => {
      const result = await command.execute()
      expect(result).toBe(CliExitCode.AppError)
      expect(mockTelemetry.getEvents()).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
    })
  })
  describe('Using environment variable', () => {
    beforeAll(async () => {
      mockLoadWorkspace.mockClear()
      command = new DeployCommand(
        '',
        true,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
        services,
        environment,
      )
      await command.execute()
    })
    it('should use provided env', () => {
      expect(mockLoadWorkspace.mock.results[0].value.workspace.currentEnv()).toEqual(environment)
      expect(mockLoadWorkspace).toHaveBeenCalledTimes(1)
    })
  })
})
