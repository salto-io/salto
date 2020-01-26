import { EditorWorkspace } from '../../src/salto/workspace'
import { provideWorkspaceDefinition } from '../../src/salto/definitions'
import { getPositionContext } from '../../src/salto/context'
import { mockWorkspace } from './workspace'

// TODO: enable this
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('Test go to definitions', () => {
  let workspace: EditorWorkspace
  const bpFileName = 'all.bp'

  beforeAll(async () => {
    workspace = new EditorWorkspace(await mockWorkspace(
      `${__dirname}/../../../test/salto/test-bps/all.bp`
    ))
  })

  it('should give a single definition for a type that is defined once', async () => {
    const pos = { line: 40, col: 8 }
    const ctx = await getPositionContext(workspace, bpFileName, pos)
    const token = 'vs_num'

    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(13)
  })

  it('should give all definitions for a type that is extended', async () => {
    const pos = { line: 86, col: 6 }
    const ctx = await getPositionContext(workspace, bpFileName, pos)
    const token = 'vs_loan'
    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(2)
  })

  // TODO: enable this back
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('should give the field definition for an instance attr', async () => {
    const pos = { line: 89, col: 8 }
    const ctx = await getPositionContext(workspace, bpFileName, pos)
    const token = 'loaner'
    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(64)
  })

  it('should empty list for undefined type', async () => {
    const pos = { line: 74, col: 6 }
    const ctx = await getPositionContext(workspace, bpFileName, pos)
    const token = 'vs_nope'
    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(0)
  })
})
