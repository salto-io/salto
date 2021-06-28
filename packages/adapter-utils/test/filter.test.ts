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
import each from 'jest-each'
import { Filter, FilterCreator, filtersRunner } from '../src/filter'

describe('filtersRunner', () => {
  describe('onFetch', () => {
    type FetchResult = { a: number[] }
    let onFetchResults: FetchResult | void
    const onFetch1 = jest.fn()
    const onFetch2 = jest.fn()

    beforeEach(async () => {
      jest.resetAllMocks()
      onFetch1.mockResolvedValue({ a: [1] })
      onFetch2.mockResolvedValue({ a: [2] })

      const filters = [onFetch1, onFetch2]
        .map(f => () => ({ onFetch: f })) as unknown as FilterCreator<FetchResult, {}>[]

      onFetchResults = await filtersRunner({}, filters).onFetch([])
    })

    it('should run all onFetch filters', () => {
      expect(onFetch1).toHaveBeenCalled()
      expect(onFetch2).toHaveBeenCalled()
    })

    it('should run concat the results', () => {
      expect(onFetchResults).toEqual({ a: [1, 2] })
    })
  })

  each([
    'preDeploy',
    'onDeploy',
    'onPostFetch',
  ]).describe('%s', (operation: keyof Filter<void>) => {
    const operation1 = jest.fn()
    const operation2 = jest.fn()

    beforeEach(async () => {
      jest.resetAllMocks()

      const filters = [operation1, operation2]
        .map(f => () => ({ [operation]: f }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await filtersRunner({}, filters)[operation]({} as any)
    })

    it(`should run all ${operation} filters`, () => {
      expect(operation1).toHaveBeenCalled()
      expect(operation2).toHaveBeenCalled()
    })
  })
})
