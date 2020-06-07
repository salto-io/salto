/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { EditorWorkspace } from '../../src/salto/workspace'
import { provideWorkspaceReferences } from '../../src/salto/usage'
import { SaltoElemLocation } from '../../src/salto/location'
import { mockWorkspace } from './workspace'
import { getPositionContext, PositionContext, GLOBAL_RANGE } from '../../src/salto/context'

describe('Test go to definitions', () => {
  let workspace: EditorWorkspace

  const getRefLines = (
    defs: SaltoElemLocation[]
  ): number[] => defs.map(d => d.range.start.line).sort((a, b) => a - b)

  beforeAll(async () => {
    const baseDir = path.resolve(`${__dirname}/../../../test/salto/test-nacls/`)
    workspace = new EditorWorkspace(baseDir, await mockWorkspace(path.join(baseDir, 'all.nacl')))
  })

  it('should give all fields usages of a type', async () => {
    const token = 'vs.str'
    const pos = {
      line: 1,
      col: 8,
    }
    const context = await getPositionContext(workspace, 'all.nacl', pos)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual(
      [1, 33, 37, 50, 67, 114, 128, 131, 144, 147, 150, 153, 156, 159, 162, 165]
    )
  })

  it('should give all instance usages of a type', async () => {
    const token = 'vs.loan'
    const pos = {
      line: 60,
      col: 10,
    }
    const context = await getPositionContext(workspace, 'all.nacl', pos)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([60, 87, 107, 113, 151])
  })

  it('should give all instance AND field usages of a type', async () => {
    const token = 'vs.person'
    const pos = {
      line: 32,
      col: 11,
    }
    const context = await getPositionContext(workspace, 'all.nacl', pos)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([32, 47, 64, 75, 81, 127, 136, 193, 197])
  })

  it('should work on tokens which have no context element', async () => {
    const token = 'vs.person'
    const context: PositionContext = {
      range: GLOBAL_RANGE.range,
      type: 'global',
    }
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([32, 47, 64, 75, 81, 127, 136, 193, 197])
  })

  it('should give annotation attr usage for annotation def', async () => {
    const token = 'loan'
    const pos = {
      line: 203,
      col: 19,
    }
    const context = await getPositionContext(workspace, 'all.nacl', pos)
    const defs = await provideWorkspaceReferences(workspace, token, context)
    expect(getRefLines(defs)).toEqual([208])
  })
})
