/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { loadSwagger } from '../../../src/elements/swagger'

class ErrorWithStatus extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}
const mockBundle = jest.fn()

jest.mock('@apidevtools/swagger-parser', () =>
  jest.fn().mockImplementation(
    () => ({ bundle: mockBundle })
  ))

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
