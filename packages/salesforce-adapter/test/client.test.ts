import { ensureSuccessfulRun } from '../src/client/client'

describe('salesforce client', () => {
  it('ensureSuccessfulRun', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => { })

    const wrapedPromise = ensureSuccessfulRun(new Promise((_resolve, reject) =>
      reject(new Error())), 'failed')

    await expect(wrapedPromise).rejects.toBeDefined()
    expect(error.mock.calls).toHaveLength(1)
    expect(error.mock.calls[0][0]).toBe('failed')
  })
})
