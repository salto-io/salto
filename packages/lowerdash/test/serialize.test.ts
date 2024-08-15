/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { getSerializedStream } from '../src/serialize'
import { awu } from '../src/collections/asynciterable'

describe('serialize', () => {
  describe('getSerializedStream', () => {
    const getSerializedStreamRes = async (items: (unknown[] | Record<string, unknown>)[]): Promise<string> =>
      (await awu(getSerializedStream(items)).toArray()).join('')
    it('should match serialized strings', async () => {
      await awu([
        [],
        [[]],
        [[''], ['']],
        [['abc'], ['def']],
        [[], ['def']],
        [[''], ['']],
        [['abc'], ['def']],
        [[], ['def']],
        [[{}], [{}, {}]],
        [[{ a: { b: { c: 'd' } } }, [{ y: 'z' }]], [{}]],
        [[{}], [{}, {}], ['a', 'b', 3, undefined, null]],
        [['a', 'b'], { c: 'd' }, { e: 'f' }],
        // eslint-disable-next-line no-restricted-syntax
      ]).forEach(async items => expect(await getSerializedStreamRes(items)).toEqual(JSON.stringify(items)))
    })
  })
})
