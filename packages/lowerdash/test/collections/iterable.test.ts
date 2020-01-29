import { SetId } from '../../src/collections/set'
import { groupBy } from '../../src/collections/iterable'

describe('groupBy', () => {
  let grouped: Map<SetId, number[]>
  beforeEach(() => {
    grouped = groupBy([1, 2, 3], num => num % 2)
  })
  it('should group elements according to the key function', () => {
    expect(grouped.get(0)).toEqual([2])
    expect(grouped.get(1)).toEqual([1, 3])
  })
})
