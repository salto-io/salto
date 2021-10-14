/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { EditorWorkspace } from '../src/workspace'
import { mockWorkspace } from './workspace'

const { awu } = collections.asynciterable
describe('workspace', () => {
  const workspaceBaseDir = path.resolve(`${__dirname}/../../test/test-nacls`)
  const naclFileName = path.join(workspaceBaseDir, 'all.nacl')
  const validate = async (workspace: EditorWorkspace, elements: number):
  Promise<void> => {
    const wsElements = await workspace.elements
    expect(wsElements && (await awu(await wsElements.getAll()).toArray()).length).toBe(elements)
  }
  it('should initiate a workspace', async () => {
    const workspace = new EditorWorkspace(workspaceBaseDir, await mockWorkspace([naclFileName]))
    await validate(workspace, 18)
  })

  it('should collect errors', async () => {
    const baseWs = await mockWorkspace([naclFileName])
    baseWs.hasErrors = jest.fn().mockResolvedValue(true)
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    expect(workspace.hasErrors()).toBeTruthy()
  })

  it('should update a single file', async () => {
    const baseWs = await mockWorkspace([naclFileName])
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    const filename = 'new'
    const buffer = 'test'
    await workspace.setNaclFiles({ filename, buffer })
    await workspace.awaitAllUpdates()
    expect((await workspace.getNaclFile(filename))?.buffer).toEqual(buffer)
  })

  it('should maintain status on error', async () => {
    const baseWs = await mockWorkspace([naclFileName])
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    baseWs.hasErrors = jest.fn().mockResolvedValue(true)
    await workspace.setNaclFiles({ filename: 'error', buffer: 'error content' })
    await workspace.awaitAllUpdates()
    expect(await workspace.elements).toBeDefined()
    expect(await workspace.hasErrors()).toBeTruthy()
    await validate(workspace, 18)
  })

  it('should support file removal', async () => {
    const baseWs = await mockWorkspace([naclFileName])
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    await workspace.removeNaclFiles(naclFileName)
    await workspace.awaitAllUpdates()
    expect(await workspace.getNaclFile(naclFileName)).toEqual(undefined)
  })

  it('should call workspace operation', async () => {
    const baseWs = await mockWorkspace([naclFileName])
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)

    const mockFunc = jest.fn().mockReturnValue(Promise.resolve('value'))
    expect(await workspace.runOperationWithWorkspace(mockFunc)).toBe('value')
    expect(mockFunc).toHaveBeenCalledWith(baseWs)
  })

  it('should not run two workspace opearations in parallel', async () => {
    const arr: string[] = []

    const firstOperation = async (): Promise<void> => {
      arr.push('first')
      await new Promise(resolve => setTimeout(resolve, 0))
      arr.push('first')
    }

    const secondOperation = async (): Promise<void> => {
      arr.push('second')
      await new Promise(resolve => setTimeout(resolve, 0))
      arr.push('second')
    }
    const workspace = new EditorWorkspace(workspaceBaseDir, await mockWorkspace([naclFileName]))
    const firstPromise = workspace.runOperationWithWorkspace(firstOperation)
    const secondPromise = workspace.runOperationWithWorkspace(secondOperation)

    await firstPromise
    await secondPromise

    expect(arr).toEqual(['first', 'first', 'second', 'second'])
  })
})
