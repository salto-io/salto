import * as path from 'path'
import * as fs from 'async-file'

import { Config } from 'salto'
import { EditorWorkspace } from '../../src/salto/workspace'
import { getPositionContext } from '../../src/salto/context'

describe('Cursor context resolver', () => {
  const getConfig = (baseDir: string, additionalBlueprints: string[]): Config => ({
    baseDir,
    additionalBlueprints,
    stateLocation: path.join(baseDir, 'salto.config', 'state.bpc'),
    localStorage: '.',
    name: 'test',
  })
  let workspace: EditorWorkspace
  const baseBPDir = path.resolve(`${__dirname}/../../../test/salto/contextBP`)
  const filename = path.resolve(`${baseBPDir}/all.bp`)
  let bpContent: string
  beforeAll(async () => {
    workspace = await EditorWorkspace.load(getConfig(baseBPDir, []), false)
    bpContent = await fs.readFile(filename, 'utf8')
  })

  describe('type', () => {
    it('should identify type definition', () => {
      const pos = { line: 1, col: 15 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('type')
    })

    it('should identify type body', () => {
      const pos = { line: 25, col: 1 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('type')
    })

    // Mainly here so we will remember to change logic when elemID will reflect
    it('should identify annotations as type body', () => {
      const pos = { line: 4, col: 1 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('type')
    })

    it('should identify type element', () => {
      const pos = { line: 4, col: 1 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('type')

      expect(ctx.ref && ctx.ref.element.elemID.getFullName()).toBe('salto_str')
    })

    it('should identify field definition', () => {
      const pos = { line: 22, col: 15 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('field')
    })

    it('should identify field body', () => {
      const pos = { line: 23, col: 19 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('field')
    })

    it('should identify field element', () => {
      const pos = { line: 23, col: 19 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('field')

      expect(ctx.ref && ctx.ref.element.elemID.getFullName()).toBe('salto_complex_object')
    })
  })

  describe('instance', () => {
    it('should identify instance definition', () => {
      const pos = { line: 32, col: 17 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('instance')
    })

    it('should identify instance body', () => {
      const pos = { line: 33, col: 1 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('instance')
    })

    it('should identify intance element', () => {
      const pos = { line: 33, col: 1 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('instance')

      expect(ctx.ref && ctx.ref.element.elemID.getFullName()).toBe('salto_inst')
    })

    it('should identify instance path', () => {
      const pos = { line: 35, col: 18 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('instance')

      expect(ctx.ref && ctx.ref.path).toBe('obj')
    })

    // TODO: this test is broken because attribute key is now included in the source range
    //       since the file being analyzed has the attribute in question defined the context
    //       gets the wrong ref.path value
    // eslint-disable-next-line jest/no-disabled-tests
    it('should identify instance list', () => {
      const pos = { line: 51, col: 12 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('instance')

      expect(ctx.ref && ctx.ref.isList).toBe(true)
      expect(ctx.ref && ctx.ref.path).toBe('arr')
    })
  })

  describe('global', () => {
    it('should identify global context', () => {
      const pos = { line: 19, col: 1 }
      const ctx = getPositionContext(workspace, bpContent, filename, pos)
      expect(ctx.type).toBe('global')
    })
  })
})
