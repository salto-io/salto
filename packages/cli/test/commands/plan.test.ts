import { Workspace } from 'salto'
import { command } from '../../src/commands/plan'
import { plan, MockWriteStream, getWorkspaceErrors, mockSpinnerCreator } from '../mocks'
import { SpinnerCreator, Spinner } from '../../src/types'

const mockPlan = plan
const mockWs = { hasErrors: () => false }
const mockErrWs = {
  hasErrors: () => true,
  errors: { strings: () => ['Error'] },
  getWorkspaceErrors,
}
jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  plan: jest.fn().mockImplementation(() => mockPlan()),
  Workspace: {
    load: jest.fn().mockImplementation(config => (config.baseDir === 'errdir' ? mockErrWs : mockWs)),
  },
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => ({ baseDir: workspaceDir, additionalBlueprints: [], cacheLocation: '' })
  ),
}))

describe('plan command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    spinners = []
    spinnerCreator = mockSpinnerCreator(spinners)
  })

  describe('when the workspace loads succesfully', () => {
    beforeEach(async () => {
      await command('', cliOutput, spinnerCreator).execute()
    })

    it('should load the workspace', async () => {
      expect(Workspace.load).toHaveBeenCalled()
    })

    it('should print summary', async () => {
      expect(cliOutput.stdout.content.search(/Plan.*0 to add, 3 to change, 0 to remove./)).toBeGreaterThan(0)
    })

    it('should find all elements', async () => {
      expect(cliOutput.stdout.content).toContain('lead')
      expect(cliOutput.stdout.content).toContain('account')
      expect(cliOutput.stdout.content).toContain('salto_employee_instance')
    })

    it('should find instance change', async () => {
      expect(cliOutput.stdout.content.search('name: "FirstEmployee" => "PostChange"')).toBeGreaterThan(0)
    })

    it('should have started spinner and it should succeed (and not fail)', async () => {
      expect(spinnerCreator).toHaveBeenCalled()
      expect(spinners).toHaveLength(1)
      expect(spinners[0].fail).not.toHaveBeenCalled()
      expect(spinners[0].succeed).toHaveBeenCalled()
      expect((spinners[0].succeed as jest.Mock).mock.calls[0][0]).toContain('Calculated')
    })
  })

  describe('when the workspace fails to load', () => {
    beforeEach(async () => {
      await command('errdir', cliOutput, spinnerCreator).execute()
    })

    it('should print the error', () => {
      expect(cliOutput.stderr.content).toContain('Error')
    })

    it('should fail the spinner', () => {
      expect(spinners[0].succeed).not.toHaveBeenCalled()
      expect(spinners[0].fail).toHaveBeenCalled()
      expect((spinners[0].fail as jest.Mock).mock.calls[0][0]).toContain('failed')
    })
  })
})
