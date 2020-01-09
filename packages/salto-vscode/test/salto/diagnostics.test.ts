import { EditorWorkspace } from '../../src/salto/workspace'
import { getDiagnostics } from '../../src/salto/diagnostics'
import { mockWorkspace } from './workspace'

describe('diagnostics', () => {
  it('should diagnostics on errors', async () => {
    const baseWs = await mockWorkspace()
    baseWs.getWorkspaceErrors = jest.fn().mockImplementation(() => Promise.resolve([{
      severity: 'Error',
      message: 'Blabla',
      sourceFragments: [{ sourceRange: { filename: 'parse_error.bp', start: 1, end: 2 } }],
    }]))
    const workspace = new EditorWorkspace(baseWs)
    const diag = (await getDiagnostics(workspace))['parse_error.bp'][0]
    expect(diag).toBeDefined()
    expect(diag.msg).toContain('Blabla')
    expect(diag.severity).toBe('Error')
  })
})
