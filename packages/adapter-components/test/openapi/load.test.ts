/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { loadSwagger } from '../../src/openapi/load'

class ErrorWithStatus extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}
const mockBundle = jest.fn()

jest.mock('@apidevtools/swagger-parser', () => jest.fn().mockImplementation(() => ({ bundle: mockBundle })))

describe('loadSwagger', () => {
  jest.setTimeout(15 * 1000)

  beforeEach(() => {
    mockBundle.mockClear()
  })
  it('should retry when failing with status arg', async () => {
    mockBundle.mockRejectedValueOnce(new ErrorWithStatus('Failed to load swagger', 400))
    await loadSwagger('url', 3, 10)
    expect(mockBundle).toHaveBeenCalledTimes(2)
  })
  it('should retry when failing', async () => {
    mockBundle.mockRejectedValueOnce(new Error('Failed to load swagger'))
    await loadSwagger('url', 3, 10)
    expect(mockBundle).toHaveBeenCalledTimes(2)
  })

  it('should throw if failed after retries', async () => {
    mockBundle.mockRejectedValue(new Error('Failed to load swagger'))
    await expect(loadSwagger('url', 3, 10)).rejects.toThrow()
    expect(mockBundle).toHaveBeenCalledTimes(4)
  })
})
