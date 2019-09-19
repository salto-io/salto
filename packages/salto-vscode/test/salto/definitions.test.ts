import * as path from 'path'

import { initWorkspace, SaltoWorkspace } from '../../src/salto/workspace'
import { provideWorkspaceDefinition } from '../../src/salto/definitions'
import { getPositionContext } from '../../src/salto/context'

describe('Test go to definitions', () => {
  let workspace: SaltoWorkspace
  const baseBPDir = path.resolve(`${__dirname}/../../../test/salto/completionsBP`)
  const bpFile = path.resolve(`${baseBPDir}/all.bp`)

  beforeAll(async () => {
    workspace = await initWorkspace(baseBPDir)
  })

  it('should give a single definition for a type that is defined once', () => {
    const pos = { line: 74, col: 6 }
    const ctx = getPositionContext(workspace, bpFile, pos)
    const token = 'vs_person'
    const defs = provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(32)
  })

  it('should give all definitions for a type that is extended', () => {
    const pos = { line: 86, col: 6 }
    const ctx = getPositionContext(workspace, bpFile, pos)
    const token = 'vs_loan'
    const defs = provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(2)
  })

  it('should give the field definition for an instance attr', () => {
    const pos = { line: 88, col: 8 }
    const ctx = getPositionContext(workspace, bpFile, pos)
    const token = 'loaner'
    const defs = provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(64)
  })

  it('should empty list for undefined type', () => {
    const pos = { line: 74, col: 6 }
    const ctx = getPositionContext(workspace, bpFile, pos)
    const token = 'vs_nope'
    const defs = provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(0)
  })
})
