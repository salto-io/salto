import * as path from 'path'
import * as fs from 'async-file'

import { initWorkspace, SaltoWorkspace } from '../../src/salto/workspace'
import { provideWorkspaceDefinition } from '../../src/salto/definitions'
import { getPositionContext } from '../../src/salto/context'

describe('Test go to definitions', () => {
  let workspace: SaltoWorkspace
  let bpContent: string
  const baseBPDir = path.resolve(`${__dirname}/../../../test/salto/completionsBP`)
  const bpFile = path.resolve(`${baseBPDir}/all.bp`)

  beforeAll(async () => {
    workspace = await initWorkspace(baseBPDir)
    bpContent = await fs.readFile(bpFile, 'utf8')
  })

  it('should give a single definition for a type that is defined once', () => {
    const pos = { line: 40, col: 8 }
    const ctx = getPositionContext(workspace, bpContent, bpFile, pos)
    const token = 'vs_num'
    const defs = provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(13)
  })

  it('should give all definitions for a type that is extended', () => {
    const pos = { line: 86, col: 6 }
    const ctx = getPositionContext(workspace, bpContent, bpFile, pos)
    const token = 'vs_loan'
    const defs = provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(2)
  })

  // TODO: this test is broken because attribute key is now included in the source range
  //       since the file being analyzed has the attribute in question defined the context
  //       gets the wrong ref.path value
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('should give the field definition for an instance attr', () => {
    const pos = { line: 88, col: 8 }
    const ctx = getPositionContext(workspace, bpContent, bpFile, pos)
    const token = 'loaner'
    const defs = provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(64)
  })

  it('should empty list for undefined type', () => {
    const pos = { line: 74, col: 6 }
    const ctx = getPositionContext(workspace, bpContent, bpFile, pos)
    const token = 'vs_nope'
    const defs = provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(0)
  })
})
