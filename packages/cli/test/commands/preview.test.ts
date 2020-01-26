import { command } from '../../src/commands/preview'
import { preview, MockWriteStream, getWorkspaceErrors, mockSpinnerCreator, mockLoadConfig, transformToWorkspaceError } from '../mocks'
import { SpinnerCreator, Spinner, CliExitCode } from '../../src/types'
import * as workspace from '../../src/workspace'

const mockPreview = preview
jest.mock('salto', () => ({
  ...jest.requireActual('salto'),
  preview: jest.fn().mockImplementation(() => mockPreview()),
}))
jest.mock('../../src/workspace')
describe('preview command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']

  const mockLoadWorkspace = workspace.loadWorkspace as jest.Mock
  mockLoadWorkspace.mockImplementation(baseDir => {
    if (baseDir === 'errdir') {
      return { workspace: {
        hasErrors: () => true,
        errors: {
          strings: () => ['Error', 'Error'],
        },
        getWorkspaceErrors,
        config: mockLoadConfig(baseDir),
        transformToWorkspaceError,
      },
      errored: true }
    }
    return { workspace: {
      hasErrors: () => false,
      config: mockLoadConfig(baseDir),
      transformToWorkspaceError,
    },
    errored: false }
  })

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    spinners = []
    spinnerCreator = mockSpinnerCreator(spinners)
  })

  describe('when the workspace loads successfully', () => {
    beforeEach(async () => {
      await command('', cliOutput, spinnerCreator, services).execute()
    })

    it('should load the workspace', async () => {
      expect(mockLoadWorkspace).toHaveBeenCalled()
    })

    it('should print summary', async () => {
      expect(cliOutput.stdout.content.search(/Impacts.*2 types and 1 instance/)).toBeGreaterThan(0)
    })

    it('should find all elements', async () => {
      expect(cliOutput.stdout.content).toContain('lead')
      expect(cliOutput.stdout.content).toContain('account')
      expect(cliOutput.stdout.content).toContain('salto.employee.instance.test')
    })

    it('should find instance change', async () => {
      expect(cliOutput.stdout.content.search('name: "FirstEmployee" => "PostChange"')).toBeGreaterThan(0)
    })

    it('should have started spinner and it should succeed (and not fail)', async () => {
      expect(spinnerCreator).toHaveBeenCalled()
      expect(spinners[0].fail).not.toHaveBeenCalled()
      expect(spinners[0].succeed).toHaveBeenCalled()
      expect((spinners[0].succeed as jest.Mock).mock.calls[0][0]).toContain('Calculated')
    })
  })

  describe('when the workspace fails to load', () => {
    let result: number
    beforeEach(async () => {
      result = await command('errdir', cliOutput, spinnerCreator, services).execute()
    })

    it('should fail', () => {
      expect(result).toBe(CliExitCode.AppError)
    })

    it('should not start the preview spinner', () => {
      expect(spinners[1]).toBeUndefined()
    })
  })
})
