/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import { getChangedFiles, getChangedFolders } from '../../src/changes_detector/changes_detectors/file_cabinet'
import { Change } from '../../src/changes_detector/types'
import mockSdfClient from '../client/sdf_client'
import NetsuiteClient from '../../src/client/client'
import { createDateRange, toSuiteQLSelectDateString } from '../../src/changes_detector/date_formats'
import { TIME_DATE_FORMAT } from '../client/mocks'

describe('file_cabinet', () => {
  const runSuiteQLMock = jest.fn()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)
  describe('getChangedFiles', () => {
    describe('query success', () => {
      let results: Change[]
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSuiteQLMock.mockResolvedValue([
          { appfolder: 'a : b', name: 'c', time: '2021-01-20 20:10:20' },
          { appfolder: 'd : e', name: 'f', time: '2021-01-20 20:10:20' },
        ])
        results = await getChangedFiles(
          client,
          createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
        )
      })
      it('should return the changes', () => {
        expect(results).toEqual([
          { type: 'object', objectId: '/a/b/c', time: new Date('2021-01-20T20:10:20.000Z') },
          { type: 'object', objectId: '/d/e/f', time: new Date('2021-01-20T20:10:20.000Z') },
        ])
      })

      it('should make the right query', () => {
        expect(runSuiteQLMock).toHaveBeenCalledWith(`
    SELECT mediaitemfolder.appfolder, file.name, ${toSuiteQLSelectDateString('file.lastmodifieddate')} as time
    FROM file
    JOIN mediaitemfolder ON mediaitemfolder.id = file.folder
    WHERE file.lastmodifieddate BETWEEN TO_DATE('2021-1-11', 'YYYY-MM-DD') AND TO_DATE('2021-2-23', 'YYYY-MM-DD')
    ORDER BY file.id ASC
  `)
      })
    })

    describe('query success with invalid results', () => {
      let results: Change[]
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSuiteQLMock.mockResolvedValue([
          { appfolder: 'a : b', name: 'c', time: '2021-01-20 20:10:20' },
          { appfolder: 'd : e', name: 'f', time: '2021-01-20 20:10:20' },
          { appfolder: 'g', name: {} },
        ])
        results = await getChangedFiles(
          client,
          createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
        )
      })
      it('should return the changes', () => {
        expect(results).toEqual([
          { type: 'object', objectId: '/a/b/c', time: new Date('2021-01-20T20:10:20.000Z') },
          { type: 'object', objectId: '/d/e/f', time: new Date('2021-01-20T20:10:20.000Z') },
        ])
      })
    })
    it('return nothing when query fails', async () => {
      runSuiteQLMock.mockResolvedValue(undefined)
      expect(await getChangedFiles(client, createDateRange(new Date(), new Date(), TIME_DATE_FORMAT))).toHaveLength(0)
    })
  })

  describe('getChangedFolders', () => {
    describe('query success', () => {
      let results: Change[]
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSuiteQLMock.mockResolvedValue([
          { appfolder: 'a : b', time: '2021-01-20 20:10:20' },
          { appfolder: 'd : e', time: '2021-01-20 20:10:20' },
        ])
        results = await getChangedFolders(
          client,
          createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
        )
      })
      it('should return the changes', () => {
        expect(results).toEqual([
          { type: 'object', objectId: '/a/b', time: new Date('2021-01-20T20:10:20.000Z') },
          { type: 'object', objectId: '/d/e', time: new Date('2021-01-20T20:10:20.000Z') },
        ])
      })

      it('should make the right query', () => {
        expect(runSuiteQLMock).toHaveBeenCalledWith(`
    SELECT appfolder, ${toSuiteQLSelectDateString('lastmodifieddate')} as time
    FROM mediaitemfolder
    WHERE lastmodifieddate BETWEEN TO_DATE('2021-1-11', 'YYYY-MM-DD') AND TO_DATE('2021-2-23', 'YYYY-MM-DD')
    ORDER BY id ASC
  `)
      })
    })

    describe('query success with invalid results', () => {
      let results: Change[]
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSuiteQLMock.mockResolvedValue([
          { appfolder: 'a : b', time: '2021-01-20 20:10:20' },
          { appfolder: 'd : e', time: '2021-01-20 20:10:20' },
          { appfolder: 'g' },
        ])
        results = await getChangedFolders(
          client,
          createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
        )
      })
      it('should return the changes', () => {
        expect(results).toEqual([
          { type: 'object', objectId: '/a/b', time: new Date('2021-01-20T20:10:20.000Z') },
          { type: 'object', objectId: '/d/e', time: new Date('2021-01-20T20:10:20.000Z') },
        ])
      })
    })
    it('return nothing when query fails', async () => {
      runSuiteQLMock.mockResolvedValue(undefined)
      expect(await getChangedFolders(client, createDateRange(new Date(), new Date(), TIME_DATE_FORMAT))).toHaveLength(0)
    })
  })
})
