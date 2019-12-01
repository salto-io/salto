import { firstFunc } from '../src/main'

describe('Test example', () => {
  beforeAll(async () => {
    const resp = await firstFunc()
    expect(resp).toMatchObject({})
  })

  it('should pass', () => {
    expect(true).toBeTruthy()
  })
})
