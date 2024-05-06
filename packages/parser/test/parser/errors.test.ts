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

import { PrimitiveType, PrimitiveTypes, InstanceElement, ObjectType, ElemID } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { parse, ParseResult } from '../../src/parser'
import { IllegalReference } from '../../src/parser/internal/types'
import { MISSING_VALUE } from '../../src/parser/internal/native/consumers/values'

const { awu } = collections.asynciterable

describe('parsing errors', () => {
  describe('general element block structure', () => {
    describe('no labels', () => {
      const nacl = `
      {
        hes = "a real"
      }

      type nowhere.man {
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })

      it('should raise an error', () => {
        expect(res.errors).toHaveLength(2)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 7, col: 7, line: 2 },
          end: { byte: 8, col: 8, line: 2 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].summary).toBe('Expected block labels')
        expect(res.errors[0].message).toBe('Expected block labels, found { instead.')
        expect(res.errors[1].summary).toBe('Ambiguous block definition')
      })

      it('should continue parsing other blocks and ignore the unlabeled block', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        expect((await awu(res.elements).toArray())[0]).toEqual(new ObjectType({ elemID: new ElemID('nowhere', 'man') }))
      })
    })
    describe('no wrapper block', () => {
      const nacl = `
      this = [
        "is annoying"
      ]
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })

      it('should raise an error', () => {
        expect(res.errors).toHaveLength(4)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 12, col: 12, line: 2 },
          end: { byte: 13, col: 13, line: 2 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].summary).toBe('Expected {')
        expect(res.errors[0].message).toBe('Expected {')
        expect(res.errors[1].summary).toBe('Invalid block item')
        expect(res.errors[2].summary).toBe('Invalid block item')
        expect(res.errors[3].summary).toBe('Invalid block item')
      })
    })
  })

  describe('primitive type definition errors', () => {
    describe('invalid primitive type error', () => {
      describe('with unknown primitive type', () => {
        const nacl = `
            type helter.skelter is amazing {
            }
            `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should throw an error', () => {
          expect(res.errors[0].subject).toEqual({
            start: { byte: 13, col: 13, line: 2 },
            end: { byte: 43, col: 43, line: 2 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].message).toBe('Unknown primitive type amazing.')
          expect(res.errors[0].summary).toBe('unknown primitive type')
        })
        it('should use unknown type as the primitive type primitive', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as PrimitiveType
          expect(element.primitive).toBe(PrimitiveTypes.UNKNOWN)
        })
      })
      describe('with a missing primitive type', () => {
        const nacl = `
          type helter.skelter is {
          }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should create an error', async () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].message).toBe('Expected a primitive type definition.')
          expect(res.errors[0].summary).toBe('unknown primitive type')
          expect(await awu(res.elements).toArray()).toHaveLength(1)
        })
        it('should use unknown as the primitive type primitive', async () => {
          const element = (await awu(res.elements).toArray())[0] as PrimitiveType
          expect(element.primitive).toBe(PrimitiveTypes.UNKNOWN)
        })
      })
    })
    describe('invalid inheritance operator', () => {
      describe('with missing inheritance operator', () => {
        const nacl = `
        type helter.skelter tanananana {
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should create errors', async () => {
          expect(res.errors).toHaveLength(2)
          expect(res.errors[0].subject).toEqual({
            start: { byte: 9, col: 9, line: 2 },
            end: { byte: 39, col: 39, line: 2 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].message).toBe("Expected inheritance operator 'is' found tanananana instead")
          expect(res.errors[0].summary).toBe('invalid type definition')
          expect(res.errors[1].subject).toEqual({
            start: { byte: 9, col: 9, line: 2 },
            end: { byte: 39, col: 39, line: 2 },
            filename: 'file.nacl',
          })
          expect(res.errors[1].message).toBe('Expected a primitive type definition.')
          expect(res.errors[1].summary).toBe('unknown primitive type')
          expect(await awu(res.elements).toArray()).toHaveLength(1)
        })
        it('should use unknown as the primitive type', async () => {
          const element = (await awu(res.elements).toArray())[0] as PrimitiveType
          expect(element.primitive).toBe(PrimitiveTypes.UNKNOWN)
        })
      })
      describe('with invalid inheritance operator', () => {
        const nacl = `
          type helter.skelter tanananana string {
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should create an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { byte: 11, col: 11, line: 2 },
            end: { byte: 48, col: 48, line: 2 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].message).toBe("Expected inheritance operator 'is' found tanananana instead")
          expect(res.errors[0].summary).toBe('invalid type definition')
        })
        it('should still create the element', async () => {
          const element = (await awu(res.elements).toArray())[0] as PrimitiveType
          expect(element.primitive).toBe(PrimitiveTypes.STRING)
        })
      })
    })
    describe('invalid primitive type block structure', () => {
      describe('when fields are defined in the primitive type', () => {
        const nacl = `
          type helter.skelter is string {
              string tanananananana {

              }
          }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should create an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { byte: 41, col: 41, line: 2 },
            end: { byte: 109, col: 12, line: 6 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].message).toBe('Unexpected field definition(s) in a primitive type. Expected no fields.')
          expect(res.errors[0].summary).toBe('invalid fields in primitive type')
        })
        it('should create the element without the fields', async () => {
          const element = (await awu(res.elements).toArray())[0] as PrimitiveType
          expect(element.primitive).toBe(PrimitiveTypes.STRING)
          expect(element.elemID.getFullName()).toEqual('helter.skelter')
        })
      })
    })
  })
  describe('instance element definition errors', () => {
    describe('invalid instance element block structure', () => {
      const nacl = `
        rocky.racoon checked {
          into.his room {

          }
          only = "to find"
        }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should raise an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 30, col: 30, line: 2 },
          end: { byte: 107, col: 10, line: 7 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe(
          'Unexpected field or annotation type definition(s) in a primitive type. Expected only values.',
        )
        expect(res.errors[0].summary).toBe('invalid blocks in an instance')
      })
      it('should parse the rest of the instance correctly', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const inst = (await awu(res.elements).toArray())[0] as InstanceElement
        expect(inst.value).toEqual({ only: 'to find' })
      })
    })
  })
  describe('variable block definition errors', () => {
    describe('when there is no equal token', () => {
      describe('when there is only var name defined', () => {
        const nacl = `
          vars {
            lucy = "in the"
            sky
          }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 4, col: 13, byte: 58 },
            end: { line: 4, col: 16, byte: 61 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].message).toBe('Invalid variable definition')
          expect(res.errors[0].summary).toBe('Invalid variable definition')
        })
        it('should recover and parse other vars', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('var', 'lucy'))
        })
      })
      describe('when there are multiple tokens in the var def', () => {
        const nacl = `
          vars {
            lucy in = "the"
            sky = "with diamonds"
          }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 3, col: 13, byte: 30 },
            end: { line: 3, col: 20, byte: 37 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].message).toBe('Invalid variable definition')
          expect(res.errors[0].summary).toBe('Invalid variable definition')
        })
        it('should recover and parse other vars', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('var', 'sky'))
        })
      })
    })
    describe('when there is no var name', () => {
      const nacl = `
      vars {
        = "the"
        sky = "with diamonds"
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should show an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { line: 3, col: 9, byte: 22 },
          end: { line: 3, col: 9, byte: 22 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Invalid variable definition')
        expect(res.errors[0].summary).toBe('Invalid variable definition')
      })
      it('should recover and parse other vars', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('var', 'sky'))
      })
    })
    describe('when a block is defined instead of an attribute', () => {
      const nacl = `
      vars {
        lucy.in the {

        }
        sky = "with diamonds"
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should show an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { line: 3, col: 9, byte: 22 },
          end: { line: 3, col: 20, byte: 33 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Invalid variable definition')
        expect(res.errors[0].summary).toBe('Invalid variable definition')
      })
      it('should recover and parse other vars', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('var', 'sky'))
      })
    })
    describe('when there are consecutive invalid defs', () => {
      const nacl = `
      vars {
        lucy.in the {

        }
        sky with = "diamonds"
        ahhhhh = "ahhhhh"
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should show an error', () => {
        expect(res.errors).toHaveLength(2)
        expect(res.errors[0].subject).toEqual({
          start: { line: 3, col: 9, byte: 22 },
          end: { line: 3, col: 20, byte: 33 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].summary).toBe('Invalid variable definition')
        expect(res.errors[1].message).toBe('Invalid variable definition')
      })
      it('should recover and parse other items', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('var', 'ahhhhh'))
      })
    })
  })
  describe('block body definition errors', () => {
    describe('when there are nested fields', () => {
      const nacl = `
      type baby.you {
        can.drive my {
          car.yes imGonna {

          }
        }
      }
    `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should create an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 44, col: 22, line: 3 },
          end: { byte: 96, col: 10, line: 7 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Invalid nested block definition')
        expect(res.errors[0].summary).toBe('Invalid nested block definition')
      })
      it('should still create the element properly', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.elemID.getFullName()).toEqual('baby.you')
        expect(element.fields.my).toBeDefined()
      })
    })
    describe('when there are attributes in the annotation types block', () => {
      const nacl = `
      type baby.you {
          annotations {
            can.drive my {
            }
            car = "Yes"
          }
      }
    `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should create an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 100, col: 13, line: 6 },
          end: { byte: 111, col: 24, line: 6 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Invalid annotations block, unexpected attribute definition.')
        expect(res.errors[0].summary).toBe('Invalid annotations block')
      })
      it('should still create the element properly', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.elemID.getFullName()).toEqual('baby.you')
        expect(Object.keys(element.annotationRefTypes)).toEqual(['my'])
      })
    })
    describe('when there annotation values inside annotation type definitions', () => {
      const nacl = `
      type baby.you {
          annotations {
            can.drive my {
              car = "Yes"
            }
          }
      }
    `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should create an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 88, col: 15, line: 5 },
          end: { byte: 99, col: 26, line: 5 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Invalid annotations block, unexpected attribute definition.')
        expect(res.errors[0].summary).toBe('Invalid annotations block')
      })
      it('should still create the element properly', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.elemID.getFullName()).toEqual('baby.you')
        expect(Object.keys(element.annotationRefTypes)).toEqual(['my'])
      })
    })
    describe('when there are duplicated annotation type blocks', () => {
      const nacl = `
      type baby.you {
          annotations {
            can.drive my {
            }
          }
          annotations {
            car.yes Im {
            }
          }
      }
    `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should create an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 122, col: 23, line: 7 },
          end: { byte: 174, col: 12, line: 10 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe(
          'Invalid annotations block, only one annotation block can be defined in a fragment.',
        )
        expect(res.errors[0].summary).toBe('Invalid annotations block')
      })
      it('should use annotation for the all defined annotation types block', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.elemID.getFullName()).toEqual('baby.you')
        expect(Object.keys(element.annotationRefTypes)).toEqual(['my'])
      })
    })
    describe('when there are multiple definition of a field', () => {
      const nacl = `
      type baby.you {
        can.drive mycar {

        }
        yes.im mycar {

        }
      }
    `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should create an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 81, col: 22, line: 6 },
          end: { byte: 93, col: 10, line: 8 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe(
          'Duplicated field name mycar, a field can only be defined once in a source fragment.',
        )
        expect(res.errors[0].summary).toBe('Duplicated field name')
      })
      it('should use the first definition of the field', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.elemID.getFullName()).toEqual('baby.you')
        expect(element.fields.mycar.refType.elemID.getFullName()).toEqual('can.drive')
      })
    })
    describe('when there is a field with the name of a builtin function', () => {
      const nacl = `
      type baby.you {
        can.drive toString {

        }
      }
    `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should not create an error', () => {
        expect(res.errors).toHaveLength(0)
      })
    })
    describe('has a duplicated attribute', () => {
      const nacl = `
      type baby.you {
        candrive = "my car"
        candrive = "an automobile owned ny myself"
      }
    `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should create an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 59, col: 9, line: 4 },
          end: { byte: 101, col: 51, line: 4 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Duplicated attribute candrive')
        expect(res.errors[0].summary).toBe('Duplicated attribute')
      })
      it('should use the first definition of the field', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.elemID.getFullName()).toEqual('baby.you')
        expect(element.annotations.candrive).toEqual('my car')
      })
    })
    describe('invalid item definition', () => {
      describe('when a single label is used, and its not "annotations"', () => {
        const nacl = `
        type let.me {
          take {

          }
          take = "you"
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 3, col: 11, byte: 33 },
            end: { line: 3, col: 15, byte: 37 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].summary).toBe('Invalid block item')
          expect(res.errors[0].message).toBe('Invalid block item. Expected a new block or an attribute definition.')
        })
        it('should recover and parse other items', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('let', 'me'))
          expect((await awu(res.elements).toArray())[0].annotations.take).toEqual('you')
        })
      })
      describe('when more than two labels are used to define a block', () => {
        const nacl = `
        type let.me {
          take you down {

          }
          take = "you"
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 3, col: 11, byte: 33 },
            end: { line: 3, col: 24, byte: 46 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].summary).toBe('Invalid block item')
          expect(res.errors[0].message).toBe('Invalid block item. Expected a new block or an attribute definition.')
        })
        it('should recover and parse other items', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('let', 'me'))
          expect((await awu(res.elements).toArray())[0].annotations.take).toEqual('you')
        })
      })
      describe('when an attribute is defined without a key', () => {
        const nacl = `
        type let.me {
          = {
            let = "me"
          }
          take = "you"
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 3, col: 11, byte: 33 },
            end: { line: 3, col: 11, byte: 33 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].summary).toBe('Invalid block item')
          expect(res.errors[0].message).toBe('Invalid block item. Expected a new block or an attribute definition.')
        })
        it('should recover and parse other items', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('let', 'me'))
          expect((await awu(res.elements).toArray())[0].annotations.take).toEqual('you')
        })
      })
      describe('only 1 label (can be both attr or field def) are used', () => {
        const nacl = `
        type let.me {
          take
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 3, col: 11, byte: 33 },
            end: { line: 3, col: 15, byte: 37 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].summary).toBe('Invalid block item')
          expect(res.errors[0].message).toBe('Invalid block item. Expected a new block or an attribute definition.')
        })
        it('should recover and parse the block', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('let', 'me'))
        })
      })
      describe('more then 1 label is used', () => {
        const nacl = `
        type let.me {
          take you
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 3, col: 11, byte: 33 },
            end: { line: 3, col: 19, byte: 41 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].summary).toBe('Invalid block item')
          expect(res.errors[0].message).toBe('Invalid block item. Expected a new block or an attribute definition.')
        })
        it('should recover and parse the block', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          expect((await awu(res.elements).toArray())[0].elemID).toEqual(new ElemID('let', 'me'))
        })
      })
    })
  })
  describe('value definition errors', () => {
    describe('object definition errors', () => {
      describe('only key', () => {
        const nacl = `
        type penny.lane {
          is = {
            in = "my ears"
            and
          }
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 5, col: 16, byte: 86 },
            end: { line: 5, col: 16, byte: 86 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].message).toBe('Invalid attribute definition, expected an equal sign')
          expect(res.errors[0].summary).toBe('Invalid attribute definition')
        })
        it('should still parse the element, and create the object value without that key', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as ObjectType
          expect(element.elemID).toEqual(new ElemID('penny', 'lane'))
          expect(element.annotations.is).toEqual({ in: 'my ears' })
        })
      })
      describe('key with more then one label', () => {
        const nacl = `
        type penny.lane {
          is = {
            in = "my ears"
            and in my
          }
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 5, col: 13, byte: 83 },
            end: { line: 5, col: 22, byte: 92 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].message).toBe('Invalid attribute key')
          expect(res.errors[0].summary).toBe('Invalid attribute key')
        })
        it('should still parse the element, and create the object value without that key', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as ObjectType
          expect(element.elemID).toEqual(new ElemID('penny', 'lane'))
          expect(element.annotations.is).toEqual({ in: 'my ears' })
        })
      })
      describe('duplicated attribute key', () => {
        const nacl = `
        type penny.lane {
          is = {
            in = "my ears"
            in = "my eyes"
            there = "beneath the blue suburban sky"
          }
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 5, col: 13, byte: 83 },
            end: { line: 5, col: 15, byte: 85 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].message).toBe('Duplicated attribute in')
          expect(res.errors[0].summary).toBe('Duplicated attribute')
        })
        it('should still parse the element and use the first time the key was defined', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as ObjectType
          expect(element.elemID).toEqual(new ElemID('penny', 'lane'))
          expect(element.annotations.is).toEqual({ there: 'beneath the blue suburban sky', in: 'my ears' })
        })
      })
      describe('missing value', () => {
        const nacl = `
        type penny.lane {
          is = {
            in = "my ears"
            and =
            there = "beneath the blue suburban sky"
          }
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 5, col: 18, byte: 88 },
            end: { line: 5, col: 18, byte: 88 },
            filename: 'file.nacl',
          })

          expect(res.errors[0].message).toBe('Expected a value')
          expect(res.errors[0].summary).toBe('Expected a value')
        })
        it('parse the missing value as dynamic value', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as ObjectType
          expect(element.elemID).toEqual(new ElemID('penny', 'lane'))
          expect(element.annotations.is).toEqual({
            there: 'beneath the blue suburban sky',
            in: 'my ears',
            and: MISSING_VALUE,
          })
        })
      })
      describe('missing new line between values', () => {
        const nacl = `
        type penny.lane {
          is = {
            in = "my ears" and = "in my eyes"
            there = "beneath the blue suburban sky"
          }
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 4, col: 28, byte: 71 },
            end: { line: 4, col: 28, byte: 71 },
            filename: 'file.nacl',
          })

          expect(res.errors[0].message).toBe('Expected a new line')
          expect(res.errors[0].summary).toBe('Expected a new line')
        })
        it('parse the rest of the attributes', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as ObjectType
          expect(element.elemID).toEqual(new ElemID('penny', 'lane'))
          expect(element.annotations.is).toEqual({
            there: 'beneath the blue suburban sky',
            in: 'my ears',
          })
        })
      })
    })
    describe('array definition errors', () => {
      describe('when there is a missing comma', () => {
        const nacl = `
        type hey.jude {
          dont = ["dont", "make" "it", "bad"]
          take = "a sad song"
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 3, col: 34, byte: 58 },
            end: { line: 3, col: 35, byte: 59 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].summary).toBe('Expected a comma')
          expect(res.errors[0].message).toBe('Expected a comma or an array termination')
        })
        it('should recover and parse other items', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as ObjectType
          expect(element.annotations.take).toEqual('a sad song')
        })
        it('should parse the rest of the array item and replace the faulty item with missing value', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as ObjectType
          expect(element.annotations.dont).toEqual(['dont', 'make', 'bad'])
        })
      })
      describe('when there is a missing value between commas', () => {
        const nacl = `
        type hey.jude {
          dont = ["dont", "make", , "it", "bad"]
          take = "a sad song"
        }
        `
        let res: ParseResult
        beforeAll(async () => {
          res = await parse(Buffer.from(nacl), 'file.nacl', {})
        })
        it('should show an error', () => {
          expect(res.errors).toHaveLength(1)
          expect(res.errors[0].subject).toEqual({
            start: { line: 3, col: 35, byte: 59 },
            end: { line: 3, col: 35, byte: 59 },
            filename: 'file.nacl',
          })
          expect(res.errors[0].summary).toBe('Expected a value')
          expect(res.errors[0].message).toBe('Expected a value')
        })
        it('should recover and parse other items', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as ObjectType
          expect(element.annotations.take).toEqual('a sad song')
        })
        it('should parse all array items and add a missing value', async () => {
          expect(await awu(res.elements).toArray()).toHaveLength(1)
          const element = (await awu(res.elements).toArray())[0] as ObjectType
          expect(element.annotations.dont).toEqual(['dont', 'make', MISSING_VALUE, 'it', 'bad'])
        })
      })
    })
  })
  describe('string definition errors', () => {
    describe('when the string is not terminated', () => {
      const nacl = `
      type nowhere.man {
        sitting = "in his nowhere land
        making = "all his nowhere plans"
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should throw an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { line: 3, col: 19, byte: 44 },
          end: { line: 3, col: 39, byte: 64 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Unterminated string literal')
        expect(res.errors[0].summary).toBe('Unterminated string literal')
      })
      it('should parse items after the unterminated array', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.annotations.making).toEqual('all his nowhere plans')
      })
    })
    describe('when string templates are used in a non value string', () => {
      const nacl = `
      type "nowhere.\${man}" {
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should throw an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { line: 2, col: 21, byte: 21 },
          end: { line: 2, col: 27, byte: 27 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Invalid string template expression')
        expect(res.errors[0].summary).toBe('Invalid string template expression')
      })
      it('should treat the template as a regular part of the string', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        // eslint-disable-next-line no-template-curly-in-string
        expect(element.elemID.getFullName()).toEqual('nowhere.${man}')
      })
    })
    describe('when the string has invalid chars', () => {
      const nacl = `
      type nowhere.man {
        sitting = "in his \\. nowhere land"
        making = "all his nowhere plans"
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should throw an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { line: 3, col: 28, byte: 53 },
          end: { line: 3, col: 29, byte: 54 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Invalid string character')
        expect(res.errors[0].summary).toBe('Invalid string character')
      })
      it('should parse items after the unterminated array', async () => {
        expect(res.elements).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.annotations.making).toEqual('all his nowhere plans')
      })
    })
    describe('when the string is not terminated due to an escape char', () => {
      /* eslint-disable no-useless-escape */
      const nacl = `
      type nowhere.man {
        sitting = "in his no-where land\\\"
        making = "all his nowhere plans"
      }
      `
      /* eslint-enable no-useless-escape */
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should throw an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { line: 3, col: 19, byte: 44 },
          end: { line: 3, col: 42, byte: 67 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Unterminated string literal')
        expect(res.errors[0].summary).toBe('Unterminated string literal')
      })
      it('should parse items after the unterminated string', async () => {
        expect(res.elements).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.annotations.making).toEqual('all his nowhere plans')
      })
    })
  })
  describe('function definition errors', () => {
    describe('unknown function name', () => {
      const nacl = `
      type hello.do {
        you = wantToKnow("a", "secret")
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should throw an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { line: 3, col: 15, byte: 37 },
          end: { line: 3, col: 25, byte: 47 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Unknown function wantToKnow')
        expect(res.errors[0].summary).toBe('Unknown function')
      })
    })
    describe('missing comma between params', () => {
      const nacl = `
      type hello.do {
        you = wantToKnow("a" "secret")
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {
          wantToKnow: {
            dump: jest.fn(),
            parse: jest.fn(),
            isSerializedAsFunction: () => true,
          },
        })
      })
      it('should throw an error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { line: 3, col: 30, byte: 52 },
          end: { line: 3, col: 31, byte: 53 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].summary).toBe('Expected a comma')
        expect(res.errors[0].message).toBe('Expected a comma or an array termination')
      })
    })
  })
  describe('illegal references', () => {
    describe('illegal reference in a value', () => {
      const nacl = `
      type here.come {
        the = sun.it.is.all.right
      }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should not create errors', () => {
        expect(res.errors).toHaveLength(0)
      })
      it('should parse the reference as an invalid reference', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const element = (await awu(res.elements).toArray())[0] as ObjectType
        expect(element.annotations.the).toBeInstanceOf(IllegalReference)
      })
    })
  })
  describe('unexpected end of file', () => {
    const nacl = `
    type I.am {
      the = "eggman"
    }
    type kuku {
      catchu = {
    }
    `
    let res: ParseResult
    beforeAll(async () => {
      res = await parse(Buffer.from(nacl), 'walrus.nacl', {})
    })

    it('should throw an error', () => {
      expect(res.errors).toHaveLength(1)
      expect(res.errors[0].message).toEqual('Unexpected end of file')
      expect(res.errors[0].summary).toEqual('Unexpected end of file')
    })
    it('should return a result of all of the parsed elements before the unfinished element', async () => {
      expect(await awu(res.elements).toArray()).toHaveLength(1)
      expect((await awu(res.elements).toArray())[0].elemID.getFullName()).toEqual('I.am')
    })
  })
  describe('merge conflict errors', () => {
    describe('Unresolved merge conflict', () => {
      const nacl = `
        rocky.racoon checked {
          only = "us"
        }
        rocky.racoon checkedAgain {
          always = "remember"
<<<<<<< HEAD
          only = "to lose"
=======
          only = "to find"
>>>>>>>
        }}}}
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should raise only a conflict error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 130, col: 1, line: 7 },
          end: { byte: 130, col: 1, line: 7 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Unresolved merge conflict')
        expect(res.errors[0].summary).toBe('Unresolved merge conflict')
      })
      it('should parse the first instance correctly', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
        const inst = (await awu(res.elements).toArray())[0] as InstanceElement
        expect(inst.value).toEqual({ only: 'us' })
      })
    })

    describe("non closed conflict markers (lacking '>')", () => {
      const nacl = `
        rocky.racoon checked {
          only
        }
        rocky.racoon checked {
          always = "remember"
<<<<<<< HEAD
          only = "to lose"
=======
          only = "to find"
>>>>>>
        }
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should raise an invalidStringChar error', () => {
        expect(res.errors).toHaveLength(2)
        expect(res.errors[1].subject).toEqual({
          start: { byte: 118, col: 1, line: 7 },
          end: { byte: 118, col: 1, line: 7 },
          filename: 'file.nacl',
        })
        expect(res.errors[1].message).toBe('Invalid string character')
        expect(res.errors[1].summary).toBe('Invalid string character')
      })
      it('should parse the first instance correctly', async () => {
        expect(await awu(res.elements).toArray()).toHaveLength(1)
      })
    })

    describe('ignore conflicts inside multiline strings', () => {
      const nacl = `
        rocky.racoon checkedAgain {
          always = '''
            remember
<<<<<<<
            only = "to lose"
=======
            only = "to find"
>>>>>>>
'''
}
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should raise invalid block item error', () => {
        expect(res.errors).toHaveLength(0)
      })
    })

    describe('raise error for non-open conflict token', () => {
      const nacl = `
        rocky.racoon checkedAgain {
            only = "to lose"
=======
            what = "to find"
}
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should raise invalid block item error', () => {
        expect(res.errors).toHaveLength(1)
        expect(res.errors[0].subject).toEqual({
          start: { byte: 66, col: 1, line: 4 },
          end: { byte: 66, col: 1, line: 4 },
          filename: 'file.nacl',
        })
        expect(res.errors[0].message).toBe('Invalid block item. Expected a new block or an attribute definition.')
        expect(res.errors[0].summary).toBe('Invalid block item')
      })
    })

    describe('ignore error for non-open conflict token in multiline string', () => {
      const nacl = `
        rocky.racoon checkedAgain {
            only = '''
=======
'''
}
      `
      let res: ParseResult
      beforeAll(async () => {
        res = await parse(Buffer.from(nacl), 'file.nacl', {})
      })
      it('should have no errors', () => {
        expect(res.errors).toHaveLength(0)
      })
    })
  })
})
