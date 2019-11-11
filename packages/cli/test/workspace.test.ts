import { Workspace } from 'salto'
import { CliOutput } from 'src/types'
import { validateWorkspace } from '../src/workspace'
import { MockWriteStream } from './mocks'


const mockWs = {
  hasErrors: jest.fn(),
  getWorkspaceErrors: jest.fn(),
} as unknown as Workspace

describe('workspace', () => {
  let cliOutput: CliOutput
  beforeEach(() => {
    cliOutput = { stderr: new MockWriteStream(), stdout: new MockWriteStream() }
  })

  describe('error validation', () => {
    describe('when there are no errors', () => {
      it('returns true', () => {
        mockWs.hasErrors = jest.fn().mockImplementation(() => false)
        const wsValid = validateWorkspace(mockWs, cliOutput)
        expect(mockWs.hasErrors).toHaveBeenCalled()
        expect(wsValid).toBeTruthy()
      })
    })
    describe('when there are errors', () => {
      it('returns true if there are only warnings', () => {
        mockWs.hasErrors = jest.fn().mockImplementation(() => true)
        mockWs.getWorkspaceErrors = jest.fn().mockImplementation(() => (
          [{
            sourceFragments: [],
            error: 'Error',
            severity: 'Warning',
          },
          {
            sourceFragments: [],
            error: 'Error2',
            severity: 'Warning',
          }]
        ))

        const wsValid = validateWorkspace(mockWs, cliOutput)
        expect(mockWs.hasErrors).toHaveBeenCalled()
        expect(mockWs.getWorkspaceErrors).toHaveBeenCalled()
        expect(wsValid).toBeTruthy()
      })

      it('returns false if there is at least one sever error', () => {
        mockWs.hasErrors = jest.fn().mockImplementation(() => true)
        mockWs.getWorkspaceErrors = jest.fn().mockImplementation(() => (
          [{
            sourceFragments: [],
            error: 'Error',
            severity: 'Warning',
          },
          {
            sourceFragments: [],
            error: 'Error2',
            severity: 'Error',
          }]
        ))

        const wsValid = validateWorkspace(mockWs, cliOutput)
        expect(mockWs.hasErrors).toHaveBeenCalled()
        expect(mockWs.getWorkspaceErrors).toHaveBeenCalled()
        expect(wsValid).toBe('Error')
      })
    })
  })
})
