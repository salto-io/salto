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
import path from 'path'
import each from 'jest-each'
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { EditorWorkspace } from '../src/workspace'
import { provideWorkspaceDefinition } from '../src/definitions'
import { getPositionContext, buildDefinitionsTree, PositionContext } from '../src/context'
import { mockWorkspace } from './workspace'

const { awu } = collections.asynciterable
// TODO: enable this
describe('Test go to definitions', () => {
  let workspace: EditorWorkspace
  let definitionsTree: PositionContext
  let fullElementSource: ReadOnlyElementsSource | undefined
  const baseDir = path.resolve(`${__dirname}/../test/test-nacls`)
  const naclFileName = path.join(baseDir, 'all.nacl')

  beforeAll(async () => {
    workspace = new EditorWorkspace(
      baseDir,
      await mockWorkspace([naclFileName], ['path/to/content', 'path/to/deep_content']),
    )
    definitionsTree = buildDefinitionsTree(
      (await workspace.getNaclFile(naclFileName))?.buffer as string,
      await workspace.getSourceMap(naclFileName),
      await awu(await workspace.getElements(naclFileName)).toArray(),
    )
    fullElementSource = await workspace.getElementSourceOfPath(naclFileName)
  })

  it('should give a single definition for a type that is defined once', async () => {
    const pos = { line: 40, col: 8 }
    const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const token = { value: 'vs.num', type: 'word' }

    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(13)
  })

  it('should give all definitions for a type that is extended', async () => {
    const pos = { line: 86, col: 6 }
    const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const token = { value: 'vs.loan', type: 'word' }
    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(2)
  })

  it('should give the field definition for an instance attr', async () => {
    const pos = { line: 89, col: 8 }
    const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const token = { value: 'loaner', type: 'word' }

    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(64)
  })

  it('should empty list for undefined type', async () => {
    const pos = { line: 74, col: 6 }
    const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const token = { value: 'vs.nope', type: 'word' }

    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(0)
  })

  it('should give annotation definition for annotation values', async () => {
    const pos = { line: 208, col: 8 }
    const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const token = { value: 'loan', type: 'word' }

    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(1)
    expect(defs[0].range.start.line).toBe(203)
  })

  describe('static files', () => {
    each([
      // ['', { line: 240, col: 27 }, 'path/to/content'],
      [' nested', { line: 242, col: 31 }, 'path/to/deep_content'],
    ]).it('should give a%s static file its definition', async (_text, pos, filepath) => {
      const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
      const token = { value: filepath, type: 'content' }

      const defs = await provideWorkspaceDefinition(workspace, ctx, token)
      expect(defs.length).toBe(1)
      expect(defs[0].filename).toBe(`full-${filepath}`)
    })
  })

  it('should give annotation type definition', async () => {
    const pos = { line: 172, col: 15 }
    const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const token = { value: 'vs.person', type: 'word' }

    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs.length).toBe(2)
    expect(defs[0].range.start.line).toBe(32)
    expect(defs[1].range.start.line).toBe(127)
  })

  it('should give list element type definition', async () => {
    const pos = { line: 128, col: 15 }
    const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const token = { value: 'List<vs.str>', type: 'content' }
    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs[0].range.start.line).toBe(1)
  })

  it('should give list of lists element type definition', async () => {
    const pos = { line: 128, col: 15 }
    const ctx = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const token = { value: 'List<List<vs.str>>', type: 'content' }
    const defs = await provideWorkspaceDefinition(workspace, ctx, token)
    expect(defs[0].range.start.line).toBe(1)
  })
})
