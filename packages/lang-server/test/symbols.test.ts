/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as path from 'path'
import { collections } from '@salto-io/lowerdash'

import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { EditorWorkspace } from '../src/workspace'
import { getPositionContext, PositionContext, buildDefinitionsTree } from '../src/context'
import { SaltoSymbolKind, createSaltoSymbol } from '../src/symbols'
import { mockWorkspace } from './workspace'

const { awu } = collections.asynciterable
describe('Cursor context resolver', () => {
  let workspace: EditorWorkspace
  let definitionsTree: PositionContext
  let fullElementSource: ReadOnlyElementsSource | undefined
  const baseDir = path.resolve(`${__dirname}/../test/test-nacls`)
  const naclFilename = path.join(baseDir, 'all.nacl')
  beforeAll(async () => {
    workspace = new EditorWorkspace(baseDir, await mockWorkspace([naclFilename]))
    definitionsTree = buildDefinitionsTree(
      (await workspace.getNaclFile(naclFilename))?.buffer as string,
      await workspace.getSourceMap(naclFilename),
      await awu(await workspace.getElements(naclFilename)).toArray(),
    )
    fullElementSource = await workspace.getElementSourceOfPath(naclFilename)
  })

  it('should create type symbol', async () => {
    const pos = { line: 1, col: 4 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('str')
    expect(symbol.type).toBe(SaltoSymbolKind.Type)
  })

  it('should create annotation symbol', async () => {
    const pos = { line: 51, col: 10 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('label')
    expect(symbol.type).toBe(SaltoSymbolKind.Annotation)
  })

  it('should create field symbol', async () => {
    const pos = { line: 50, col: 10 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('model')
    expect(symbol.type).toBe(SaltoSymbolKind.Field)
  })

  it('should create instance symbol', async () => {
    const pos = { line: 87, col: 10 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('weekend_car')
    expect(symbol.type).toBe(SaltoSymbolKind.Instance)
  })

  it('should create attribute symbol', async () => {
    const pos = { line: 88, col: 10 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('reason')
    expect(symbol.type).toBe(SaltoSymbolKind.Attribute)
  })

  it('should create array symbol', async () => {
    const pos = { line: 139, col: 6 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('nicknames')
    expect(symbol.type).toBe(SaltoSymbolKind.Array)
  })

  it('should create array item symbol', async () => {
    const pos = { line: 139, col: 19 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('[0]')
    expect(symbol.type).toBe(SaltoSymbolKind.Attribute)
  })

  it('should create array item symbol for lit of list', async () => {
    const pos = { line: 140, col: 23 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('[0]')
    expect(symbol.type).toBe(SaltoSymbolKind.Attribute)
  })

  it('should create file symbol', async () => {
    const pos = { line: 135, col: 0 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('global')
    expect(symbol.type).toBe(SaltoSymbolKind.File)
  })

  it('should use the fullname as name if the fullname flag is set', async () => {
    const pos = { line: 87, col: 10 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx, true)
    expect(symbol.name).toBe('vs.loan.instance.weekend_car')
    expect(symbol.type).toBe(SaltoSymbolKind.Instance)
  })

  it('should return global as the name when the fullname flag is set and context is global', async () => {
    const pos = { line: 135, col: 0 }
    const ctx = await getPositionContext(naclFilename, pos, definitionsTree, fullElementSource)
    const symbol = createSaltoSymbol(ctx)
    expect(symbol.name).toBe('global')
    expect(symbol.type).toBe(SaltoSymbolKind.File)
  })
})
