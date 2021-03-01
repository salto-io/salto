/*
*                      Copyright 2021 Salto Labs Ltd.
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
/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { filtersRunner, FilterCreator } from '../src/filter_utils'
import { makeResolvablePromise } from './common'

describe('filter utils', () => {
  describe('filtersRunner', () => {
    let filters: FilterCreator<{}, { configVal: string; promise: Promise<number> }>[]
    const mockOnFetch2: () => Promise<void> = jest.fn().mockImplementation(
      async (): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    )
    const mockOnFetch3: () => Promise<void> = jest.fn().mockImplementation(
      async (): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    )
    beforeAll(() => {
      filters = [
        ({ config }) => ({
          onFetch: jest.fn().mockImplementation(async (): Promise<void> => {
            await config.promise
          }),
        }),
        () => ({
          onFetch: mockOnFetch2,
        }),
        () => ({
          onFetch: mockOnFetch3,
        }),
      ]
    })

    it('should call onFetch for all nested filters in order', async () => {
      const p = makeResolvablePromise(3)
      const runner = filtersRunner({ get: jest.fn() }, { configVal: '123 ', promise: p.promise }, filters)
      const onFetchRes = runner.onFetch([])
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mockOnFetch2).not.toHaveBeenCalled()
      expect(mockOnFetch3).not.toHaveBeenCalled()
      p.resolve()
      await onFetchRes
      expect(mockOnFetch2).toHaveBeenCalled()
      expect(mockOnFetch3).toHaveBeenCalled()
    })
  })
})
