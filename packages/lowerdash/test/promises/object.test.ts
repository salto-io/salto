/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { mapValuesAsync, resolveValues, mapKeysAsync, pickAsync } from '../../src/promises/object'

describe('mapValuesAsync', () => {
  it('should map the values correctly', async () => {
    const result = await mapValuesAsync({ x: 12, y: 13 }, (v, k) => Promise.resolve(`${k}_${v}`))
    expect(result).toEqual({ x: 'x_12', y: 'y_13' })
  })
})

describe('resolveValues', () => {
  it('should resolve the values', async () => {
    const result = await resolveValues({ x: Promise.resolve(12), y: Promise.resolve(13) })
    expect(result).toEqual({ x: 12, y: 13 })
  })
})

describe('mapKeysAsync', () => {
  it('should map the keys according to the callback function', async () => {
    expect(await mapKeysAsync({ a: 'A', b: 'B', c: 'C' }, async val => val)).toEqual({ A: 'A', B: 'B', C: 'C' })
  })
})

describe('mapValueAsync', () => {
  it('should map the keys according to the callback function', async () => {
    expect(await mapValuesAsync({ a: 'A', b: 'B', c: 'C' }, async val => val + val)).toEqual({
      a: 'AA',
      b: 'BB',
      c: 'CC',
    })
  })
})

describe('pickAsync', () => {
  it('should pick the entries according to the callback function', async () => {
    expect(await pickAsync({ a: 'A', B: 'B', c: 'C' }, async (val, key) => val === key)).toEqual({ B: 'B' })
  })
})
