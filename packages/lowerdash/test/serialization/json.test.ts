/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { serialization } from '../../src'
import { DuplicatePrototypeName, DuplicatePrototypeValue } from '../../src/serialization'

const { jsonSerializer, UnknownPrototypeError } = serialization
type JsonSerializer = serialization.JsonSerializer

describe('jsonSerializer', () => {
  describe('prototype reviving', () => {
    class Base {
      base = 'base value'
    }

    class Derived extends Base {
      derived = 'derived value'
    }

    type HasPrototype = { prototype: object }

    const classes: [HasPrototype, string][] = [
      [Base, 'Base'],
      [Derived, 'Derived'],
    ]

    const protoToName: [object, string][] = classes
      .map(([cls, name]) => [cls.prototype, name])

    type RootType = [Base, Derived, { x: 12; y: Derived }, 17]
    let root: RootType

    beforeEach(() => {
      root = [new Base(), new Derived(), { x: 12, y: new Derived() }, 17]
    })

    const serializer = jsonSerializer({ knownPrototypes: protoToName })

    describe('roundtrip - prototype encode and decode', () => {
      let parsed: typeof root
      beforeEach(() => {
        const s = serializer.stringify([...root])
        parsed = serializer.parse(s) as typeof parsed
      })

      it('should be an exact copy of the input', () => {
        expect(parsed).toEqual(root)
      })

      it('should restore the prototypes', () => {
        const [b, d, { y }] = parsed
        expect(b).toBeInstanceOf(Base)
        expect(b.base).toEqual('base value')
        expect(d).toBeInstanceOf(Base)
        expect(d.base).toEqual('base value')
        expect(d.derived).toEqual('derived value')
        expect(d).toBeInstanceOf(Derived)
        expect(y).toBeInstanceOf(Derived)
      })
    })

    describe('when given a missing prototype map', () => {
      let s: string
      let serializer2: JsonSerializer
      beforeEach(() => {
        s = serializer.stringify([...root])
        serializer2 = jsonSerializer({
          knownPrototypes: protoToName.filter(([_p, name]) => name !== 'Base'),
        })
      })

      const shouldThrow = (): void => { serializer2.parse(s) }

      it('should throw', () => {
        expect(shouldThrow).toThrow(UnknownPrototypeError)
      })

      describe('the thrown error', () => {
        let error: serialization.UnknownPrototypeError
        beforeEach(() => {
          try {
            shouldThrow()
          } catch (e) {
            error = e
          }
          expect(error).toBeDefined()
        })

        it('should contain informational props', () => {
          expect(error.prototypeName).toEqual('Base')
          expect(error.refPaths).toEqual(['0'])
        })

        it('should contain an informational message', () => {
          expect(error.message).toMatch(/Unknown prototype "Base" at paths: \[/)
        })
      })
    })

    describe('when parse is given a duplicate prototype name', () => {
      let s: string
      let serializer2: JsonSerializer
      let specifiedKnownPrototypes: [object, string][]
      beforeEach(() => {
        s = serializer.stringify([...root])
        specifiedKnownPrototypes = [...protoToName, [{}, protoToName[0][1]]]
        serializer2 = jsonSerializer({
          knownPrototypes: specifiedKnownPrototypes,
        })
      })

      const shouldThrow = (): void => { serializer2.parse(s) }

      it('should throw', () => {
        expect(shouldThrow).toThrow(DuplicatePrototypeName)
      })

      describe('the thrown error', () => {
        let error: serialization.DuplicatePrototypeName
        beforeEach(() => {
          try {
            shouldThrow()
          } catch (e) {
            error = e
          }
          expect(error).toBeDefined()
        })

        it('should contain informational props', () => {
          expect(error.knownPrototypes).toEqual(specifiedKnownPrototypes)
        })

        it('should contain an informational message', () => {
          expect(error.message).toMatch(/Duplicate name in list of known prototypes: \[/)
        })
      })
    })

    describe('when stringify is given a duplicate prototype', () => {
      let serializer2: JsonSerializer
      let specifiedKnownPrototypes: [object, string][]
      beforeEach(() => {
        specifiedKnownPrototypes = [...protoToName, [protoToName[0][0], 'x']]
        serializer2 = jsonSerializer({
          knownPrototypes: specifiedKnownPrototypes,
        })
      })

      const shouldThrow = (): void => { serializer2.stringify([...root]) }

      it('should throw', () => {
        expect(shouldThrow).toThrow(DuplicatePrototypeValue)
      })

      describe('the thrown error', () => {
        let error: serialization.DuplicatePrototypeValue
        beforeEach(() => {
          try {
            shouldThrow()
          } catch (e) {
            error = e
          }
          expect(error).toBeDefined()
        })

        it('should contain informational props', () => {
          expect(error.knownPrototypes).toEqual(specifiedKnownPrototypes)
        })

        it('should contain an informational message', () => {
          expect(error.message).toMatch(/Duplicate prototype in list of known prototypes: \[/)
        })
      })
    })
  })

  describe('refs', () => {
    const o1 = { x: 12, y: 13 }
    const o2 = { x: 14, y: 15 }

    const serializer = jsonSerializer()

    const testRoundtrip = (description: string, rootFactory: () => unknown): void => {
      test(`when given ${description}`, () => {
        const root = rootFactory()
        const s = serializer.stringify(root)
        const parsed = serializer.parse(s)
        expect(parsed).toEqual(root)
      })
    }

    testRoundtrip('a single scalar', () => 12)

    testRoundtrip('no duplicate refs', () => {
      const el1 = { o1 }
      const el2 = { o2, z: 16 }
      return [el1, el2]
    })

    testRoundtrip('nulls', () => {
      const el1 = { o1 }
      const el2 = { o2, z: 16, null1: null, listWithNull: ['a', null] }
      return [el1, el2, null]
    })

    testRoundtrip('a duplicate ref', () => {
      const el1 = { o1 }
      const el2 = { o1, o2, z: 16 }
      return [el1, el2]
    })

    testRoundtrip('a deep duplicate ref', () => {
      const el1 = { o1 }
      const el2 = { foo: { bar: { baz: o1 } }, o2, z: 16 }
      return [el1, el2]
    })

    testRoundtrip('a circular ref', () => {
      const el1 = { o1 }
      const el2 = { o1, o2, z: 16 }
      Object.assign(el1, { el2 })
      Object.assign(el2, { el1 })
      return [el1, el2]
    })

    testRoundtrip('a duplicate ref whose name contains a dot', () => {
      const nameWithDot = 'name.dot'
      const el1 = { [nameWithDot]: o1 }
      const el2 = { [nameWithDot]: o1, o2, z: 16 }
      return [el1, el2]
    })

    test('circular refs', () => {
      const el1 = { o1: { ...o1 } as Record<string, unknown> }
      el1.o1.parent = el1
      const root = [el1]
      const s = serializer.stringify(root, undefined, 4)
      const parsed = serializer.parse(s) as typeof root
      expect(parsed[0].o1.parent).toBe(parsed[0])
    })

    describe('when a custom replacer is specified', () => {
      const el1 = { o1 }
      const el2 = { o1, o2, z: 16 }
      const el3 = { o1, o2, z: 16 }
      const root = [el1, el2, el3]

      function customReplacer(this: unknown, k: string, v: unknown): unknown {
        if (this === el2 && k === 'o1' && v === o1) {
          return 17
        }
        return v
      }

      let parsed: unknown

      beforeEach(() => {
        const s = serializer.stringify(root, customReplacer)
        parsed = serializer.parse(s)
      })

      it('should call it correctly', () => {
        expect(parsed).toEqual([
          el1,
          { o1: 17, o2, z: 16 },
          el3,
        ])
      })
    })

    describe('when a custom reviver is specified', () => {
      const el1 = { el1o1: o1 }
      const el2 = { el2o1: o1, el2o2: o2, el2z: 16 }
      const el3 = { el3o1: { ...o1 } as Record<string, unknown>, el3o2: o2, el3z: 16 }
      el3.el3o1.parent = el3
      const root = [el1, el2, el3]
      const calls: [unknown, unknown, unknown][] = []

      function customReviver(this: unknown, k: string, v: unknown): unknown {
        calls.push([this, k, v])
        if (k === 'el1o1') {
          expect(this).toEqual({ el1o1: o1 })
          expect(v).toEqual(o1)
          return ['a', 'b']
        }
        if (k === 'el3z') {
          const expectedThis = { el3o1: { ...o1 } as Record<string, unknown>, el3o2: o2, el3z: 16 }
          expectedThis.el3o1.parent = expectedThis
          expect(this).toEqual(expectedThis)
          expect(v).toEqual(16)
          return undefined
        }
        if (v === 'b') {
          throw new Error('should not have called with "b"')
        }
        return v
      }

      let parsed: unknown

      beforeEach(() => {
        const s = serializer.stringify(root)
        parsed = serializer.parse(s, customReviver)
      })

      it('should call it correctly', () => {
        expect(calls).toMatchSnapshot()
      })

      it('should modify the result', () => {
        expect(parsed).toMatchSnapshot()
      })
    })
  })
})
