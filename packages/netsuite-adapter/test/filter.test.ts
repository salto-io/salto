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
import { Change, DeployResult, Element, PostFetchOptions } from '@salto-io/adapter-api'
import { Filter, createFilterCreatorsWithLogs, FilterCreator, FilterOpts } from '../src/filter'

describe('filter', () => {
  const mockOnFetch = jest.fn()
  const mockPreDeploy = jest.fn()
  const mockDeploy = jest.fn()
  const mockOnDeploy = jest.fn()
  const mockOnPostFetch = jest.fn()
  const filterWithAllMethods: Required<Filter> = {
    onFetch: mockOnFetch,
    preDeploy: mockPreDeploy,
    deploy: mockDeploy,
    onDeploy: mockOnDeploy,
    onPostFetch: mockOnPostFetch,
  }
  const filterCreator = jest.fn()
  let wrappedFilterCreators: FilterCreator[]
  let wrappedFilter: Filter
  beforeAll(() => {
    filterCreator.mockReturnValue(filterWithAllMethods)
    wrappedFilterCreators = createFilterCreatorsWithLogs({ someFilter: filterCreator })
    wrappedFilter = wrappedFilterCreators[0]
      ? wrappedFilterCreators[0]({ test: true } as unknown as FilterOpts)
      : {}
  })
  it('should contain all filterCreators', () => {
    expect(wrappedFilterCreators.length).toEqual(1)
  })
  it('should run filterCreator with opts', () => {
    expect(filterCreator).toHaveBeenCalledWith({ test: true })
  })
  it('should run inner onFetch with args', async () => {
    await wrappedFilter.onFetch?.([1, 2, 3] as unknown as Element[])
    expect(mockOnFetch).toHaveBeenCalledWith([1, 2, 3])
  })
  it('should run inner preDeploy with args', async () => {
    await wrappedFilter.preDeploy?.([1, 2, 3] as unknown as Change[])
    expect(mockPreDeploy).toHaveBeenCalledWith([1, 2, 3])
  })
  it('should run inner deploy with args', async () => {
    await wrappedFilter.deploy?.([1, 2, 3] as unknown as Change[])
    expect(mockDeploy).toHaveBeenCalledWith([1, 2, 3])
  })
  it('should run inner onDeploy with args', async () => {
    await wrappedFilter.onDeploy?.(
      [1, 2, 3] as unknown as Change[],
      { a: 1 } as unknown as DeployResult
    )
    expect(mockOnDeploy).toHaveBeenCalledWith([1, 2, 3], { a: 1 })
  })
  it('should run inner onPostFetch with args', async () => {
    await wrappedFilter.onPostFetch?.({ opt: 1 } as unknown as PostFetchOptions)
    expect(mockOnPostFetch).toHaveBeenCalledWith({ opt: 1 })
  })
  it('should create filter with no methods', () => {
    expect(createFilterCreatorsWithLogs({
      someFilter: jest.fn().mockReturnValue({}),
    })[0]({} as unknown as FilterOpts)).toEqual({})
  })
})
