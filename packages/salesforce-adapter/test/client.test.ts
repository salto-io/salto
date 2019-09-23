import createClient from './client'

describe('salesforce client', () => {
  it('print on failure', async () => {
    const { connection, client } = createClient()
    connection.query = jest.fn(() => Promise.reject(new Error('failure')))
    const error = jest.spyOn(console, 'error').mockImplementation(() => { })
    await expect(client.runQuery('blabla')).rejects.toThrow()
    expect(error.mock.calls).toHaveLength(1)
    expect(error.mock.calls[0][0]).toBe('failed')
  })
})
