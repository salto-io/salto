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
import { mockWorkspace } from './workspace'

describe('workspace', () => {
  const bpFileName = `${__dirname}/../../../test/salto/test-bps/all.bp`
  const validate = async (workspace: EditorWorkspace, elements: number):
  Promise<void> => {
    const wsElements = await workspace.workspace.elements
    expect(wsElements && wsElements.length).toBe(elements)
  }
  it('should initiate a workspace', async () => {
    const workspace = new EditorWorkspace(await mockWorkspace(bpFileName))
    await validate(workspace, 15)
  })

  it('should collect errors', async () => {
    const baseWs = await mockWorkspace(bpFileName)
    baseWs.hasErrors = jest.fn().mockResolvedValue(true)
    const workspace = new EditorWorkspace(baseWs)
    expect(workspace.hasErrors()).toBeTruthy()
  })

  it('should update a single file', async () => {
    const baseWs = await mockWorkspace(bpFileName)
    const workspace = new EditorWorkspace(baseWs)
    workspace.setBlueprints({ filename: 'new', buffer: '' })
    await workspace.awaitAllUpdates()
    expect((baseWs.setBlueprints as jest.Mock).mock.calls[0][0].filename).toBe('new')
  })

  it('should maintain status on error', async () => {
    const baseWs = await mockWorkspace(bpFileName)
    const workspace = new EditorWorkspace(baseWs)
    baseWs.hasErrors = jest.fn().mockResolvedValue(true)
    workspace.setBlueprints({ filename: 'error', buffer: 'error content' })
    await workspace.awaitAllUpdates()
    expect(workspace.workspace.elements).toBeDefined()
    expect(workspace.hasErrors()).toBeTruthy()
    await validate(workspace, 15)
  })

  it('should support file removal', async () => {
    const baseWs = await mockWorkspace(bpFileName)
    const workspace = new EditorWorkspace(baseWs)
    workspace.removeBlueprints(path.basename(bpFileName))
    await workspace.awaitAllUpdates()
    const removeBlueprintsMock = baseWs.removeBlueprints as jest.Mock
    expect(removeBlueprintsMock.mock.calls[0][0]).toBe('all.bp')
  })

  it('should return last valid state if there are errors', async () => {
    const baseWs = await mockWorkspace(bpFileName)
    baseWs.hasErrors = jest.fn().mockResolvedValue(false)
    const workspace = new EditorWorkspace(baseWs)
    const shouldBeCurrent = await workspace.getValidCopy()
    if (!shouldBeCurrent) throw new Error('lastValid not defined')
    expect(await shouldBeCurrent.workspace.elements).toEqual(await workspace.workspace.elements)
    expect(await shouldBeCurrent.workspace.errors).toEqual(await workspace.workspace.errors)

    baseWs.hasErrors = jest.fn().mockResolvedValue(true)
    workspace.setBlueprints({ filename: 'error', buffer: 'error' })
    await workspace.awaitAllUpdates()
    expect(await workspace.workspace.elements).toBeDefined()
    expect(workspace.hasErrors()).toBeTruthy()
    await validate(workspace, 15)
    const lastValid = workspace.getValidCopy()
    if (!lastValid) throw new Error('lastValid not defined')
    expect(lastValid).not.toEqual(workspace)
  })

  it('should not allow to update blueprints before all pending operations are done', async () => {
    const workspace = new EditorWorkspace(await mockWorkspace(bpFileName))
    workspace.setBlueprints({ filename: 'new', buffer: 'new content' })
    await expect(workspace.updateBlueprints([])).rejects.toThrow()
  })
})
