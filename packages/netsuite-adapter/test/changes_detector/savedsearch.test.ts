/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import detector from '../../src/changes_detector/changes_detectors/savedsearch'
import { Change } from '../../src/changes_detector/types'
import NetsuiteClient from '../../src/client/client'
import mockSdfClient from '../client/sdf_client'
import { createDateRange } from '../../src/changes_detector/date_formats'
import { TIME_DATE_FORMAT } from '../client/mocks'

describe('savedsearch', () => {
  const runSavedSearchQueryMock = jest.fn()
  const suiteAppClient = {
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)

  describe('query success', () => {
    let results: Change[]
    beforeEach(async () => {
      runSavedSearchQueryMock.mockReset()
      runSavedSearchQueryMock.mockResolvedValue([
        { id: 'a', datemodified: '03/15/2021 03:04 pm' },
        { id: 'b', datemodified: '03/15/2021 03:05 pm' },
        { invalid: 0 },
      ])
      results = await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { type: 'object', objectId: 'a', time: new Date('2021-03-15T15:05:00.000Z') },
        { type: 'object', objectId: 'b', time: new Date('2021-03-15T15:06:00.000Z') },
      ])
    })

    it('should make the right query', () => {
      expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
        {
          type: 'savedsearch',
          columns: ['id', 'datemodified'],
          filters: [['datemodified', 'within', '2021-01-11 6:55 pm', '2021-02-22 6:56 pm']],
        },
        undefined,
      )
    })
  })

  it('return nothing when query fails', async () => {
    runSavedSearchQueryMock.mockResolvedValue(undefined)
    expect(await detector.getChanges(client, createDateRange(new Date(), new Date(), TIME_DATE_FORMAT))).toHaveLength(0)
  })
})
