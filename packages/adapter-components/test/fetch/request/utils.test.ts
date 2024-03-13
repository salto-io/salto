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
