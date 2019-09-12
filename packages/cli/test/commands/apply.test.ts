import wu from 'wu'
import {
  ObjectType, InstanceElement,
} from 'adapter-api'
import {
  Blueprint, Plan, PlanItem,
} from 'salto'
import { apply, plan, MockWriteStream } from '../mocks'
import { ApplyCommand } from '../../src/commands/apply'

const mockApply = apply
jest.mock('salto', () => ({
  apply: jest.fn().mockImplementation((
    blueprints: Blueprint[],
    fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
    shouldApply: (plan: Plan) => Promise<boolean>,
    reportProgress: (action: PlanItem) => void,
    force = false
  ) => {
    // Apply with blueprints will fail, doing this trick as we cannot reference vars, we get error:
    // "The module factory of `jest.mock()` is not allowed to reference any
    // out-of-scope variables."
    // Notice that blueprints are ignored in mockApply.
    if (blueprints.length > 0) {
      throw new Error('FAIL')
    }
    return mockApply(blueprints, fillConfig, shouldApply, reportProgress, force)
  }),
}))

describe('apply command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let command: ApplyCommand

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  })

  describe('valid apply', () => {
    beforeEach(() => {
      command = new ApplyCommand([], true, cliOutput)
    })

    describe('should print progress', () => {
      it('should print progress upon update', async () => {
        wu((await plan([])).itemsByEvalOrder()).forEach(item => command.updateCurrentAction(item))
        expect(cliOutput.stdout.content).toMatch('salesforce_lead: changing...')
      })

      describe('end current action', () => {
        beforeEach(async () => {
          const planItem = wu((await plan([])).itemsByEvalOrder()).next().value
          command.updateCurrentAction(planItem)
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
      // Creating here apply with BP to fail the apply - see mock impl.
      command = new ApplyCommand([{ buffer: Buffer.from(''), filename: 'bla' }], true, cliOutput)
    })
    it('should fail gracefully', async () => {
      await command.execute()
      expect(cliOutput.stderr.content.search('Error')).toBeGreaterThan(0)
    })
  })
})
