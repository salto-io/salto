import { Workspace } from 'salto'
import { command } from '../../src/commands/preview'
import { preview, MockWriteStream, getWorkspaceErrors, mockSpinnerCreator, mockLoadConfig } from '../mocks'
import { SpinnerCreator, Spinner } from '../../src/types'

const mockPreview = preview
jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  preview: jest.fn().mockImplementation(() => mockPreview()),
  Workspace: {
    load: jest.fn().mockImplementation(config => {
      if (config.baseDir === 'errdir') {
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
        config,
      }
    }),
  },
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) => mockLoadConfig(workspaceDir)),
}))

describe('preview command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  let spinners: Spinner[]
  let spinnerCreator: SpinnerCreator
  const services = ['salesforce']

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
      expect(Workspace.load).toHaveBeenCalled()
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
      expect(spinners).toHaveLength(2) // first is for workspace load
      expect(spinners[1].fail).not.toHaveBeenCalled()
      expect(spinners[1].succeed).toHaveBeenCalled()
      expect((spinners[1].succeed as jest.Mock).mock.calls[0][0]).toContain('Calculated')
    })
  })

  describe('when the workspace fails to load', () => {
    beforeEach(async () => {
      await command('errdir', cliOutput, spinnerCreator, services).execute()
    })

    it('should print the error', () => {
      expect(cliOutput.stderr.content).toContain('Error')
    })

    it('should not start the preview spinner', () => {
      expect(spinners[1]).toBeUndefined()
    })
  })
})
