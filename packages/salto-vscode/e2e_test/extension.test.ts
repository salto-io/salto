import readdirp from 'readdirp'
import tmp from 'tmp-promise'
import { file, SALTO_HOME_VAR, Workspace } from 'salto'
import * as path from 'path'
import { EditorWorkspace } from '../src/salto/workspace'
import { getPositionContext } from '../src/salto/context'
import { provideWorkspaceCompletionItems } from '../src/salto/completions/provider'
import { getDiagnostics } from '../src/salto/diagnostics'
import { provideWorkspaceDefinition } from '../src/salto/definitions'

const { copyFile, rm, mkdirp, readTextFile } = file

describe('extension e2e', () => {
  const wsBPs = `${__dirname}/../../e2e_test/test-workspace`
  let workspace: EditorWorkspace
  let wsPath: string; let
    homePath: string

  beforeAll(async () => {
    homePath = tmp.dirSync().name
    process.env[SALTO_HOME_VAR] = homePath

    wsPath = tmp.dirSync().name
    await mkdirp(wsPath)
    const bps = await readdirp.promise(wsBPs, {
      fileFilter: '*.bp',
      directoryFilter: e => e.basename[0] !== '.',
    })
    bps.forEach(bp => { copyFile(bp.fullPath, `${wsPath}/${bp.basename}`) })

    workspace = new EditorWorkspace(await Workspace.init(wsPath))
  })

  afterAll(async () => {
    await rm(wsPath)
    await rm(homePath)
  })

  it('should suggest type and instances completions', async () => {
    const pos = { line: 10, col: 0 }
    const filename = 'extra.bp'
    const ctx = await getPositionContext(workspace, await readTextFile(path.join(wsPath, filename)),
      filename, pos)
    const suggestions = provideWorkspaceCompletionItems(workspace, ctx, '', pos)
    expect(suggestions.map(s => s.label).sort()).toEqual(
      ['boolean', 'number', 'salto', 'salto_complex', 'salto_complex2', 'salto_num', 'salto_number',
        'salto_obj', 'salto_str', 'salto_string', 'serviceid', 'string', 'type']
    )
  })

  it('should diagnostics on errors', async () => {
    const diag = await getDiagnostics(workspace)
    const err = diag['error.bp'][0]
    expect(err.msg).toContain(
      'Error merging salto.complex.instance.inst1: duplicate key str'
    )
    expect(err.severity).toBe('Error')
    const warn = diag['error.bp'][2]
    expect(warn.msg).toContain('Invalid value type for salto.number')
    expect(warn.severity).toBe('Warning')
  })


  it('should give a single definition for a type that is defined in multiple files',
    async () => {
      const pos = { line: 6, col: 9 }
      const filename = 'extra.bp'
      const ctx = await getPositionContext(workspace,
        await readTextFile(path.join(wsPath, filename)), filename, pos)
      const defs = await provideWorkspaceDefinition(workspace, ctx, 'salto_complex')
      expect(defs.length).toBe(2)
      expect(defs[0].fullname).toBe('salto.complex')
      expect(defs[0].filename).toBe('complex_type.bp')
      expect(defs[0].range.start.line).toBe(1)
      expect(defs[0].range.start.col).toBe(1)
      expect(defs[0].range.end.line).toBe(9)
      expect(defs[0].range.end.col).toBe(2)
      expect(defs[1].fullname).toBe('salto.complex')
      expect(defs[1].filename).toBe('context.bp')
      expect(defs[1].range.start.line).toBe(18)
      expect(defs[1].range.start.col).toBe(1)
      expect(defs[1].range.end.line).toBe(20)
      expect(defs[1].range.end.col).toBe(2)
    })

  // def from multiples files
})
