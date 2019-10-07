import _ from 'lodash'
import * as fs from 'async-file'

import { EditorWorkspace } from '../../src/salto/workspace'

describe('TEST', () => {
  const baseBPDir = `${__dirname}/../../../test/salto/BP`
  const extraBP = `${__dirname}/../../../test/salto/BP2/extra.bp`
  const errorBP = `${__dirname}/../../../test/salto/BP2/error.bp`

  it('should initiate a workspace', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [], false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(3)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(2)
  })

  it('should initiate a workspace with additional BPs', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [extraBP], false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
  })

  it('should collect validation errors', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [errorBP], false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
    expect(workspace.errors.length).toBe(1)
  })

  it('should update a single file', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [extraBP], false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
    workspace.setBlueprints({ filename: extraBP, buffer: '' })
    await workspace.awaitAllUpdates()
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(3)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
  })

  it('should maintain status on error', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [extraBP], false)
    const errorContent = await fs.readFile(errorBP)
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
    workspace.setBlueprints({ filename: extraBP, buffer: errorContent })
    await workspace.awaitAllUpdates()
    expect(workspace.elements).toBeDefined()
    expect(workspace.errors.length).toBe(1)
    expect(workspace.elements && workspace.elements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
  })

  it('should support file removal', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [extraBP], false)
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(4)
    workspace.removeBlueprints(extraBP)
    await workspace.awaitAllUpdates()
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(3)
  })

  it('should support file addition', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [], false)
    const extraContent = await fs.readFile(extraBP)
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(3)
    workspace.setBlueprints({ filename: extraBP, buffer: extraContent })
    await workspace.awaitAllUpdates()
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(4)
  })

  it('should return last valid state if there are errors', async () => {
    const workspace = await EditorWorkspace.load(baseBPDir, [extraBP], false)
    const errorContent = await fs.readFile(errorBP)
    expect(workspace.elements).toBeDefined()
    expect(workspace.elements && workspace.elements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
    const shouldBeCurrent = workspace.getValidCopy()
    expect(shouldBeCurrent).toEqual(workspace)
    workspace.setBlueprints({ filename: extraBP, buffer: errorContent })
    await workspace.awaitAllUpdates()
    expect(workspace.elements).toBeDefined()
    expect(workspace.errors.length).toBe(1)
    expect(workspace.elements && workspace.elements.length).toBe(4)
    expect(_.keys(workspace.parsedBlueprints).length).toBe(3)
    const lastValid = workspace.getValidCopy()
    if (!lastValid) throw new Error('lastValid not defined')
    expect(lastValid.errors.length).toBe(0)
    expect(lastValid).not.toEqual(workspace)
  })
})
