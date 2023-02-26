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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../../src/types'
import filterCreator from '../../../src/filters/author_information/saved_searches'
import { NETSUITE, SAVED_SEARCH } from '../../../src/constants'
import NetsuiteClient from '../../../src/client/client'
import { FilterOpts } from '../../../src/filter'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../../client/sdf_client'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../../utils'
import 'moment-timezone'

describe('netsuite saved searches author information tests', () => {
  let filterOpts: FilterOpts
  let elements: InstanceElement[]
  let savedSearch: InstanceElement
  let missingSavedSearch: InstanceElement
  let userPreferenceInstance: InstanceElement
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const SDFClient = mockSdfClient()
  const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(SDFClient, suiteAppClient)
  beforeEach(async () => {
    runSavedSearchQueryMock.mockReset()
    runSavedSearchQueryMock.mockResolvedValue([
      { id: '1', modifiedby: [{ value: '1', text: 'user 1 name' }], datemodified: '01/28/1995 6:17 am' },
    ])

    savedSearch = new InstanceElement(SAVED_SEARCH,
      new ObjectType({ elemID: new ElemID(NETSUITE, SAVED_SEARCH) }))
    missingSavedSearch = new InstanceElement(SAVED_SEARCH,
      new ObjectType({ elemID: new ElemID(NETSUITE, SAVED_SEARCH) }))
    userPreferenceInstance = new InstanceElement(ElemID.CONFIG_NAME,
      new ObjectType({ elemID: new ElemID(NETSUITE,
        SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES.USER_PREFERENCES) }))
    savedSearch.value.scriptid = '1'
    missingSavedSearch.value.scriptid = '2'
    userPreferenceInstance.value.configRecord = { data: {
      fields: {
        DATEFORMAT: 'MM/DD/YYYY',
        TIMEZONE: 'America/Toronto',
        TIMEFORMAT: 'H:mm',
      },
    } }
    elements = [savedSearch, missingSavedSearch, userPreferenceInstance]
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })

  it('should query information from api', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(runSavedSearchQueryMock).toHaveBeenNthCalledWith(1, {
      type: 'savedsearch',
      columns: ['modifiedby', 'id', 'datemodified'],
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

  it('should add last modified date to elements', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('1995-01-28T11:17:00Z')
  })

  it('should add last modified date for different formats', async () => {
    userPreferenceInstance.value.configRecord.data.fields.DATEFORMAT = 'D/M/YYYY'
    runSavedSearchQueryMock.mockResolvedValue([
      { id: '1', modifiedby: [{ value: '1', text: 'user 1 name' }], datemodified: '28/1/1995 6:17 am' },
    ])
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('1995-01-28T11:17:00Z')
  })

  it('should add last modified date for different format', async () => {
    userPreferenceInstance.value.configRecord.data.fields.DATEFORMAT = 'D Month, YYYY'
    userPreferenceInstance.value.configRecord.data.fields.TIMEZONE = 'Asia/Jerusalem'
    runSavedSearchQueryMock.mockResolvedValue([
      { id: '1', modifiedby: [{ value: '1', text: 'user 1 name' }], datemodified: '28 January, 1995 6:17 am' },
    ])
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('1995-01-28T04:17:00Z')
  })
  it('should not assign change at if the date is from the future', async () => {
    userPreferenceInstance.value.configRecord.data.fields.DATEFORMAT = 'D Month, YYYY'
    userPreferenceInstance.value.configRecord.data.fields.TIMEZONE = 'Asia/Jerusalem'
    runSavedSearchQueryMock.mockResolvedValue([
      { id: '1', modifiedby: [{ value: '1', text: 'user 1 name' }], datemodified: '28 January, 3995 6:17 am' },
    ])
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toBeUndefined()
  })

  it('should not add last modified date when the account date format isnt avaible', async () => {
    userPreferenceInstance.value.configRecord.data.fields = {}
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toBeUndefined()
  })

  it('it should get the date format from elementSource', async () => {
    filterOpts.isPartial = true
    userPreferenceInstance.value = {
      DATEFORMAT: {
        text: 'MM/DD/YYYY',
        value: 'MM/DD/YYYY',
      },
      TIMEZONE: {
        value: 'America/Toronto',
      },
      TIMEFORMAT: {
        value: 'H:mm',
      },
    }
    filterOpts.elementsSource = buildElementsSourceFromElements(elements)
    elements = [savedSearch, missingSavedSearch]
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('1995-01-28T11:17:00Z')
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
    beforeEach(async () => {
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
    })
    it('should not change any elements in fetch', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSavedSearchQueryMock).not.toHaveBeenCalled()
      expect(Object.values(savedSearch.annotations)).toHaveLength(0)
    })
  })

  describe('authorInformation.enable is false', () => {
    beforeEach(async () => {
      const defaultConfig = await getDefaultAdapterConfig()
      filterOpts = {
        client,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: {
          ...defaultConfig,
          fetch: {
            ...defaultConfig.fetch,
            authorInformation: {
              enable: false,
            },
          },
        },
      }
    })
    it('should not change any elements in fetch', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSavedSearchQueryMock).not.toHaveBeenCalled()
      expect(Object.values(savedSearch.annotations)).toHaveLength(0)
    })
  })
})
