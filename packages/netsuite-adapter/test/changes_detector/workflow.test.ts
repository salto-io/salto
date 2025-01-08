/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import detector from '../../src/changes_detector/changes_detectors/workflow'
import { Change } from '../../src/changes_detector/types'
import NetsuiteClient from '../../src/client/client'
import mockSdfClient from '../client/sdf_client'
import { createDateRange } from '../../src/changes_detector/date_formats'
import { TIME_DATE_FORMAT } from '../client/mocks'

describe('workflow', () => {
  const runSavedSearchQueryMock = jest.fn()
  const suiteAppClient = {
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)

  describe('query success', () => {
    describe('There are changes', () => {
      let results: Change[]
      beforeEach(async () => {
        runSavedSearchQueryMock.mockReset()
        runSavedSearchQueryMock.mockResolvedValue([{ recordid: 'a' }])
        results = await detector.getChanges(
          client,
          createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T06:55:17.949Z'), TIME_DATE_FORMAT),
        )
      })
      it('should return the type', () => {
        expect(results).toEqual([{ type: 'type', name: 'workflow' }])
      })

      it('should make the right query', () => {
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
          {
            type: 'systemnote',
            filters: [
              ['recordtype', 'is', '-129'],
              'and',
              ['date', 'within', '2021-01-11 6:55 pm', '2021-02-22 6:56 am'],
            ],
            columns: ['recordid'],
          },
          undefined,
        )
      })
    })

    describe('There are no changes', () => {
      let results: Change[]
      beforeEach(async () => {
        runSavedSearchQueryMock.mockReset()
        runSavedSearchQueryMock.mockResolvedValue([])
        results = await detector.getChanges(
          client,
          createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
        )
      })
      it('should return nothing', () => {
        expect(results).toEqual([])
      })
    })
  })

  it('return nothing when query fails', async () => {
    runSavedSearchQueryMock.mockResolvedValue(undefined)
    expect(await detector.getChanges(client, createDateRange(new Date(), new Date(), TIME_DATE_FORMAT))).toHaveLength(0)
  })
})
