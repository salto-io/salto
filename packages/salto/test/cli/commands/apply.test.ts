import { ObjectType, InstanceElement } from 'adapter-api'
import wu from 'wu'
import * as coreMock from '../../core/mocks/core'
import { Blueprint } from '../../../src/core/blueprint'
import { Plan, PlanItem } from '../../../src/core/plan'
import { ApplyCommand } from '../../../src/cli/commands/apply'
import { MockWriteStream } from '../mocks'

const mockApply = coreMock.apply
jest.mock('../../../src/core/commands', () => ({
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

describe('cli/commands/apply.ts', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let command: ApplyCommand

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  })

  describe('valid apply', () => {
    beforeEach(() => {
      command = new ApplyCommand([], true, cliOutput)
    })

    it('should print progress', async () => {
      const plan = await coreMock.plan([])
      wu(plan.itemsByEvalOrder()).forEach(item => command.updateCurrentAction(item))
      expect(cliOutput.stdout.content).toMatch('salesforce_lead: changing...')
      command.endCurrentAction()
      expect(cliOutput.stdout.content.search('salesforce_lead: Change completed')).toBeGreaterThan(0)
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
