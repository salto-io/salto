import { firstFunc } from '../src/main'

describe('Test example', () => {
  beforeAll(async () => {
    firstFunc()
  })

  it('should pass', () => {
    expect(true).toBeTruthy()
  })
})
