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
import {
  Workspace, Plan, PlanItem, currentEnvConfig,
} from '@salto-io/core'
import { Spinner, SpinnerCreator, CliExitCode, CliTelemetry } from '../../src/types'
import {
  deploy, preview, mockSpinnerCreator,
  MockWriteStream, getMockTelemetry,
  MockTelemetry,
} from '../mocks'
import { DeployCommand } from '../../src/commands/deploy'
import * as workspace from '../../src/workspace'
import { buildEventName, getCliTelemetry } from '../../src/telemetry'


const mockDeploy = deploy
const mockServices = (ws: Workspace): string[] => currentEnvConfig(ws.config).services as string[]
jest.mock('@salto-io/core', () => ({
  ...jest.requireActual('@salto-io/core'),
  deploy: jest.fn().mockImplementation((
    ws: Workspace,
    shouldDeploy: (plan: Plan) => Promise<boolean>,
    reportProgress: (action: PlanItem, step: string, details?: string) => void,
    force = false,
    services = mockServices(ws)
  ) =>
  // Deploy with blueprints will fail, doing this trick as we cannot reference vars, we get error:
  // "The module factory of `jest.mock()` is not allowed to reference any
  // out-of-scope variables."
  // Notice that blueprints are ignored in mockDeploy.

    mockDeploy(ws, shouldDeploy, reportProgress, services, force)),
}))
jest.mock('../../src/workspace')

const commandName = 'deploy'
const eventsNames = {
  failure: buildEventName(commandName, 'failure'),
}

describe('deploy command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let command: DeployCommand
  let mockTelemetry: MockTelemetry
  let mockCliTelemetry: CliTelemetry
  const spinners: Spinner[] = []
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation((baseDir: string) => {
    if (baseDir === 'errorDir') {
      return {
        workspace: {},
        errored: true,
      }
    }
    return {
      workspace: {},
      errored: false,
    }
  })

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    mockTelemetry = getMockTelemetry()
    mockCliTelemetry = getCliTelemetry(mockTelemetry, 'deploy')
    spinnerCreator = mockSpinnerCreator(spinners)
  })

  describe('valid deploy', () => {
    beforeEach(() => {
      command = new DeployCommand(
        '',
        true,
        services,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
      )
    })

    describe('report progress upon updates', () => {
      describe('items updated as started', () => {
        beforeEach(() => {
          wu((preview()).itemsByEvalOrder()).forEach(item => command.updateAction(item, 'started'))
        })
        it('should print action upon started step', async () => {
          expect(cliOutput.stdout.content.search('salesforce.lead')).toBeGreaterThan(0)
          expect(cliOutput.stdout.content.search('Changing')).toBeGreaterThan(0)
        })
        it('should print completion upon finish', async () => {
          wu((preview()).itemsByEvalOrder()).forEach(item => command.updateAction(item, 'finished'))
          expect(cliOutput.stdout.content.search('Change completed')).toBeGreaterThan(0)
        })
        it('should print failure upon error', async () => {
          wu((preview()).itemsByEvalOrder()).forEach(item => command.updateAction(item, 'error', 'error reason'))
          expect(cliOutput.stderr.content.search('Failed')).toBeGreaterThan(0)
        })
        it('it should cancel upon cancelling', async () => {
          wu((preview()).itemsByEvalOrder()).forEach(item => command.updateAction(item, 'cancelled', 'parent-node-name'))
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
        expect(mockLoadWorkspace).toHaveBeenCalled()
      })
      it('should print completeness', () => {
        expect(content).toContain('Deployment succeeded')
      })
      it('should update workspace', () => {
        expect(workspace.updateWorkspace as jest.Mock).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('invalid deploy', () => {
    beforeEach(() => {
      // Creating here with base dir 'errorDir' will cause the mock to throw an error
      command = new DeployCommand(
        'errorDir',
        true,
        services,
        mockCliTelemetry,
        cliOutput,
        spinnerCreator,
      )
    })
    it('should fail gracefully', async () => {
      const result = await command.execute()
      expect(result).toBe(CliExitCode.AppError)
      expect(mockTelemetry.getEvents()).toHaveLength(1)
      expect(mockTelemetry.getEventsMap()[eventsNames.failure]).not.toBeUndefined()
    })
  })
})
