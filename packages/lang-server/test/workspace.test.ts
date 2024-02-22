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
import { validator } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { EditorWorkspace } from '../src/workspace'
import { mockWorkspace } from './workspace'

const { awu } = collections.asynciterable
describe('workspace', () => {
  const workspaceBaseDir = path.resolve(`${__dirname}/../test/test-nacls`)
  const naclFileName = path.join(workspaceBaseDir, 'all.nacl')
  const validation1FileName = path.join(workspaceBaseDir, 'validation1.nacl')
  const validation2FileName = path.join(workspaceBaseDir, 'validation2.nacl')
  const validation3FileName = path.join(workspaceBaseDir, 'validation3.nacl')
  const splitted1FileName = path.join(workspaceBaseDir, 'splitted1.nacl')
  const splitted2FileName = path.join(workspaceBaseDir, 'splitted2.nacl')
  const inactiveFileName = path.join(workspaceBaseDir, 'inactive', 'test.nacl')
  const validate = async (workspace: EditorWorkspace, elements: number): Promise<void> => {
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
    await workspace.setNaclFiles([{ filename, buffer }])
    await workspace.awaitAllUpdates()
    expect((await workspace.getNaclFile(filename))?.buffer).toEqual(buffer)
  })

  it('should maintain status on error', async () => {
    const baseWs = await mockWorkspace([naclFileName])
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    baseWs.hasErrors = jest.fn().mockResolvedValue(true)
    await workspace.setNaclFiles([{ filename: 'error', buffer: 'error content' }])
    await workspace.awaitAllUpdates()
    expect(await workspace.elements).toBeDefined()
    expect(await workspace.hasErrors()).toBeTruthy()
    await validate(workspace, 18)
  })

  it('should support file removal', async () => {
    const baseWs = await mockWorkspace([naclFileName])
    const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    await workspace.removeNaclFiles([naclFileName])
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
      await workspace.setNaclFiles([{ filename: validation1FileName, buffer }])
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
      await workspace.setNaclFiles([{ filename: validation2FileName, buffer }])
      await workspace.awaitAllUpdates()
      const newValidationErrors = (await workspace.errors()).validation
      expect(newValidationErrors).toHaveLength(3)
      newValidationErrors.forEach(ve => {
        expect(ve).toBeInstanceOf(validator.UnresolvedReferenceValidationError)
      })
    })

    it('should create a validation error for unresolved reference field', async () => {
      const baseWs = await mockWorkspace([validation1FileName, validation2FileName])
      const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      const currentValidationErrors = (await workspace.errors()).validation
      expect(currentValidationErrors).toHaveLength(1)
      expect(currentValidationErrors[0]).toBeInstanceOf(validator.InvalidValueTypeValidationError)
      const buffer = `
      vs.type inst {
        field = "4"
      }
      
      vs.type referenced {
      }
      
      vs.type referencedField {
      }
    
      `
      await workspace.setNaclFiles([{ filename: validation2FileName, buffer }])
      await workspace.awaitAllUpdates()
      const newValidationErrors = (await workspace.errors()).validation
      expect(newValidationErrors).toHaveLength(2)
      newValidationErrors.forEach(ve => {
        expect(ve).toBeInstanceOf(validator.UnresolvedReferenceValidationError)
      })
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
      await workspace.setNaclFiles([{ filename: validation2FileName, buffer }])
      await workspace.awaitAllUpdates()
      const newValidationErrors = (await workspace.errors()).validation
      expect(newValidationErrors).toHaveLength(3)
      newValidationErrors.forEach(ve => {
        expect(ve).toBeInstanceOf(validator.UnresolvedReferenceValidationError)
      })
    })
    it('should create new unresolved reference errors when there are already errors', async () => {
      const baseWs = await mockWorkspace([validation1FileName, validation2FileName])
      const workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      const currentValidationErrors = (await workspace.errors()).validation
      expect(currentValidationErrors).toHaveLength(1)
      expect(currentValidationErrors[0]).toBeInstanceOf(validator.InvalidValueTypeValidationError)
      const buffer = `
      vs.type inst {
        field = "4"
      }
      
      vs.type referenced {
      }
      `
      await workspace.setNaclFiles([{ filename: validation2FileName, buffer }])
      await workspace.awaitAllUpdates()
      const firstUpdateValidationErrors = (await workspace.errors()).validation
      expect(firstUpdateValidationErrors).toHaveLength(2)
      firstUpdateValidationErrors.forEach(ve => {
        expect(ve).toBeInstanceOf(validator.UnresolvedReferenceValidationError)
      })
      const newBuffer = `
      vs.type inst {
        field = "4"
      }
      `
      await workspace.setNaclFiles([{ filename: validation2FileName, buffer: newBuffer }])
      await workspace.awaitAllUpdates()
      const newValidationErrors = (await workspace.errors()).validation
      expect(newValidationErrors).toHaveLength(3)
      newValidationErrors.forEach(ve => {
        expect(ve).toBeInstanceOf(validator.UnresolvedReferenceValidationError)
      })
    })
  })

  describe('validate files', () => {
    let workspace: EditorWorkspace
    beforeEach(async () => {
      const baseWs = await mockWorkspace([validation3FileName, validation2FileName])
      workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      await workspace.errors()
      const buffer = `
      type vs.type {
        string field {}
      }
      `
      await workspace.setNaclFiles([{ filename: validation3FileName, buffer }])
      await workspace.awaitAllUpdates()
    })
    it('should validate specific files correctly', async () => {
      expect((await workspace.errors()).validation).toHaveLength(0)
      const newErrors = await workspace.validateFiles([validation2FileName])
      expect(newErrors.validation).toHaveLength(1)
      expect(await workspace.errors()).toEqual(newErrors)
    })

    it('should validate file with element with error correctly', async () => {
      const baseWs = await mockWorkspace([validation1FileName, validation2FileName])
      const newWorkspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      const currentErrors = (await newWorkspace.errors()).validation
      expect(currentErrors).toHaveLength(1)
      const buffer = `
        type vs.type {
          boolean field {}
        }
      `
      await newWorkspace.setNaclFiles([{ filename: validation1FileName, buffer }])
      await newWorkspace.awaitAllUpdates()
      const newErrors = await newWorkspace.validateFiles([validation2FileName])
      expect(newErrors.validation).toHaveLength(2)
      expect(await newWorkspace.errors()).toEqual(newErrors)
    })

    it('should calc all errors if wsErrors is undefiend', async () => {
      const baseWs = await mockWorkspace([validation1FileName, validation2FileName])
      const newWorkspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      const errors = await newWorkspace.validateFiles([validation1FileName])
      expect(errors.validation).toHaveLength(1)
      expect(errors.validation[0].elemID.getFullName()).toEqual('vs.type.instance.inst.field')
    })

    it('should validate all touched elements', async () => {
      const baseWs = await mockWorkspace([splitted1FileName, splitted2FileName])
      const newWorkspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      const errors = await newWorkspace.errors()
      expect(errors.validation).toHaveLength(0)
      const buffer = ''
      await newWorkspace.setNaclFiles([{ filename: splitted2FileName, buffer }])
      await newWorkspace.awaitAllUpdates()
      const newErrors = await newWorkspace.errors()
      expect(newErrors.validation).toHaveLength(1)
    })

    it('should not validate elements that are not already in the workspace', async () => {
      const baseWs = await mockWorkspace([splitted1FileName, splitted2FileName])
      const newWorkspace = new EditorWorkspace(workspaceBaseDir, baseWs)
      const errors = await newWorkspace.errors()
      expect(errors.validation).toHaveLength(0)
      const newErrors = await workspace.validateFiles([inactiveFileName])
      expect(newErrors.validation).toHaveLength(0)
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

  describe('getElementSourceOfPath', () => {
    let getElementSourceOfPathSpy: jest.SpyInstance
    let workspace: EditorWorkspace

    beforeEach(async () => {
      const baseWs = await mockWorkspace()
      getElementSourceOfPathSpy = jest.spyOn(baseWs, 'getElementSourceOfPath')
      workspace = new EditorWorkspace(workspaceBaseDir, baseWs)
    })

    it('should call the base workspace getElementSourceOfPath', async () => {
      await workspace.getElementSourceOfPath(path.join(workspaceBaseDir, 'salto.config', 'adapters', 'file'))
      expect(getElementSourceOfPathSpy).toHaveBeenCalledWith(path.join('salto.config', 'adapters', 'file'), false)
    })
  })
})
