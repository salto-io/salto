import wu from 'wu'
import {
  ObjectType, InstanceElement,
} from 'adapter-api'
import {
  Workspace, Plan, PlanItem, Config,
} from 'salto'
import { Spinner, SpinnerCreator } from 'src/types'
import { deploy, preview, mockSpinnerCreator, MockWriteStream, getWorkspaceErrors, mockLoadConfig } from '../mocks'
import { DeployCommand } from '../../src/commands/deploy'

const mockDeploy = deploy
const mockUpdateBlueprints = jest.fn().mockImplementation(() => Promise.resolve())
const mockFlush = jest.fn().mockImplementation(() => Promise.resolve())
jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) => mockLoadConfig(workspaceDir)),
  Workspace: {
    load: jest.fn().mockImplementation((
      config: Config
    ) => {
      if (config.baseDir === 'errorDir') {
        return {
          hasErrors: () => true,
          errors: {
            strings: () => ['Error', 'Error'],
          },
          getWorkspaceErrors,
          config,
        }
      }
      return {
        hasErrors: () => false,
        updateBlueprints: mockUpdateBlueprints,
        flush: mockFlush,
        config,
      }
    }),
  },
  deploy: jest.fn().mockImplementation((
    workspace: Workspace,
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
    shouldDeploy: (plan: Plan) => Promise<boolean>,
    reportProgress: (action: PlanItem, step: string, details?: string) => void,
    force = false,
    services: string[] = workspace.config.services
  ) =>
  // Deploy with blueprints will fail, doing this trick as we cannot reference vars, we get error:
  // "The module factory of `jest.mock()` is not allowed to reference any
  // out-of-scope variables."
  // Notice that blueprints are ignored in mockDeploy.

    mockDeploy(workspace, fillConfig, shouldDeploy, reportProgress, services, force)),
}))

describe('deploy command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let command: DeployCommand
  const spinners: Spinner[] = []
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    spinnerCreator = mockSpinnerCreator(spinners)
  })

  describe('valid deploy', () => {
    beforeEach(() => {
      command = new DeployCommand('', true, services, cliOutput, spinnerCreator)
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
        expect(Workspace.load).toHaveBeenCalled()
      })
      it('should print completeness', () => {
        expect(content).toContain('Deployment succeeded')
      })
      it('should Update workspace', () => {
        expect(mockUpdateBlueprints).toHaveBeenCalledTimes(1)
        expect(mockFlush).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('invalid deploy', () => {
    beforeEach(() => {
      // Creating here with base dir 'errorDir' will cause the mock to throw an error
      command = new DeployCommand('errorDir', true, services, cliOutput, spinnerCreator)
    })
    it('should fail gracefully', async () => {
      await command.execute()
      expect(cliOutput.stderr.content.search('Error')).toBeGreaterThan(0)
    })
  })
})
