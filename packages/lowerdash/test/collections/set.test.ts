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
import { update, intersection, difference, equals } from '../../src/collections/set'

describe('update', () => {
  let subject: Set<number | {}>

  describe('when called with a source', () => {
    const source = [{}, 12]

    beforeEach(() => {
      subject = new Set<number | {}>([13])
      update(subject, source)
    })

    it('should add the specified entries to the set', () => {
      expect(subject.has(source[0])).toBeTruthy()
      expect(subject.has(source[1])).toBeTruthy()
    })

    it('should leave the other entries in the set as is', () => {
      expect(subject.has(13)).toBeTruthy()
    })
  })
})

describe('intersection', () => {
  let result: Set<number>
  let s1: Set<number>
  let s2: Set<number>

  describe('when there are overlapping elements', () => {
    beforeEach(() => {
      s1 = new Set<number>([12, 13, 14, 15])
      s2 = new Set<number>([12, 15, 16])
      result = intersection(s1, s2)
    })

    describe('returned value', () => {
      it('should be a set', () => expect(result).toBeInstanceOf(Set))
      it('should not be the first arg', () => expect(result).not.toBe(s1))
      it('should not be the second arg', () => expect(result).not.toBe(s2))
      it('should contain the intersection', () => expect([...result.keys()]).toEqual([12, 15]))
    })
  })

  describe('when there are no overlapping elements', () => {
    beforeEach(() => {
      s1 = new Set<number>([12, 13, 14, 15])
      s2 = new Set<number>([16])
      result = intersection(s1, s2)
    })

    describe('returned value', () => {
      it('should be a set', () => expect(result).toBeInstanceOf(Set))
      it('should not be the first arg', () => expect(result).not.toBe(s1))
      it('should not be the second arg', () => expect(result).not.toBe(s2))
      it('should contain the intersection', () => expect([...result.keys()]).toEqual([]))
    })
  })
})

describe('difference', () => {
  let result: Set<number>
  let s1: Set<number>
  let s2: Set<number>

  describe('when there are different elements', () => {
    beforeEach(() => {
      s1 = new Set<number>([12, 13, 14, 15])
      s2 = new Set<number>([12, 15, 16])
      result = difference(s1, s2)
    })

    describe('returned value', () => {
      it('should be a set', () => expect(result).toBeInstanceOf(Set))
      it('should not be the first arg', () => expect(result).not.toBe(s1))
      it('should not be the second arg', () => expect(result).not.toBe(s2))
      it('should contain the difference', () => expect([...result.keys()]).toEqual([13, 14]))
    })
  })

  describe('when there are no different elements', () => {
    beforeEach(() => {
      s1 = new Set<number>([12, 13, 14, 15])
      s2 = new Set<number>(s1)
      result = difference(s1, s2)
    })

    describe('returned value', () => {
      it('should be a set', () => expect(result).toBeInstanceOf(Set))
      it('should not be the first arg', () => expect(result).not.toBe(s1))
      it('should not be the second arg', () => expect(result).not.toBe(s2))
      it('should contain the intersection', () => expect([...result.keys()]).toEqual([]))
    })
  })
})

describe('equals', () => {
  let result: boolean
  let s1: Set<number>
  let s2: Set<number>

  describe('when the sets are of the same size and there are different elements', () => {
    beforeEach(() => {
      s1 = new Set<number>([12, 13, 14, 15])
      s2 = new Set<number>([12, 13, 14, 16])
      result = equals(s1, s2)
    })

    it('should be false', () => expect(result).toBe(false))
  })

  describe('when the sets equal', () => {
    beforeEach(() => {
      s1 = new Set<number>([12, 13, 14, 15])
      s2 = new Set<number>(s1)
      result = equals(s1, s2)
    })

    it('should be true', () => expect(result).toBe(true))
  })

  describe('when sets are of a different size', () => {
    beforeEach(() => {
      s1 = new Set<number>([12, 13, 14, 15])
      s2 = new Set<number>([...s1, 17])
      result = equals(s1, s2)
    })

    it('should be false', () => expect(result).toBe(false))
  })
})
