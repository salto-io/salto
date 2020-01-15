import { ElemID } from 'adapter-api'
import { EditorWorkspace } from '../../src/salto/workspace'
import { getPositionContext } from '../../src/salto/context'
import { mockWorkspace } from './workspace'

// TODO: should enable this
// eslint-disable-next-line jest/no-disabled-tests
describe.skip('Cursor context resolver', () => {
  let workspace: EditorWorkspace
  const bpFilename = 'context.bp'
  beforeAll(async () => {
    workspace = new EditorWorkspace(await mockWorkspace(
      `${__dirname}/../../../test/salto/test-bps/${bpFilename}`
    ))
  })

  describe('type', () => {
    it('should identify type definition', async () => {
      const pos = { line: 1, col: 15 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('type')
    })

    it('should identify type body', async () => {
      const pos = { line: 25, col: 1 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('type')
    })

    // Mainly here so we will remember to change logic when elemID will reflect
    it('should identify annotations as type body', async () => {
      const pos = { line: 4, col: 1 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('type')
    })

    it('should identify type element', async () => {
      const pos = { line: 4, col: 1 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('type')
      expect(ctx.ref && ctx.ref.element.elemID).toEqual(new ElemID('salto', 'str'))
    })

    it('should identify field definition', async () => {
      const pos = { line: 22, col: 15 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('field')
    })

    it('should identify field body', async () => {
      const pos = { line: 23, col: 19 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('field')
    })

    it('should identify field element', async () => {
      const pos = { line: 23, col: 19 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('field')

      expect(ctx.ref && ctx.ref.element.elemID).toEqual(new ElemID('salto', 'complex', 'field', 'object'))
    })
  })

  describe('instance', () => {
    it('should identify instance definition', async () => {
      const pos = { line: 32, col: 17 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('instance')
    })

    it('should identify instance body', async () => {
      const pos = { line: 33, col: 1 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('instance')
    })

    it('should identify instance element', async () => {
      const pos = { line: 33, col: 1 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('instance')
      expect(ctx.ref && ctx.ref.element.elemID).toEqual(new ElemID('salto', 'complex', 'instance', 'inst'))
    })

    it('should identify instance path', async () => {
      const pos = { line: 35, col: 18 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('instance')

      expect(ctx.ref && ctx.ref.path).toBe('obj')
    })

    it('should identify instance list', async () => {
      const pos = { line: 51, col: 12 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('instance')

      expect(ctx.ref && ctx.ref.isList).toBe(true)
      expect(ctx.ref && ctx.ref.path).toBe('arr')
    })
  })

  describe('global', () => {
    it('should identify global context', async () => {
      const pos = { line: 19, col: 1 }
      const ctx = await getPositionContext(workspace, bpFilename, pos)
      expect(ctx.type).toBe('global')
    })
  })
})
