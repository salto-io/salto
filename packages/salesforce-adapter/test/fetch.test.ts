/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { retryOnSizeLimitExceeded, LimitExceededError } from '../src/fetch'

const TOO_MANY_ITEMS = 100

const mockRetrieveInstanaces = jest.fn().mockImplementation(
  async (chunkSize: number): Promise<void> => {
    if (chunkSize > TOO_MANY_ITEMS) {
      throw new LimitExceededError()
    }
  }
)

describe('retryOnSizeLimitExceeded', () => {
  beforeEach(() => {
    mockRetrieveInstanaces.mockClear()
  })
  it('should return original size if no error occured', async () => {
    expect(await retryOnSizeLimitExceeded(mockRetrieveInstanaces, TOO_MANY_ITEMS - 1, 10))
      .toMatchObject({ suggestedMaxItems: TOO_MANY_ITEMS - 1 })
  })
  it('should return a natural suggestion if too got error', async () => {
    expect(await retryOnSizeLimitExceeded(
      mockRetrieveInstanaces,
      TOO_MANY_ITEMS + 11,
      TOO_MANY_ITEMS + 11
    )).toMatchObject({ suggestedMaxItems: 55 })
  })
  it('should quickly get the correct number if actual count is small', async () => {
    expect(await retryOnSizeLimitExceeded(mockRetrieveInstanaces, 1000000, 160))
      .toMatchObject({ suggestedMaxItems: 80 })
    expect(mockRetrieveInstanaces.mock.calls.length).toBeLessThan(5)
  })
  it('should throw error if no valid value is low enough', async () => {
    await expect(() => retryOnSizeLimitExceeded(
      _n => { throw new LimitExceededError() },
      TOO_MANY_ITEMS,
      TOO_MANY_ITEMS
    )).rejects.toThrow()
  })
})
