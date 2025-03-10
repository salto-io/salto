/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import { customFieldDetector as detector } from '../../src/changes_detector/changes_detectors/custom_type'
import { Change } from '../../src/changes_detector/types'
import NetsuiteClient from '../../src/client/client'
import mockSdfClient from '../client/sdf_client'
import { createDateRange, toSuiteQLSelectDateString } from '../../src/changes_detector/date_formats'
import { TIME_DATE_FORMAT } from '../client/mocks'

describe('custom_field', () => {
  const runSuiteQLMock = jest.fn()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)
  describe('query success', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValue([
        { scriptid: 'a', time: '2021-03-15 00:00:00' },
        { scriptid: 'b', time: '2021-03-16 00:00:00' },
      ])
      results = await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { type: 'object', objectId: 'a', time: new Date('2021-03-15T00:00:00.000Z') },
        { type: 'object', objectId: 'b', time: new Date('2021-03-16T00:00:00.000Z') },
      ])
    })

    it('should make the right query', () => {
      expect(runSuiteQLMock).toHaveBeenCalledWith({
        select: `internalid, scriptid, ${toSuiteQLSelectDateString('lastmodifieddate')} AS time`,
        from: 'customfield',
        where: "lastmodifieddate BETWEEN TO_DATE('2021-1-11', 'YYYY-MM-DD') AND TO_DATE('2021-2-23', 'YYYY-MM-DD')",
        orderBy: 'internalid',
      })
    })
  })

  describe('query success with invalid results', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValue([
        { scriptid: 'a', time: '2021-03-15 00:00:00' },
        { scriptid: 'b', time: '2021-03-16 00:00:00' },
        { qqq: 'b' },
        { scriptid: {} },
      ])
      results = await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      )
    })
    it('should return the changes without the invalid results', () => {
      expect(results).toEqual([
        { type: 'object', objectId: 'a', time: new Date('2021-03-15T00:00:00.000Z') },
        { type: 'object', objectId: 'b', time: new Date('2021-03-16T00:00:00.000Z') },
      ])
    })
  })
  it('return nothing when query fails', async () => {
    runSuiteQLMock.mockResolvedValue(undefined)
    expect(await detector.getChanges(client, createDateRange(new Date(), new Date(), TIME_DATE_FORMAT))).toHaveLength(0)
  })
})
