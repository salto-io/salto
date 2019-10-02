import _ from 'lodash'
import * as fs from 'async-file'

import { initWorkspace, updateFile, removeFile } from '../../src/salto/workspace'

describe('TEST', () => {
  const baseBPDir = `${__dirname}/../../../test/salto/BP`
  const extraBP = `${__dirname}/../../../test/salto/BP2/extra.bp`
  const errorBP = `${__dirname}/../../../test/salto/BP2/error.bp`

  it('should initiate a workspace', async () => {
    const workspace = await initWorkspace(baseBPDir)
    expect(workspace.mergedElements).toBeDefined()
    expect(workspace.mergedElements && workspace.mergedElements.length).toBe(3)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(2)
  })

  it('should initiate a workspace with additional BPs', async () => {
    const workspace = await initWorkspace(baseBPDir, [], [extraBP])
    expect(workspace.mergedElements).toBeDefined()
    expect(workspace.mergedElements && workspace.mergedElements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
  })

  it('should collect validation errors', async () => {
    const workspace = await initWorkspace(baseBPDir, [], [errorBP])
    expect(workspace.mergedElements).toBeDefined()
    expect(workspace.mergedElements && workspace.mergedElements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
    expect(workspace.generalErrors.length).toBe(1)
  })

  it('should update a single file', async () => {
    const workspace = await initWorkspace(baseBPDir, [], [extraBP])
    expect(workspace.mergedElements).toBeDefined()
    expect(workspace.mergedElements && workspace.mergedElements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
    const updatedWorkspace = await updateFile(workspace, extraBP, '')
    expect(updatedWorkspace.mergedElements).toBeDefined()
    expect(updatedWorkspace.mergedElements && updatedWorkspace.mergedElements.length).toBe(3)
    expect(_.keys(updatedWorkspace.parsedBlueprints).length).toBe(3)
  })

  it('should maintain status on error', async () => {
    const workspace = await initWorkspace(baseBPDir, [], [extraBP])
    const errorContent = await fs.readFile(errorBP)
    expect(workspace.mergedElements).toBeDefined()
    expect(workspace.mergedElements && workspace.mergedElements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
    const updatedWorkspace = await updateFile(workspace, extraBP, errorContent)
    expect(updatedWorkspace.mergedElements).toBeDefined()
    expect(updatedWorkspace.mergedElements && updatedWorkspace.mergedElements.length).toBe(4)
    expect(_.keys(updatedWorkspace.parsedBlueprints).length).toBe(3)
  })

  it('should support file removal', async () => {
    const workspace = await initWorkspace(baseBPDir, [], [extraBP])
    expect(workspace.mergedElements).toBeDefined()
    expect(workspace.mergedElements && workspace.mergedElements.length).toBe(4)
    const updatedWorkspace = await removeFile(workspace, extraBP)
    expect(updatedWorkspace.mergedElements).toBeDefined()
    expect(updatedWorkspace.mergedElements && updatedWorkspace.mergedElements.length).toBe(3)
  })

  it('should support file addition', async () => {
    const workspace = await initWorkspace(baseBPDir)
    const extraContent = await fs.readFile(extraBP)
    expect(workspace.mergedElements).toBeDefined()
    expect(workspace.mergedElements && workspace.mergedElements.length).toBe(3)
    const updatedWorkspace = await updateFile(workspace, extraBP, extraContent)
    expect(updatedWorkspace.mergedElements).toBeDefined()
    expect(updatedWorkspace.mergedElements && updatedWorkspace.mergedElements.length).toBe(4)
  })
})
