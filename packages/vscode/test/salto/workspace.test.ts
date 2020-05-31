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
  const workspaceBaseDir = path.resolve(`${__dirname}/../../../test/salto/test-nacls`)
  const naclFileName = path.join(workspaceBaseDir, 'all.nacl')
  const validate = async (workspace: EditorWorkspace, elements: number):
  Promise<void> => {
    const wsElements = await workspace.elements
    expect(wsElements && wsElements.length).toBe(elements)
  }
  it('should initiate a workspace', async () => {
    const workspace = new EditorWorkspace(workspaceBaseDir, await mockWorkspace(naclFileName))
    await validate(workspace, 17)
  })

  it('should collect errors', async () => {
    const baseWs = await mockWorkspace(naclFileName)
    baseWs.hasErrors = jest.fn().mockResolvedValue(true)
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    expect(workspace.hasErrors()).toBeTruthy()
  })

  it('should update a single file', async () => {
    const baseWs = await mockWorkspace(naclFileName)
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    workspace.setNaclFiles({ filename: 'new', buffer: '' })
    await workspace.awaitAllUpdates()
    expect((baseWs.setNaclFiles as jest.Mock).mock.calls[0][0].filename).toContain('new')
  })

  it('should maintain status on error', async () => {
    const baseWs = await mockWorkspace(naclFileName)
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    baseWs.hasErrors = jest.fn().mockResolvedValue(true)
    workspace.setNaclFiles({ filename: 'error', buffer: 'error content' })
    await workspace.awaitAllUpdates()
    expect(workspace.elements).toBeDefined()
    expect(workspace.hasErrors()).toBeTruthy()
    await validate(workspace, 17)
  })

  it('should support file removal', async () => {
    const baseWs = await mockWorkspace(naclFileName)
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    workspace.removeNaclFiles(path.basename(naclFileName))
    await workspace.awaitAllUpdates()
    const removeNaclFilesMock = baseWs.removeNaclFiles as jest.Mock
    expect(removeNaclFilesMock.mock.calls[0][0]).toContain('all.nacl')
  })

  // it('should return last valid state if there are errors', async () => {
  //   const baseWs = await mockWorkspace(naclFileName)
  //   baseWs.hasErrors = jest.fn().mockResolvedValue(false)
  //   const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
  //   const shouldBeCurrent = await workspace.getValidCopy()
  //   if (!shouldBeCurrent) throw new Error('lastValid not defined')
  //   expect([...(await shouldBeCurrent.errors()).all()])
  //     .toEqual([...(await workspace.errors()).all()])
  //   expect(await shouldBeCurrent.elements).toEqual(await workspace.elements)

  //   baseWs.hasErrors = jest.fn().mockResolvedValue(true)
  //   workspace.setNaclFiles({ filename: 'error', buffer: 'error' })
  //   await workspace.awaitAllUpdates()
  //   expect(await workspace.elements).toBeDefined()
  //   expect(workspace.hasErrors()).toBeTruthy()
  //   await validate(workspace, 17)
  //   const lastValid = workspace.getValidCopy()
  //   if (!lastValid) throw new Error('lastValid not defined')
  //   expect(lastValid).not.toEqual(workspace)
  // })

  it('should not allow to update Nacl files before all pending operations are done', async () => {
    const workspace = new EditorWorkspace(workspaceBaseDir, await mockWorkspace(naclFileName))
    workspace.setNaclFiles({ filename: 'new', buffer: 'new content' })
    await expect(workspace.updateNaclFiles([])).rejects.toThrow()
  })
})
