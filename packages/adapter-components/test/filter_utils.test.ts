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
import { ElemID, ObjectType } from '@salto-io/adapter-api'
import { filtersRunner, FilterCreator, filterTypes } from '../src/filter_utils'
import { makeResolvablePromise, mockFunction } from './common'
import { Paginator, HTTPClientInterface } from '../src/client'
import { SUBTYPES_PATH, TYPES_PATH } from '../src/elements'

describe('filter utils', () => {
  describe('filtersRunner', () => {
    let filters: FilterCreator<{}, { configVal: string; promise: Promise<number> }>[]
    const mockOnFetch2: () => Promise<void> = jest.fn().mockImplementation(
      async (): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 2))
      }
    )
    const mockOnFetch3: () => Promise<void> = jest.fn().mockImplementation(
      async (): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 2))
      }
    )
    const mockOnPostFetch2: () => Promise<void> = jest.fn().mockImplementation(
      async (): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 2))
      }
    )
    const mockOnPostFetch3: () => Promise<void> = jest.fn().mockImplementation(
      async (): Promise<void> => {
        await new Promise(resolve => setTimeout(resolve, 2))
      }
    )
    beforeAll(() => {
      filters = [
        ({ config }) => ({
          onFetch: jest.fn().mockImplementation(async (): Promise<void> => {
            await config.promise
          }),
          onPostFetch: jest.fn().mockImplementation(async (): Promise<void> => {
            await config.promise
          }),
        }),
        () => ({
          onFetch: mockOnFetch2,
          onPostFetch: mockOnPostFetch2,
        }),
        () => ({
          onFetch: mockOnFetch3,
          onPostFetch: mockOnPostFetch3,
        }),
      ]
    })

    it('should call onFetch for all nested filters in order', async () => {
      const p = makeResolvablePromise(3)
      const runner = filtersRunner(
        { get: mockFunction<HTTPClientInterface['getSinglePage']>() },
        mockFunction<Paginator>(),
        { configVal: '123 ', promise: p.promise },
        filters,
      )
      const onFetchRes = runner.onFetch([])
      await new Promise(resolve => setTimeout(resolve, 2))
      expect(mockOnFetch2).not.toHaveBeenCalled()
      expect(mockOnFetch3).not.toHaveBeenCalled()
      p.resolve()
      await onFetchRes
      expect(mockOnFetch2).toHaveBeenCalled()
      expect(mockOnFetch3).toHaveBeenCalled()
    })
    it('should call onPostFetch for all nested filters', async () => {
      const p = makeResolvablePromise(3)
      const runner = filtersRunner(
        { get: mockFunction<HTTPClientInterface['getSinglePage']>() },
        mockFunction<Paginator>(),
        { configVal: '123 ', promise: p.promise },
        filters,
      )
      const onPostFetchRes = runner.onPostFetch({
        elementsByAdapter: {},
        currentAdapterElements: [],
      })
      await new Promise(resolve => setTimeout(resolve, 2))
      expect(mockOnPostFetch2).not.toHaveBeenCalled()
      expect(mockOnPostFetch3).not.toHaveBeenCalled()
      p.resolve()
      await onPostFetchRes
      expect(mockOnPostFetch2).toHaveBeenCalled()
      expect(mockOnPostFetch3).toHaveBeenCalled()
    })
  })

  describe('filterTypes', () => {
    it('should filter the right types', () => {
      const typeA = new ObjectType({ elemID: new ElemID('adapterName', 'A'), path: ['adapterName', 'A'] })
      const typeB = new ObjectType({ elemID: new ElemID('adapterName', 'B'), fields: { a: { type: typeA } }, path: ['adapterName', 'B'] })
      const typeC = new ObjectType({ elemID: new ElemID('adapterName', 'C'), path: ['adapterName', 'C'] })
      const filteredTypes = filterTypes('adapterName', [typeA, typeB, typeC], ['B', 'D'])

      expect(filteredTypes[0].elemID.getFullNameParts()).toEqual(['adapterName', 'B'])
      expect(filteredTypes[0].path).toEqual(['adapterName', TYPES_PATH, 'B'])
      expect(filteredTypes[1].elemID.getFullNameParts()).toEqual(['adapterName', 'A'])
      expect(filteredTypes[1].path).toEqual(['adapterName', TYPES_PATH, SUBTYPES_PATH, 'A'])
    })
  })
})
