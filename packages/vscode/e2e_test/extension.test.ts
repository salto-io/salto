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
import readdirp from 'readdirp'
import tmp from 'tmp-promise'
import { SALTO_HOME_VAR, initLocalWorkspace } from '@salto-io/core'
import { copyFile, rm, mkdirp } from '@salto-io/file'
import { workspace as ws, context, provider, diagnostics, definitions } from '@salto-io/lang-server'
import { collections } from '@salto-io/lowerdash'

const { awu } = collections.asynciterable

// TODO: enable this back - tests fails
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('extension e2e', () => {
  const wsNaclFiles = `${__dirname}/../../e2e_test/test-workspace`
  let workspace: ws.EditorWorkspace
  let wsPath: string
  let homePath: string

  beforeAll(async () => {
    homePath = tmp.dirSync().name
    process.env[SALTO_HOME_VAR] = homePath

    wsPath = tmp.dirSync().name
    await mkdirp(wsPath)
    const naclFiles = await readdirp.promise(wsNaclFiles, {
      fileFilter: '*.nacl',
      directoryFilter: e => e.basename[0] !== '.',
    })
    await awu(naclFiles).forEach(async naclFile => {
      await copyFile(naclFile.fullPath, `${wsPath}/${naclFile.basename}`)
    })

    workspace = new ws.EditorWorkspace(wsPath, await initLocalWorkspace(wsPath, 'default'))
  })

  afterAll(async () => {
    await rm(wsPath)
    await rm(homePath)
  })

  it('should suggest type and instances completions', async () => {
    const pos = { line: 10, col: 0 }
    const filename = 'extra.nacl'
    const definitionsTree = context.buildDefinitionsTree(
      (await workspace.getNaclFile(filename))?.buffer as string,
      await workspace.getSourceMap(filename),
      await awu(await workspace.getElements(filename)).toArray(),
    )
    const fullElementSource = await workspace.getElementSourceOfPath(filename)
    const ctx = await context.getPositionContext(filename, pos, definitionsTree, fullElementSource)
    const suggestions = await provider.provideWorkspaceCompletionItems(workspace, ctx, '', pos)
    expect(suggestions.map(s => s.label).sort()).toEqual([
      'boolean',
      'number',
      '@salto-io/core',
      '@salto-io/core_complex',
      '@salto-io/core_complex2',
      '@salto-io/core_num',
      '@salto-io/core_number',
      '@salto-io/core_obj',
      '@salto-io/core_str',
      '@salto-io/core_string',
      'serviceid',
      'string',
      'type',
    ])
  })

  it('should diagnostics on errors', async () => {
    const diag = (await diagnostics.getDiagnostics(workspace)).errors
    const err = diag['error.nacl'][0]
    expect(err.msg).toContain('Error merging @salto-io/core.complex.instance.inst1: duplicate key str')
    expect(err.severity).toBe('Error')
    const warn = diag['error.nacl'][2]
    expect(warn.msg).toContain('Invalid value type for @salto-io/core.number')
    expect(warn.severity).toBe('Warning')
  })

  it('should give a single definition for a type that is defined in multiple files', async () => {
    const pos = { line: 6, col: 9 }
    const filename = 'extra.nacl'
    const definitionsTree = context.buildDefinitionsTree(
      (await workspace.getNaclFile(filename))?.buffer as string,
      await workspace.getSourceMap(filename),
      await awu(await workspace.getElements(filename)).toArray(),
    )
    const fullElementSource = await workspace.getElementSourceOfPath(filename)
    const ctx = await context.getPositionContext(filename, pos, definitionsTree, fullElementSource)
    const defs = await definitions.provideWorkspaceDefinition(workspace, ctx, {
      value: '@salto-io/core_complex',
      type: 'word',
    })
    expect(defs.length).toBe(2)
    expect(defs[0].fullname).toBe('@salto-io/core.complex')
    expect(defs[0].filename).toBe('complex_type.nacl')
    expect(defs[0].range.start.line).toBe(1)
    expect(defs[0].range.start.col).toBe(1)
    expect(defs[0].range.end.line).toBe(9)
    expect(defs[0].range.end.col).toBe(2)
    expect(defs[1].fullname).toBe('@salto-io/core.complex')
    expect(defs[1].filename).toBe('context.nacl')
    expect(defs[1].range.start.line).toBe(18)
    expect(defs[1].range.start.col).toBe(1)
    expect(defs[1].range.end.line).toBe(20)
    expect(defs[1].range.end.col).toBe(2)
  })

  // def from multiples files
})
