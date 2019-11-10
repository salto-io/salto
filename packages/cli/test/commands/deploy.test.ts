import wu from 'wu'
import {
  ObjectType, InstanceElement,
} from 'adapter-api'
import {
  Workspace, Plan, PlanItem, Config,
} from 'salto'
import { deploy, preview, MockWriteStream, getWorkspaceErrors } from '../mocks'
import { DeployCommand } from '../../src/commands/deploy'

const mockDeploy = deploy
const mockUpdateBlueprints = jest.fn().mockImplementation(() => Promise.resolve())
const mockFlush = jest.fn().mockImplementation(() => Promise.resolve())
jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => Promise.resolve({ baseDir: workspaceDir, additionalBlueprints: [], cacheLocation: '' })
  ),
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
        }
      }
      return {
        hasErrors: () => false,
        updateBlueprints: mockUpdateBlueprints,
        flush: mockFlush,
      }
    }),
  },
  deploy: jest.fn().mockImplementation((
    workspace: Workspace,
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
    shouldDeploy: (plan: Plan) => Promise<boolean>,
    reportProgress: (action: PlanItem) => void,
    force = false
  ) =>
  // Deploy with blueprints will fail, doing this trick as we cannot reference vars, we get error:
  // "The module factory of `jest.mock()` is not allowed to reference any
  // out-of-scope variables."
  // Notice that blueprints are ignored in mockDeploy.

    mockDeploy(workspace, fillConfig, shouldDeploy, reportProgress, force)),
}))

describe('deploy command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let command: DeployCommand

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  })

  describe('valid deploy', () => {
    beforeEach(() => {
      command = new DeployCommand('', true, cliOutput)
    })

    describe('should print progress', () => {
      it('should print progress upon update', async () => {
        wu((preview()).itemsByEvalOrder()).forEach(item => command.updateCurrentAction(item))
        expect(cliOutput.stdout.content).toMatch('salesforce_lead: changing...')
      })

      describe('end current action', () => {
        beforeEach(async () => {
          const planItem = wu((preview()).itemsByEvalOrder()).next().value
          command.updateCurrentAction(planItem)
        })

        it('should poll current action', () => {
          command.pollCurrentAction()
          expect(cliOutput.stdout.content.search('Still changing...')).toBeGreaterThan(0)
        })

        it('should print progress upon update', () => {
          command.endCurrentAction()
          expect(cliOutput.stdout.content.search('Change completed')).toBeGreaterThan(0)
        })
      })
    })

    describe('should run deploy', () => {
      let content: string
      beforeAll(async () => {
        await command.execute()
        content = cliOutput.stdout.content
      })

      it('should load worksapce', () => {
        expect(Workspace.load).toHaveBeenCalled()
      })

      it('should print Change completed', () => {
        expect(content.search('salesforce_lead: Change completed')).toBeGreaterThan(0)
        expect(content.search('salesforce_account: Change completed')).toBeGreaterThan(0)
      })

      it('should print Update workspace', () => {
        expect(content.search('Updating workspace with')).toBeGreaterThan(0)
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
      command = new DeployCommand('errorDir', true, cliOutput)
    })
    it('should fail gracefully', async () => {
      await command.execute()
      expect(cliOutput.stderr.content.search('Error')).toBeGreaterThan(0)
    })
  })
})
