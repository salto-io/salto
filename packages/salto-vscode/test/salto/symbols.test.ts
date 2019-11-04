import { promises as fsp } from 'fs'
import * as path from 'path'

import { Config } from 'salto'
import { EditorWorkspace } from '../../src/salto/workspace'
import { getPositionContext } from '../../src/salto/context'
import { SaltoSymbolKind, createSaltoSymbol } from '../../src/salto/symbols'

describe('Cursor context resolver', () => {
  const getConfig = (baseDir: string, additionalBlueprints: string[]): Config => ({
    baseDir,
    additionalBlueprints,
    stateLocation: path.join(baseDir, 'salto.config', 'state.bpc'),
    localStorage: '.',
    name: 'test',
    uid: '',
  })
  let workspace: EditorWorkspace
  let bpContent: string
  const baseBPDir = path.resolve(`${__dirname}/../../../test/salto/completionsBP`)
  const filename = path.resolve(`${baseBPDir}/all.bp`)
  beforeAll(async () => {
    workspace = await EditorWorkspace.load(getConfig(baseBPDir, []), false)
    bpContent = await fsp.readFile(filename, { encoding: 'utf8' })
  })

  it('should create type symbol', () => {
    const pos = { line: 1, col: 4 }
    const ctx = getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('vs_str')
    expect(symbol.type).toBe(SaltoSymbolKind.Type)
  })

  it('should create annotation symbol', () => {
    const pos = { line: 51, col: 10 }
    const ctx = getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('label')
    expect(symbol.type).toBe(SaltoSymbolKind.Annotation)
  })

  it('should create field symbol', () => {
    const pos = { line: 50, col: 10 }
    const ctx = getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('model')
    expect(symbol.type).toBe(SaltoSymbolKind.Field)
  })

  it('should create instance symbol', () => {
    const pos = { line: 87, col: 10 }
    const ctx = getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('vs_weekend_car')
    expect(symbol.type).toBe(SaltoSymbolKind.Instance)
  })

  it('should create attribute symbol', () => {
    const pos = { line: 88, col: 10 }
    const ctx = getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('reason')
    expect(symbol.type).toBe(SaltoSymbolKind.Attribute)
  })

  it('should create array symbol', () => {
    const pos = { line: 134, col: 6 }
    const ctx = getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('nicknames')
    expect(symbol.type).toBe(SaltoSymbolKind.Array)
  })

  it('should create array item symbol', () => {
    const pos = { line: 134, col: 19 }
    const ctx = getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('[0]')
    expect(symbol.type).toBe(SaltoSymbolKind.Attribute)
  })

  it('should create file symbol', () => {
    const pos = { line: 130, col: 0 }
    const ctx = getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('global')
    expect(symbol.type).toBe(SaltoSymbolKind.File)
  })
})
