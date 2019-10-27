import {
  toHexColor, normalizeNamespaceOrModule,
} from '../../../src/logging/internal/namespaces'

describe('namespaces', () => {
  describe('toHexColor', () => {
    'my.namespace MY.namespace MYOTHERNAMESPACE'.split(' ').forEach(namespace => {
      it('should return the same color to each namespace on multiple invocations', () => {
        expect(toHexColor(namespace)).toEqual(toHexColor(namespace))
      })

      it('should return a hex color format', () => {
        expect(toHexColor(namespace)).toMatch(/#[0-9a-fA-F]{6}/)
      })
    })
  })

  describe('normalizeNamespaceOrModule', () => {
    describe('when a module is specified', () => {
      it('should return its name as a string', () => {
        expect(normalizeNamespaceOrModule(module))
          .toEqual('adapter-api/test/logging/internal/namespaces.test')
      })
    })

    describe('when a string is specified', () => {
      it('should return its name as a string', () => {
        expect(normalizeNamespaceOrModule('my-namespace')).toEqual('my-namespace')
      })
    })
  })
})
