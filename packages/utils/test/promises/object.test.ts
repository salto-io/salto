import { mapValuesAsync, resolveValues } from '../../src/promises/object'

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
