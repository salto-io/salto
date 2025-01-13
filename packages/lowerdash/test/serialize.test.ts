/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { EOL } from 'os'
import { createStreamSerializer, getSerializedStream, StreamSerializer } from '../src/serialize'
import { awu } from '../src/collections/asynciterable'

describe('serialize', () => {
  let streamSerialized: StreamSerializer

  const inputs = [
    [],
    [[]],
    [undefined],
    [[''], ['']],
    [['abc'], ['def']],
    [[], ['def']],
    [[{}], [{}, {}]],
    [[{ a: { b: { c: 'd' } } }, [{ y: 'z' }]], [{}]],
    [[{}], [{}, {}], ['a', 'b', 3, undefined, null]],
    [['a', 'b'], { c: 'd' }, { e: 'f' }],
  ]

  const getSerializedStreamRes = async (items: unknown[]): Promise<string> =>
    (await awu(streamSerialized(items)).toArray()).join('')

  const fixUndefinedItem = (items: unknown[]): unknown[] => (items.length === 1 && items[0] === undefined ? [] : items)

  describe('getSerializedStream', () => {
    beforeEach(() => {
      streamSerialized = getSerializedStream
    })
    it('should match serialized strings', async () => {
      await awu(inputs).forEach(async items =>
        // eslint-disable-next-line no-restricted-syntax
        expect(await getSerializedStreamRes(items)).toEqual(JSON.stringify(fixUndefinedItem(items))),
      )
    })
  })

  describe('createStreamSerializer', () => {
    const chunkedLines = [
      [[]],
      [[[]]],
      [[undefined]],
      [[[''], ['']]],
      [[['abc']], [['def']]],
      [[[], ['def']]],
      [[[{}], [{}, {}]]],
      [[], [[{ a: { b: { c: 'd' } } }, [{ y: 'z' }]]], [[{}]]],
      [[[{}], [{}, {}]], [['a', 'b', 3, undefined, null]]],
      [[['a', 'b']], [{ c: 'd' }], [{ e: 'f' }]],
    ]

    describe('with max line length', () => {
      beforeEach(() => {
        streamSerialized = createStreamSerializer({ maxLineLength: 15 })
      })
      it('should match serialized strings', async () => {
        await awu(inputs).forEach(async (items, index) =>
          expect(await getSerializedStreamRes(items)).toEqual(
            // eslint-disable-next-line no-restricted-syntax
            chunkedLines[index].map(line => JSON.stringify(fixUndefinedItem(line))).join(EOL),
          ),
        )
      })
    })

    describe('wrap with key', () => {
      beforeEach(() => {
        streamSerialized = createStreamSerializer({ wrapWithKey: 'elements' })
      })
      it('should match serialized strings', async () => {
        await awu(inputs).forEach(async items =>
          // eslint-disable-next-line no-restricted-syntax
          expect(await getSerializedStreamRes(items)).toEqual(JSON.stringify({ elements: fixUndefinedItem(items) })),
        )
      })
    })

    describe('mixed', () => {
      beforeEach(() => {
        streamSerialized = createStreamSerializer({ maxLineLength: 28, wrapWithKey: 'elements' })
      })
      it('should match serialized strings', async () => {
        await awu(inputs).forEach(async (items, index) =>
          expect(await getSerializedStreamRes(items)).toEqual(
            // eslint-disable-next-line no-restricted-syntax
            chunkedLines[index].map(line => JSON.stringify({ elements: fixUndefinedItem(line) })).join(EOL),
          ),
        )
      })
    })
  })
})
