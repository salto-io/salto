/*
*                      Copyright 2023 Salto Labs Ltd.
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
/* eslint-disable operator-linebreak */
import { merge } from '../src/index'

describe('merge', () => {
  describe('mergeDiffs', () => {
    const base =
`hello world!
this file is
this file is
it is
the base
of everything.
`
    const current =
`Hello World!
this file is
this file is
it is
the base
of everything
and beyond.
`
    it('should merge correctly', () => {
      const incoming =
`hello world!
this file is
this file is
not
the base.
it is
not
the base
of everything.
`
      const expected =
`Hello World!
this file is
this file is
not
the base.
it is
not
the base
of everything
and beyond.
`

      expect(merge.mergeDiffs({ current, base, incoming })).toEqual(expected)
    })
    it('should merge correctly when there is a false conflict', () => {
      const incoming =
`Hello World!
this file is
this file is
it is
not
the base
of everything.
`
      const expected =
`Hello World!
this file is
this file is
it is
not
the base
of everything
and beyond.
`

      expect(merge.mergeDiffs({ current, base, incoming })).toEqual(expected)
    })
    it('should merge correctly on deletions', () => {
      const incoming =
`hello world!
this file is
this file is
the base
of everything.
`
      const expected =
`Hello World!
this file is
this file is
the base
of everything
and beyond.
`
      expect(merge.mergeDiffs({ current, base, incoming })).toEqual(expected)
    })
    it('should merge correctly on addition in top/bottom', () => {
      const currentWithAdditions =
`-- title --
hello world!
this file is
this file is
it is
the base
of everything.
`
      const incomingWithAdditions =
`hello world!
this file is
this file is
it is
the base
of everything.
-- end --
`
      const expected =
`-- title --
hello world!
this file is
this file is
it is
the base
of everything.
-- end --
`
      expect(merge.mergeDiffs({ current: currentWithAdditions, base, incoming: incomingWithAdditions }))
        .toEqual(expected)
    })
    it('should return current when incoming equals base', () => {
      expect(merge.mergeDiffs({ current, base, incoming: base })).toEqual(current)
    })
    it('should return current when incoming equals current', () => {
      expect(merge.mergeDiffs({ current, base, incoming: current })).toEqual(current)
    })
    it('should return base when all equals', () => {
      expect(merge.mergeDiffs({ current: base, base, incoming: base })).toEqual(base)
    })
    it('should throw on conflict', () => {
      const incoming =
`hello world!
this file is
this file is
it is
not the base
of everything.
`

      expect(() => merge.mergeDiffs({ current, base, incoming })).toThrow(new merge.ConflictError({
        currentIndex: 4,
        current: [
          'the base',
          'of everything',
          'and beyond.',
        ],
        baseIndex: 4,
        base: [
          'the base',
          'of everything.',
        ],
        incomingIndex: 4,
        incoming: [
          'not the base',
          'of everything.',
        ],
      }))
    })
    it('should return merged with conflicts', () => {
      const incoming =
`hello world!
this file is
this file is
it is
not the base
of everything.
`
      const expected =
`Hello World!
this file is
this file is
it is
${'<<<<<<<'}
the base
of everything
and beyond.
${'|||||||'}
the base
of everything.
${'======='}
not the base
of everything.
${'>>>>>>>'}
`

      expect(merge.mergeDiffs({ current, base, incoming, allowConflicts: true })).toEqual(expected)
    })
    it('should return conflict on all when base is empty', () => {
      const expected =
`${'<<<<<<<'}
Hello World!
this file is
this file is
it is
the base
of everything
and beyond.
${'|||||||'}
${'======='}
hello world!
this file is
this file is
it is
the base
of everything.
${'>>>>>>>'}
`
      expect(merge.mergeDiffs({ current, base: '', incoming: base, allowConflicts: true })).toEqual(expected)
    })
  })
})
