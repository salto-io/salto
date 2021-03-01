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
import { getChangedFiles, getChangedFolders } from '../../src/changes_detector/changes_detectors/file_cabinet'
import { Change } from '../../src/changes_detector/types'

describe('file_cabinet', () => {
  const runSuiteQLMock = jest.fn()
  const client = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient

  describe('getChangedFiles', () => {
    describe('query success', () => {
      let results: Change[]
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSuiteQLMock.mockResolvedValue([{ appfolder: 'a : b', name: 'c', id: '1' }, { appfolder: 'd : e', name: 'f', id: '2' }])
        results = await getChangedFiles(
          client,
          { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
        )
      })
      it('should return the changes', () => {
        expect(results).toEqual([
          { type: 'object', externalId: '/a/b/c', internalId: 1 },
          { type: 'object', externalId: '/d/e/f', internalId: 2 },
        ])
      })

      it('should make the right query', () => {
        expect(runSuiteQLMock).toHaveBeenCalledWith(`
    SELECT mediaitemfolder.appfolder, file.name, file.id
    FROM file
    JOIN mediaitemfolder ON mediaitemfolder.id = file.folder
    WHERE file.lastmodifieddate BETWEEN '1/11/2021' AND '2/22/2021'
  `)
      })
    })

    describe('query success with invalid results', () => {
      let results: Change[]
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSuiteQLMock.mockResolvedValue([
          { appfolder: 'a : b', name: 'c', id: '1' },
          { appfolder: 'd : e', name: 'f', id: '2' },
          { appfolder: 'g', name: {} },
        ])
        results = await getChangedFiles(
          client,
          { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
        )
      })
      it('should return the changes', () => {
        expect(results).toEqual([
          { type: 'object', externalId: '/a/b/c', internalId: 1 },
          { type: 'object', externalId: '/d/e/f', internalId: 2 },
        ])
      })
    })
    it('return nothing when query fails', async () => {
      runSuiteQLMock.mockResolvedValue(undefined)
      expect(
        await getChangedFiles(client, { start: new Date(), end: new Date() })
      ).toHaveLength(0)
    })
  })

  describe('getChangedFolders', () => {
    describe('query success', () => {
      let results: Change[]
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSuiteQLMock.mockResolvedValue([{ appfolder: 'a : b', id: '1' }, { appfolder: 'd : e', id: '2' }])
        results = await getChangedFolders(
          client,
          { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
        )
      })
      it('should return the changes', () => {
        expect(results).toEqual([
          { type: 'object', externalId: '/a/b', internalId: 1 },
          { type: 'object', externalId: '/d/e', internalId: 2 },
        ])
      })

      it('should make the right query', () => {
        expect(runSuiteQLMock).toHaveBeenCalledWith(`
    SELECT appfolder, id
    FROM mediaitemfolder
    WHERE lastmodifieddate BETWEEN '1/11/2021' AND '2/22/2021'
  `)
      })
    })

    describe('query success with invalid results', () => {
      let results: Change[]
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSuiteQLMock.mockResolvedValue([
          { appfolder: 'a : b', id: '1' },
          { appfolder: 'd : e', id: '2' },
          { appfolder: 'g' },
        ])
        results = await getChangedFolders(
          client,
          { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
        )
      })
      it('should return the changes', () => {
        expect(results).toEqual([
          { type: 'object', externalId: '/a/b', internalId: 1 },
          { type: 'object', externalId: '/d/e', internalId: 2 },
        ])
      })
    })
    it('return nothing when query fails', async () => {
      runSuiteQLMock.mockResolvedValue(undefined)
      expect(
        await getChangedFolders(client, { start: new Date(), end: new Date() })
      ).toHaveLength(0)
    })
  })
})
