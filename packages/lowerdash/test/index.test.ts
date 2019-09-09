import * as lowerdash from '../src'

describe('index.ts', () => {
  it('should define the namespaces', () => {
    expect(lowerdash.collections).toBeDefined()
    expect(lowerdash.promises).toBeDefined()

    // test import of type SetId
    const t: lowerdash.collections.set.SetId = 1
    expect(t).toBe(1)
  })
})
