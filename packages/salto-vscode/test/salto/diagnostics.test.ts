import * as path from 'path'
import { Config } from 'salto'
import { EditorWorkspace } from '../../src/salto/workspace'
import { getDiagnostics } from '../../src/salto/diagnostics'

describe('TEST', () => {
  const getConfig = (baseDir: string, additionalBlueprints: string[]): Config => ({
    baseDir,
    additionalBlueprints,
    stateLocation: path.join(baseDir, 'salto.config', 'state.bpc'),
    localStorage: '.',
    name: 'test',
    uid: '',
  })

  const baseBPDir = `${__dirname}/../../../test/salto/BP`
  const parseErrorBp = `${__dirname}/../../../test/salto/BP2/parse_error.bp`
  const validationErrorBp = `${__dirname}/../../../test/salto/BP2/error.bp`

  it('should diagnostics on parse errors', async () => {
    const workspace = await EditorWorkspace.load(getConfig(baseBPDir, [parseErrorBp]), false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.errors.hasErrors()).toBeTruthy()
    const diag = getDiagnostics(workspace)['../BP2/parse_error.bp'][0]
    expect(diag).toBeDefined()
    expect(diag.msg).toBe(
      'Expected the start of an expression, but found an invalid expression token.'
    )
    expect(diag.severity).toBe('Error')
  })
  it('should diagnostics on validations errors', async () => {
    const workspace = await EditorWorkspace.load(getConfig(baseBPDir, [validationErrorBp]), false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.errors.hasErrors()).toBeTruthy()
    const diag = getDiagnostics(workspace)['../BP2/error.bp'][0]
    expect(diag).toBeDefined()
    expect(diag.msg).toBe(
      'Invalid value type for salto.number : "ooppps"'
    )
    expect(diag.severity).toBe('Warning')
  })
  it('should no errors on non-existing file', async () => {
    const workspace = await EditorWorkspace.load(getConfig(baseBPDir, []), false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.errors.hasErrors()).toBeFalsy()
    expect(getDiagnostics(workspace)).toEqual({ 'complex_type.bp': [], 'simple_types.bp': [] })
  })
})
