/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  findAllUnresolvedArgs,
  findUnresolvedArgs,
  replaceAllArgs,
  replaceArgs,
} from '../../../src/fetch/request/utils'

describe('request utils', () => {
  describe('findUnresolvedArgs', () => {
    it('should find all args', () => {
      expect(findUnresolvedArgs('a{b}c{d123} {e} {')).toEqual(['b', 'd123', 'e'])
    })
    it('should ignore provided args', () => {
      expect(findUnresolvedArgs('a{b}c{d123} {e} {', new Set(['e']))).toEqual(['b', 'd123'])
    })
  })

  describe('findAllUnresolvedArgs', () => {
    it('should find all args', () => {
      expect(findAllUnresolvedArgs('a{b}c{d123} {e} {')).toEqual(['b', 'd123', 'e'])
      expect(findAllUnresolvedArgs({ x: { y: 'a{b}c{d123} {e} {' } })).toEqual(['b', 'd123', 'e'])
      expect(findAllUnresolvedArgs({ x: { y: ['a{b}c{d123} {e} {'] } })).toEqual(['b', 'd123', 'e'])
    })
    it('should ignore provided args', () => {
      expect(findAllUnresolvedArgs({ x: { y: ['a{b}c{d123} {e} {'] } }, new Set(['e']))).toEqual(['b', 'd123'])
    })
  })

  describe('replaceArgs', () => {
    it('should replace found args and keep the rest', () => {
      expect(replaceArgs('a{b}c{d123} {e} {', { e: 'E' })).toEqual('a{b}c{d123} E {')
    })
    it('should replace nested values', () => {
      expect(replaceArgs('a{b}c{d123} {e.nested} {', { e: { nested: 'E' } })).toEqual('a{b}c{d123} E {')
    })
  })

  describe('replaceAllArgs', () => {
    it('should replace found args and keep the rest', () => {
      expect(replaceAllArgs({ value: { x: { y: 'a{b}c{d123} {e} {' } }, context: { e: 'E' } })).toEqual({
        x: { y: 'a{b}c{d123} E {' },
      })
      expect(replaceAllArgs({ value: { x: { y: ['a{b}c{d123} {e} {'] } }, context: { e: 'E' } })).toEqual({
        x: { y: ['a{b}c{d123} E {'] },
      })
    })
  })
})
