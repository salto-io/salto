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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../../src/filters/author_information/saved_searches'
import { NETSUITE, SAVED_SEARCH } from '../../../src/constants'
import NetsuiteClient from '../../../src/client/client'
import { FilterOpts } from '../../../src/filter'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../../client/sdf_client'

describe('netsuite saved searches author information tests', () => {
  let filterOpts: FilterOpts
  let elements: InstanceElement[]
  let savedSearch: InstanceElement
  let missingSavedSearch: InstanceElement
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const SDFClient = mockSdfClient()
  const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(SDFClient, suiteAppClient)

  beforeEach(() => {
    runSavedSearchQueryMock.mockReset()
    runSavedSearchQueryMock.mockResolvedValueOnce([
      { id: '1', modifiedby: [{ value: '1', text: 'user 1 name' }] },
    ])
    savedSearch = new InstanceElement(SAVED_SEARCH,
      new ObjectType({ elemID: new ElemID(NETSUITE, SAVED_SEARCH) }))
    missingSavedSearch = new InstanceElement(SAVED_SEARCH,
      new ObjectType({ elemID: new ElemID(NETSUITE, SAVED_SEARCH) }))
    savedSearch.value.scriptid = '1'
    missingSavedSearch.value.scriptid = '2'
    elements = [savedSearch, missingSavedSearch]
    filterOpts = {
      client,
      elementsSourceIndex: { getIndexes: () => Promise.resolve({
        serviceIdsIndex: {},
        internalIdsIndex: {},
        customFieldsIndex: {},
      }) },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
    }
  })

  it('should query information from api', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(runSavedSearchQueryMock).toHaveBeenNthCalledWith(1, {
      type: 'savedsearch',
      columns: ['modifiedby', 'id'],
      filters: [],
    })
    expect(runSavedSearchQueryMock).toHaveBeenCalledTimes(1)
  })

  it('should not query at all if there is no elements', async () => {
    await filterCreator(filterOpts).onFetch?.([])
    expect(runSavedSearchQueryMock).not.toHaveBeenCalled()
  })

  it('should add names to elements', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 1 name').toBeTruthy()
  })

  it('elements will stay the same if they were not found by the search', async () => {
    runSavedSearchQueryMock.mockReset()
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(Object.values(savedSearch.annotations)).toHaveLength(0)
  })
  it('elements will stay the same if a modified by was empty in search', async () => {
    runSavedSearchQueryMock.mockReset()
    runSavedSearchQueryMock.mockResolvedValueOnce([
      { id: '1', modifiedby: [] },
    ])
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(Object.values(savedSearch.annotations)).toHaveLength(0)
  })
  describe('failure', () => {
    it('undefined saved search result', async () => {
      runSavedSearchQueryMock.mockReset()
      runSavedSearchQueryMock.mockResolvedValueOnce(undefined)
      filterCreator(filterOpts).onFetch?.(elements)
      expect(Object.values(savedSearch.annotations)).toHaveLength(0)
    })
    it('bad search result schema', async () => {
      runSavedSearchQueryMock.mockReset()
      runSavedSearchQueryMock.mockResolvedValueOnce([
        { id: '1', modifiedby: { text: 'user 1 name' } },
      ])
      filterCreator(filterOpts).onFetch?.(elements)
      expect(Object.values(savedSearch.annotations)).toHaveLength(0)
    })
  })

  describe('no suite app client', () => {
    beforeEach(() => {
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: { getIndexes: () => Promise.resolve({
          serviceIdsIndex: {},
          internalIdsIndex: {},
          customFieldsIndex: {},
        }) },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      }
    })
    it('should not change any elements in fetch', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSavedSearchQueryMock).not.toHaveBeenCalled()
      expect(Object.values(savedSearch.annotations)).toHaveLength(0)
    })
  })
})
