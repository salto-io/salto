import * as path from 'path'
import { initWorkspace, SaltoWorkspace } from '../../src/salto/workspace'
import getPositionContext from '../../src/salto/context'

describe('Cursor context resolver', () => {
  let workspace: SaltoWorkspace
  const baseBPDir = path.resolve(`${__dirname}/../../../test/salto/contextBP`)
  const filename = path.resolve(`${baseBPDir}/all.bp`)
  beforeAll(async () => {
    workspace = await initWorkspace(baseBPDir)
  })

  describe('type', () => {
    it('should identify type definition', () => {
      const pos = { line: 1, col: 15 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('type')
      expect(ctx.part).toBe('definition')
    })

    it('should identify type body', () => {
      const pos = { line: 25, col: 1 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('type')
      expect(ctx.part).toBe('body')
    })

    // Mainly here so we will remember to change logic when elemID will reflect
    it('should identify annotations as type body', () => {
      const pos = { line: 4, col: 1 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('type')
      expect(ctx.part).toBe('body')
    })

    it('should identify type element', () => {
      const pos = { line: 4, col: 1 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('type')
      expect(ctx.part).toBe('body')
      expect(ctx.ref && ctx.ref.element.elemID.getFullName()).toBe('salto_str')
    })

    it('should identify field definition', () => {
      const pos = { line: 22, col: 15 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('field')
      expect(ctx.part).toBe('definition')
    })

    it('should identify field body', () => {
      const pos = { line: 23, col: 19 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('field')
      expect(ctx.part).toBe('body')
    })

    it('should identify field element', () => {
      const pos = { line: 23, col: 19 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('field')
      expect(ctx.part).toBe('body')
      expect(ctx.ref && ctx.ref.element.elemID.getFullName()).toBe('salto_complex_object')
    })
  })

  describe('instance', () => {
    it('should identify instance definition', () => {
      const pos = { line: 32, col: 17 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('instance')
      expect(ctx.part).toBe('definition')
    })

    it('should identify instance body', () => {
      const pos = { line: 33, col: 1 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('instance')
      expect(ctx.part).toBe('body')
    })

    it('should identify intance element', () => {
      const pos = { line: 33, col: 1 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('instance')
      expect(ctx.part).toBe('body')
      expect(ctx.ref && ctx.ref.element.elemID.getFullName()).toBe('salto_inst')
    })

    it('should identify instance path', () => {
      const pos = { line: 35, col: 18 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('instance')
      expect(ctx.part).toBe('body')
      expect(ctx.ref && ctx.ref.path).toBe('obj')
    })
  })

  describe('global', () => {
    it('should identify global context', () => {
      const pos = { line: 19, col: 1 }
      const ctx = getPositionContext(workspace, filename, pos)
      expect(ctx.type).toBe('global')
      expect(ctx.part).toBe('body')
    })
  })
})
