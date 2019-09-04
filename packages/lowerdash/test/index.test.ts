import utils from '../src'

describe('index.ts', () => {
  it('should define the namespaces', () => {
    expect(utils.collections).toBeDefined()
    expect(utils.promises).toBeDefined()
  })
})
