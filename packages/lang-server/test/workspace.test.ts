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
import { validator } from '@salto-io/workspace'
import { EditorWorkspace } from '../src/workspace'
import { mockWorkspace } from './workspace'

describe('workspace', () => {
  const workspaceBaseDir = path.resolve(`${__dirname}/../../test/test-nacls`)
  const naclFileName = path.join(workspaceBaseDir, 'all.nacl')
  const validation1FileName = path.join(workspaceBaseDir, 'validation1.nacl')
  const validation2FileName = path.join(workspaceBaseDir, 'validation2.nacl')
  const validate = async (workspace: EditorWorkspace, elements: number):
  Promise<void> => {
    const wsElements = await workspace.elements
    expect(wsElements && wsElements.length).toBe(elements)
  }
  it('should initiate a workspace', async () => {
    const workspace = new EditorWorkspace(workspaceBaseDir, await mockWorkspace([naclFileName]))
    await validate(workspace, 20)
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
    workspace.setNaclFiles({ filename, buffer })
    await workspace.awaitAllUpdates()
    expect((await workspace.getNaclFile(filename))?.buffer).toEqual(buffer)
  })

  it('should maintain status on error', async () => {
    const baseWs = await mockWorkspace([naclFileName])
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    baseWs.hasErrors = jest.fn().mockResolvedValue(true)
    workspace.setNaclFiles({ filename: 'error', buffer: 'error content' })
    await workspace.awaitAllUpdates()
    expect(workspace.elements).toBeDefined()
    expect(workspace.hasErrors()).toBeTruthy()
    await validate(workspace, 20)
  })

  it('should support file removal', async () => {
    const baseWs = await mockWorkspace([naclFileName])
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    workspace.removeNaclFiles(naclFileName)
    await workspace.awaitAllUpdates()
    expect(await workspace.getNaclFile(naclFileName)).toEqual(undefined)
  })

  describe('error iterative calculation', () => {
    it('should fix old validation errors', async () => {
      const baseWs = await mockWorkspace([validation1FileName, validation2FileName])
      const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      expect((await workspace.errors()).validation).toHaveLength(1)
      const buffer = `
      type vs.type {
        number field {}
      }
      
      vs.type withReference {
          _parent = vs.type.instance.referenced
      }
      `
      workspace.setNaclFiles({ filename: validation1FileName, buffer })
      await workspace.awaitAllUpdates()
      expect((await workspace.errors()).validation).toHaveLength(0)
    })
    it('should create a validation error for unresolved reference', async () => {
      const baseWs = await mockWorkspace([validation1FileName, validation2FileName])
      const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      const currentValidationErrors = (await workspace.errors()).validation
      expect(currentValidationErrors).toHaveLength(1)
      expect(currentValidationErrors[0]).toBeInstanceOf(validator.InvalidValueTypeValidationError)
      const buffer = `
      vs.type inst {
        field = "4"
      }
      
      vs.type oldReferenced {
      }
      `
      workspace.setNaclFiles({ filename: validation2FileName, buffer })
      await workspace.awaitAllUpdates()
      const newValidationErrors = (await workspace.errors()).validation
      expect(newValidationErrors).toHaveLength(1)
      expect(newValidationErrors[0]).toBeInstanceOf(validator.UnresolvedReferenceValidationError)
    })
    it('should have a validation error for unresolved reference even if errors was never called', async () => {
      const baseWs = await mockWorkspace([validation1FileName, validation2FileName])
      const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      const buffer = `
      vs.type inst {
        field = "4"
      }
      
      vs.type oldReferenced {
      }
      `
      workspace.setNaclFiles({ filename: validation2FileName, buffer })
      await workspace.awaitAllUpdates()
      const newValidationErrors = (await workspace.errors()).validation
      expect(newValidationErrors).toHaveLength(1)
      expect(newValidationErrors[0]).toBeInstanceOf(validator.UnresolvedReferenceValidationError)
    })
  })

  it('should call workspace opearation', async () => {
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
