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
import { SuiteAppClient } from '../../src/client/suiteapp_client/suiteapp_client'
import detector from '../../src/changes_detector/changes_detectors/role'
import { Change } from '../../src/changes_detector/types'

describe('role', () => {
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const client = {
    runSuiteQL: runSuiteQLMock,
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient


  it('should not return permission changes on permission query error', async () => {
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: 'a', id: '1' },
      { scriptid: 'b', id: '2' },
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
    expect(await detector.getChanges(
      client,
      { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
    )).toEqual([
      { type: 'object', externalId: 'a', internalId: 1 },
      { type: 'object', externalId: 'b', internalId: 2 },
    ])
  })

  describe('query success', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptid: 'a', id: '1' },
        { scriptid: 'b', id: '2' },
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
        { internalid: [{ value: '3' }] },
        { invalid: 0 },
      ])

      results = await detector.getChanges(
        client,
        { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { type: 'object', externalId: 'a', internalId: 1 },
        { type: 'object', externalId: 'b', internalId: 2 },
        { type: 'object', externalId: 'c' },
      ])
    })

    it('should make the right query', () => {
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, `
      SELECT role.scriptid, role.id
      FROM role
      JOIN systemnote ON systemnote.recordid = role.id
      WHERE systemnote.date BETWEEN '1/11/2021' AND '2/22/2021' AND systemnote.recordtypeid = -118
    `)

      expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, `
      SELECT scriptid, id
      FROM role
    `)

      expect(runSavedSearchQueryMock).toHaveBeenCalledWith({
        type: 'role',
        columns: ['internalid'],
        filters: [['permchangedate', 'within', '1/11/2021 6:55 pm', '2/22/2021 6:55 pm']],
      })
    })
  })

  it('return nothing when roles query fails', async () => {
    runSuiteQLMock.mockResolvedValue(undefined)
    expect(
      await detector.getChanges(client, { start: new Date(), end: new Date() })
    ).toHaveLength(0)
  })
})
