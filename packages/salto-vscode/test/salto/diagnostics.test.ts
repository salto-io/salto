import { EditorWorkspace } from '../../src/salto/workspace'
import { getDiagnostics } from '../../src/salto/diagnostics'

describe('TEST', () => {
  const baseBPDir = `${__dirname}/../../../test/salto/BP`
  const parseErrorBp = `${__dirname}/../../../test/salto/BP2/parse_error.bp`

  it('should diagnostics on parse errors', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [parseErrorBp], false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.errors.hasErrors()).toBeTruthy()
    expect(getDiagnostics(workspace, parseErrorBp)).toEqual([
      {
        filename: parseErrorBp,
        msg: 'Invalid expression: Expected the start of an expression,'
             + ' but found an invalid expression token.',
        range: {
          end: {
            col: 0,
            line: 4,
          },
          start: {
            col: 7,
            line: 3,
          },
        },
      },
    ])
  })
  it('should no errors on non-existing file', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [], false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.errors.hasErrors()).toBeFalsy()
    expect(getDiagnostics(workspace, parseErrorBp)).toEqual([])
  })
})
