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
import { ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { EditorWorkspace } from '../src/workspace'
import { provideWorkspaceReferences } from '../src/usage'
import { SaltoElemLocation } from '../src/location'
import { mockWorkspace } from './workspace'
import { getPositionContext, PositionContext, GLOBAL_RANGE, buildDefinitionsTree } from '../src/context'

const { awu } = collections.asynciterable

describe('Test go to definitions', () => {
  let workspace: EditorWorkspace
  let definitionsTree: PositionContext
  let fullElementSource: ReadOnlyElementsSource | undefined
  const getRefLines = (defs: SaltoElemLocation[]): number[] => defs.map(d => d.range.start.line).sort((a, b) => a - b)

  const baseDir = path.resolve(`${__dirname}/../test/test-nacls/`)
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

  it('should give all fields usages of a type', async () => {
    const token = { value: 'vs.str', type: 'word' }
    const pos = {
      line: 1,
      col: 8,
    }
    const context = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([1, 33, 37, 50, 67, 114, 128, 131, 144, 147, 150, 153, 156, 159, 162, 165])
  })

  it('should give all instance and annotationType usages of a type', async () => {
    const token = { value: 'vs.loan', type: 'word' }
    const pos = {
      line: 60,
      col: 10,
    }
    const context = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([60, 87, 107, 113, 151, 203])
  })

  it('should give all instance, field and annotationType usages of a type', async () => {
    const token = { value: 'vs.person', type: 'word' }
    const pos = {
      line: 32,
      col: 11,
    }
    const context = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([32, 47, 64, 75, 81, 127, 136, 172, 193, 197])
  })

  it('should work on tokens which have no context element', async () => {
    const token = { value: 'vs.person', type: 'word' }
    const context: PositionContext = {
      range: GLOBAL_RANGE.range,
      type: 'global',
    }
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([32, 47, 64, 75, 81, 127, 136, 172, 193, 197])
  })

  it('should give annotation attr usage for annotation def', async () => {
    const token = { value: 'loan', type: 'word' }
    const pos = {
      line: 203,
      col: 19,
    }
    const context = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([208])
  })

  // TODO: There is a bug that prevents us from add a reference from instance to it's type.
  //  Once we fix this bug, we should unskip this test.
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('should find (goto) refrences of a nested (salto) references', async () => {
    const token = { value: 'reason', type: 'word' }
    const pos = {
      line: 67,
      col: 14,
    }
    const context = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([67, 88, 151, 209])
  })

  it('should find (salto) references to nested type annotations', async () => {
    const token = { value: 'first_name', type: 'word' }
    const pos = {
      line: 178,
      col: 13,
    }
    const context = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([178, 226])
  })

  it('should find (salto) references to nested field annotations', async () => {
    const token = { value: 'first_name', type: 'word' }
    const pos = {
      line: 187,
      col: 23,
    }
    const context = await getPositionContext(naclFileName, pos, definitionsTree, fullElementSource)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([166, 187])
  })
})
