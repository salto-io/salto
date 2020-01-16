import * as path from 'path'
import { EditorWorkspace } from '../../src/salto/workspace'
import { provideWorkspaceReferences } from '../../src/salto/usage'
import { SaltoElemLocation } from '../../src/salto/location'
import { mockWorkspace } from './workspace'

describe('Test go to definitions', () => {
  let workspace: EditorWorkspace
  const filename = path.resolve(`${__dirname}/../../../test/salto/test-bps/all.bp`)

  const getRefLines = (
    defs: SaltoElemLocation[]
  ): number[] => defs.map(d => d.range.start.line).sort((a, b) => a - b)

  beforeAll(async () => {
    workspace = new EditorWorkspace(await mockWorkspace(filename))
  })

  it('should give all fields usages of a type', async () => {
    const token = 'vs_str'
    const defs = await provideWorkspaceReferences(workspace, token)
    expect(getRefLines(defs)).toEqual(
      [33, 37, 50, 67, 114, 126, 138, 141, 144, 147, 150, 153, 156, 159]
    )
  })

  it('should give all instance usages of a type', async () => {
    const token = 'vs_loan'
    const defs = await provideWorkspaceReferences(workspace, token)
    expect(getRefLines(defs)).toEqual([87, 107])
  })

  it('should give all instance AND field usages of a type', async () => {
    const token = 'vs_person'
    const defs = await provideWorkspaceReferences(workspace, token)
    expect(getRefLines(defs)).toEqual([47, 64, 75, 81, 131])
  })
})
