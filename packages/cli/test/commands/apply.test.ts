import wu from 'wu'
import {
  ObjectType, InstanceElement,
} from 'adapter-api'
import {
  Workspace, Plan, PlanItem, Config,
} from 'salto'
import { apply, plan, MockWriteStream, getWorkspaceErrors } from '../mocks'
import { ApplyCommand } from '../../src/commands/apply'

const mockApply = apply
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
      return { hasErrors: () => false }
    }),
  },
  apply: jest.fn().mockImplementation((
    workspace: Workspace,
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
    shouldApply: (plan: Plan) => Promise<boolean>,
    reportProgress: (action: PlanItem) => void,
    force = false
  ) =>
  // Apply with blueprints will fail, doing this trick as we cannot reference vars, we get error:
  // "The module factory of `jest.mock()` is not allowed to reference any
  // out-of-scope variables."
  // Notice that blueprints are ignored in mockApply.

    mockApply(workspace, fillConfig, shouldApply, reportProgress, force)),
}))

describe('apply command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let command: ApplyCommand

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  })

  describe('valid apply', () => {
    beforeEach(() => {
      command = new ApplyCommand('', true, cliOutput)
    })

    describe('should print progress', () => {
      it('should load worksapce', () => {
        expect(Workspace.load).toHaveBeenCalled()
      })
      it('should print progress upon update', async () => {
        wu((plan()).itemsByEvalOrder()).forEach(item => command.updateCurrentAction(item))
        expect(cliOutput.stdout.content).toMatch('salesforce_lead: changing...')
      })

      describe('end current action', () => {
        beforeEach(async () => {
          const planItem = wu((plan()).itemsByEvalOrder()).next().value
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

    it('should run apply', async () => {
      await command.execute()
      const { content } = cliOutput.stdout
      expect(content.search('salesforce_lead: Change completed')).toBeGreaterThan(0)
      expect(content.search('salesforce_account: Change completed')).toBeGreaterThan(0)
    })
  })

  describe('invalid apply', () => {
    beforeEach(() => {
      // Creating here with base dir 'errorDir' will cause the mock to throw an error
      command = new ApplyCommand('errorDir', true, cliOutput)
    })
    it('should fail gracefully', async () => {
      await command.execute()
      expect(cliOutput.stderr.content.search('Error')).toBeGreaterThan(0)
    })
  })
})
