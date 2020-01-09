import * as path from 'path'

import { file } from 'salto'
import { EditorWorkspace } from '../../src/salto/workspace'
import { getPositionContext } from '../../src/salto/context'
import { SaltoSymbolKind, createSaltoSymbol } from '../../src/salto/symbols'
import { mockWorkspace } from './workspace'

// TODO: enable this back
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('Cursor context resolver', () => {
  let workspace: EditorWorkspace
  let bpContent: string
  const filename = path.resolve(`${__dirname}/../../../test/salto/test-bps/all.bp`)
  beforeAll(async () => {
    workspace = new EditorWorkspace(await mockWorkspace(filename))
    bpContent = await file.readTextFile(filename)
  })

  it('should create type symbol', async () => {
    const pos = { line: 1, col: 4 }
    const ctx = await getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('str')
    expect(symbol.type).toBe(SaltoSymbolKind.Type)
  })

  it('should create annotation symbol', async () => {
    const pos = { line: 51, col: 10 }
    const ctx = await getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('label')
    expect(symbol.type).toBe(SaltoSymbolKind.Annotation)
  })

  it('should create field symbol', async () => {
    const pos = { line: 50, col: 10 }
    const ctx = await getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('model')
    expect(symbol.type).toBe(SaltoSymbolKind.Field)
  })

  it('should create instance symbol', async () => {
    const pos = { line: 87, col: 10 }
    const ctx = await getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('weekend_car')
    expect(symbol.type).toBe(SaltoSymbolKind.Instance)
  })

  it('should create attribute symbol', async () => {
    const pos = { line: 88, col: 10 }
    const ctx = await getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('reason')
    expect(symbol.type).toBe(SaltoSymbolKind.Attribute)
  })

  it('should create array symbol', async () => {
    const pos = { line: 134, col: 6 }
    const ctx = await getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('nicknames')
    expect(symbol.type).toBe(SaltoSymbolKind.Array)
  })

  it('should create array item symbol', async () => {
    const pos = { line: 134, col: 19 }
    const ctx = await getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('[0]')
    expect(symbol.type).toBe(SaltoSymbolKind.Attribute)
  })

  it('should create file symbol', async () => {
    const pos = { line: 130, col: 0 }
    const ctx = await getPositionContext(workspace, bpContent, filename, pos)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('global')
    expect(symbol.type).toBe(SaltoSymbolKind.File)
  })
})
