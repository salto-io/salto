/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import detector from '../../src/changes_detector/changes_detectors/role'
import { Change } from '../../src/changes_detector/types'
import mockSdfClient from '../client/sdf_client'
import NetsuiteClient from '../../src/client/client'
import { createDateRange, toSuiteQLSelectDateString } from '../../src/changes_detector/date_formats'
import { TIME_DATE_FORMAT } from '../client/mocks'

describe('role', () => {
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)

  it('should not return permission changes on permission query error', async () => {
    runSuiteQLMock.mockResolvedValueOnce([
      { rolescriptid: 'a', time: '2021-01-11 20:55:17' },
      { rolescriptid: 'b', time: '2021-01-11 21:55:17' },
      { invalid: 0 },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: 'a', id: '1' },
      { scriptid: 'b', id: '2' },
      { scriptid: 'c', id: '3' },
      { scriptid: 'd', id: '4' },
      { invalid: 0 },
    ])
    runSavedSearchQueryMock.mockResolvedValue(undefined)
    expect(
      await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      ),
    ).toEqual([
      { type: 'object', objectId: 'a', time: new Date('2021-01-11T20:55:17.000Z') },
      { type: 'object', objectId: 'b', time: new Date('2021-01-11T21:55:17.000Z') },
    ])
  })

  describe('query success', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { rolescriptid: 'a', time: '2021-01-11 20:55:17' },
        { rolescriptid: 'b', time: '2021-01-11 21:55:17' },
        { invalid: 0 },
      ])
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptid: 'a', id: '1' },
        { scriptid: 'b', id: '2' },
        { scriptid: 'c', id: '3' },
        { scriptid: 'd', id: '4' },
        { invalid: 0 },
      ])

      runSavedSearchQueryMock.mockResolvedValue([
        { internalid: [{ value: '3' }], permchangedate: '03/09/2021 03:04 pm' },
        { invalid: 0 },
      ])

      results = await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { type: 'object', objectId: 'a', time: new Date('2021-01-11T20:55:17.000Z') },
        { type: 'object', objectId: 'b', time: new Date('2021-01-11T21:55:17.000Z') },
        { type: 'object', objectId: 'c', time: new Date('2021-03-09T15:05:00.000Z') },
      ])
    })

    it('should make the right query', () => {
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, {
        select: `role.scriptid as rolescriptid, ${toSuiteQLSelectDateString('MAX(systemnote.date)')} as time`,
        from: 'role',
        join: 'systemnote ON systemnote.recordid = role.id',
        where:
          "systemnote.date BETWEEN TO_DATE('2021-1-11', 'YYYY-MM-DD') AND TO_DATE('2021-2-23', 'YYYY-MM-DD') AND systemnote.recordtypeid = -118",
        groupBy: 'role.scriptid',
        orderBy: 'rolescriptid',
      })

      expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, {
        select: 'scriptid, id',
        from: 'role',
        orderBy: 'id',
      })

      expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
        {
          type: 'role',
          columns: ['internalid', 'permchangedate'],
          filters: [['permchangedate', 'within', '2021-01-11 6:55 pm', '2021-02-22 6:56 pm']],
        },
        undefined,
      )
    })
  })

  it('return nothing when roles query fails', async () => {
    runSuiteQLMock.mockResolvedValue(undefined)
    expect(await detector.getChanges(client, createDateRange(new Date(), new Date(), TIME_DATE_FORMAT))).toHaveLength(0)
  })
})
