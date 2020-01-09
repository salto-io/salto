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
    expect(suggestions).toEqual([])
  })

  it('should diagnostics on validations errors', async () => {
    const diag = await getDiagnostics(workspace)
    expect(Object.values(diag)).toHaveLength(1)
    expect(diag['error.bp'][0].msg).toContain(
      'Invalid value type for salto.number : "ooppps"'
    )
    expect(diag.severity).toBe('Warning')
  })


  it('should give a single definition for a type that is defined once', async () => {
    const pos = { line: 6, col: 9 }
    const filename = 'extra.bp'
    const ctx = await getPositionContext(workspace, await readTextFile(path.join(wsPath, filename)),
      filename, pos)
    const defs = await provideWorkspaceDefinition(workspace, ctx, 'salto_number')
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(13)
  })
})
