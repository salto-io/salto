import retryStrategies from '../../../src/retry/strategies'

describe('index', () => {
  describe('retryStrategies', () => {
    (Object.keys(retryStrategies) as (keyof typeof retryStrategies)[]).forEach(k => {
      describe(k, () => {
        it('creates a strategy', () => {
          const s = retryStrategies[k]()()()
          expect(['string', 'number']).toContain(typeof s)
        })
      })
    })
  })
})
