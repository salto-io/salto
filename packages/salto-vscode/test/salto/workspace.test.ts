import * as path from 'path'
import { EditorWorkspace } from '../../src/salto/workspace'
import { mockWorkspace } from './workspace'

describe('workspace', () => {
  const bpFileName = `${__dirname}/../../../test/salto/test-bps/all.bp`
  const validate = async (workspace: EditorWorkspace, elements: number):
  Promise<void> => {
    const wsElements = await workspace.elements
    expect(wsElements && wsElements.length).toBe(elements)
  }
  it('should initiate a workspace', async () => {
    const workspace = new EditorWorkspace(await mockWorkspace(bpFileName))
    await validate(workspace, 14)
  })

  it('should collect errors', async () => {
    const baseWs = await mockWorkspace(bpFileName)
    baseWs.hasErrors = jest.fn().mockReturnValue(true)
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
    baseWs.hasErrors = jest.fn().mockImplementation(() => true)
    workspace.setBlueprints({ filename: 'error', buffer: 'error content' })
    await workspace.awaitAllUpdates()
    expect(workspace.elements).toBeDefined()
    expect(workspace.hasErrors()).toBeTruthy()
    await validate(workspace, 14)
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
    baseWs.hasErrors = jest.fn().mockImplementation(() => false)
    const workspace = new EditorWorkspace(baseWs)
    const shouldBeCurrent = workspace.getValidCopy()
    if (!shouldBeCurrent) throw new Error('lastValid not defined')
    expect(shouldBeCurrent.elements).toEqual(workspace.elements)
    expect(shouldBeCurrent.errors).toEqual(workspace.errors)

    baseWs.hasErrors = jest.fn().mockImplementation(() => true)
    workspace.setBlueprints({ filename: 'error', buffer: 'error' })
    await workspace.awaitAllUpdates()
    expect(workspace.elements).toBeDefined()
    expect(workspace.hasErrors()).toBeTruthy()
    await validate(workspace, 14)
    const lastValid = workspace.getValidCopy()
    if (!lastValid) throw new Error('lastValid not defined')
    expect(lastValid).not.toEqual(workspace)
  })

  it('should not allow to update blueprints before all pending operations are done', async () => {
    const workspace = new EditorWorkspace(await mockWorkspace(bpFileName))
    workspace.setBlueprints({ filename: 'new', buffer: 'new content' })
    await expect(workspace.updateBlueprints()).rejects.toThrow()
  })
})
