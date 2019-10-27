import {
  toHexColor, concat, normalizeNamespaceOrModule,
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

  describe('concat', () => {
    it('should use "." to append namespaces, so that glob matching will work', () => {
      expect(concat('abc', 'def')).toEqual('abc.def')
    })
  })

  describe('normalizeNamespaceOrModule', () => {
    describe('when a module is specified', () => {
      it('should return its name as a string, without the parent', () => {
        expect(normalizeNamespaceOrModule('parent', module))
          .toEqual('adapter-api/logging/internal/namespaces.test')
      })
    })

    describe('when a string is specified', () => {
      it('should return its name as a string, prefixed by the parent', () => {
        expect(normalizeNamespaceOrModule('parent', 'my-namespace')).toEqual('parent.my-namespace')
      })
    })
  })
})
