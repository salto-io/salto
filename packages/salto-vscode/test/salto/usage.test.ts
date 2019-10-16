import * as path from 'path'

import { EditorWorkspace } from '../../src/salto/workspace'
import { provideWorkspaceReferences } from '../../src/salto/usage'
import { SaltoElemLocation } from '../../src/salto/location'
import { Config } from 'salto'

describe('Test go to definitions', () => {
  const getConfig = (baseDir: string, additionalBlueprints: string[]): Config => ({
    baseDir, additionalBlueprints,stateLocation: path.join(baseBPDir, 'salto.config', 'state.bpc')
  })
  let workspace: EditorWorkspace
  const baseBPDir = path.resolve(`${__dirname}/../../../test/salto/completionsBP`)

  const getRefLines = (
    defs: SaltoElemLocation[]
  ): number[] => defs.map(d => d.range.start.line).sort((a, b) => a - b)

  beforeAll(async () => {
    workspace = await EditorWorkspace.load(getConfig(baseBPDir, []), false)
  })

  it('should give all fields usages of a type', () => {
    const token = 'vs_str'
    const defs = provideWorkspaceReferences(workspace, token)
    expect(getRefLines(defs)).toEqual(
      [33, 37, 50, 67, 114, 126, 138, 141, 144, 147, 150, 153, 156, 159]
    )
  })

  it('should give all instance usages of a type', () => {
    const token = 'vs_loan'
    const defs = provideWorkspaceReferences(workspace, token)
    expect(getRefLines(defs)).toEqual([87, 107])
  })

  it('should give all instance AND field usages of a type', () => {
    const token = 'vs_person'
    const defs = provideWorkspaceReferences(workspace, token)
    expect(getRefLines(defs)).toEqual([47, 64, 75, 81, 131])
  })
})
