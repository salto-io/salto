/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../../src/filters/author_information/saved_searches'
import { NETSUITE, SAVED_SEARCH } from '../../../src/constants'
import NetsuiteClient from '../../../src/client/client'
import { RemoteFilterOpts } from '../../../src/filter'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../../client/sdf_client'
import { getTypesToInternalId } from '../../../src/data_elements/types'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../../utils'
import 'moment-timezone'

describe('netsuite saved searches author information tests', () => {
  let filterOpts: RemoteFilterOpts
  let elements: InstanceElement[]
  let savedSearch: InstanceElement
  let missingSavedSearch: InstanceElement
  let userPreferenceInstance: InstanceElement
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const SDFClient = mockSdfClient()
  const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
  const { internalIdToTypes, typeToInternalId } = getTypesToInternalId([])
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

    savedSearch = new InstanceElement(SAVED_SEARCH, new ObjectType({ elemID: new ElemID(NETSUITE, SAVED_SEARCH) }))
    missingSavedSearch = new InstanceElement(
      SAVED_SEARCH,
      new ObjectType({ elemID: new ElemID(NETSUITE, SAVED_SEARCH) }),
    )
    savedSearch.value.scriptid = '1'
    missingSavedSearch.value.scriptid = '2'
    elements = [savedSearch, missingSavedSearch, userPreferenceInstance]
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      timeZoneAndFormat: { format: 'MM/DD/YYYY H:mm a', timeZone: 'America/Toronto' },
      internalIdToTypes,
      typeToInternalId,
    }
  })

  it('should query information from api', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(runSavedSearchQueryMock).toHaveBeenNthCalledWith(
      1,
      {
        type: 'savedsearch',
        columns: ['modifiedby', 'id', 'datemodified'],
        filters: [],
      },
      undefined,
    )
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
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      timeZoneAndFormat: { format: 'DD/M/YYYY h:mm a', timeZone: 'America/Toronto' },
      internalIdToTypes,
      typeToInternalId,
    }
    runSavedSearchQueryMock.mockResolvedValue([
      { id: '1', modifiedby: [{ value: '1', text: 'user 1 name' }], datemodified: '28/1/1995 6:17 am' },
    ])
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('1995-01-28T11:17:00Z')
  })

  it('should add last modified date for different format', async () => {
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      timeZoneAndFormat: { format: 'D MMMM, YYYY h:mm a', timeZone: 'Asia/Jerusalem' },
      internalIdToTypes,
      typeToInternalId,
    }
    runSavedSearchQueryMock.mockResolvedValue([
      { id: '1', modifiedby: [{ value: '1', text: 'user 1 name' }], datemodified: '28 January, 1995 6:17 am' },
    ])
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('1995-01-28T04:17:00Z')
  })
  it('should not assign change at if the date is from the future', async () => {
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      timeZoneAndFormat: { format: 'D MMMM, YYYY h:mm a', timeZone: 'Asia/Jerusalem' },
      internalIdToTypes,
      typeToInternalId,
    }
    runSavedSearchQueryMock.mockResolvedValue([
      { id: '1', modifiedby: [{ value: '1', text: 'user 1 name' }], datemodified: '28 January, 3995 6:17 am' },
    ])
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toBeUndefined()
  })

  it('should not add last modified date when the account date format isnt avaible', async () => {
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      timeZoneAndFormat: { format: undefined, timeZone: 'Asia/Jerusalem' },
      internalIdToTypes,
      typeToInternalId,
    }
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toBeUndefined()
  })

  it('elements will stay the same if they were not found by the search', async () => {
    runSavedSearchQueryMock.mockReset()
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations).toEqual({})
  })
  it('elements will stay the same if a modified by was empty in search', async () => {
    runSavedSearchQueryMock.mockReset()
    runSavedSearchQueryMock.mockResolvedValueOnce([{ id: '1', modifiedby: [] }])
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(savedSearch.annotations).toEqual({})
  })
  describe('failure', () => {
    it('undefined saved search result', async () => {
      runSavedSearchQueryMock.mockReset()
      runSavedSearchQueryMock.mockResolvedValueOnce(undefined)
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(savedSearch.annotations).toEqual({})
    })
    it('bad search result schema', async () => {
      runSavedSearchQueryMock.mockReset()
      runSavedSearchQueryMock.mockResolvedValueOnce([{ id: '1', modifiedby: { text: 'user 1 name' } }])
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(savedSearch.annotations).toEqual({})
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
        internalIdToTypes,
        typeToInternalId,
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
        internalIdToTypes,
        typeToInternalId,
      }
    })
    it('should not change any elements in fetch', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSavedSearchQueryMock).not.toHaveBeenCalled()
      expect(Object.values(savedSearch.annotations)).toHaveLength(0)
    })
  })
})
