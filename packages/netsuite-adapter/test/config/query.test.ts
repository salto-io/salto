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
import { andQuery, buildNetsuiteQuery, notQuery, convertToQueryParams } from '../../src/config/query'

describe('netsuite config query', () => {
  describe('buildNetsuiteQuery', () => {
    describe('valid query', () => {
      const query = buildNetsuiteQuery({
        types: [
          { name: 'addressForm', ids: ['aaa.*', 'bbb.*'] },
          { name: 'advancedpdftemplate', ids: ['ccc.*', 'ddd.*'] },
          { name: 'account', ids: ['.*'] },
          { name: 'account', ids: ['.*'] },
          { name: 'customrecordtype', ids: ['customrecord_cseg123'] },
        ],
        fileCabinet: ['eee.*', 'fff.*'],
        customRecords: [{ name: 'custrecord1' }, { name: 'custrecord2', ids: ['record1', 'record2'] }],
      })

      describe('isTypeMatch', () => {
        it('should match the received types', () => {
          expect(query.isTypeMatch('addressForm')).toBeTruthy()
          expect(query.isTypeMatch('advancedpdftemplate')).toBeTruthy()
        })

        it('should not match types the were not received', () => {
          expect(query.isTypeMatch('wrongType')).toBeFalsy()
        })

        it('should match customsegment when customrecordtype match', () => {
          expect(query.isTypeMatch('customrecordtype')).toBeTruthy()
          expect(query.isTypeMatch('customsegment')).toBeTruthy()
        })
      })

      describe('isFileMatch', () => {
        it('should match file paths that match the received regexes', () => {
          expect(query.isFileMatch('eeeaaa')).toBeTruthy()
          expect(query.isFileMatch('ffffqqqq')).toBeTruthy()
        })

        it('should not match file paths that do not match the received regexes', () => {
          expect(query.isFileMatch('aaaaa')).toBeFalsy()
        })
      })

      describe('isParentFolderMatch', () => {
        it('should match folder paths that match the received regexes', () => {
          expect(query.isParentFolderMatch('e')).toBeTruthy()
          expect(query.isParentFolderMatch('f')).toBeTruthy()
        })

        it('should not match folder paths that do not match the received regexes', () => {
          expect(query.isParentFolderMatch('ef')).toBeFalsy()
        })
      })

      describe('isObjectMatch', () => {
        it('should match objects that match the received regexes', () => {
          expect(query.isObjectMatch({ instanceId: 'aaaaaa', type: 'addressForm' })).toBeTruthy()
          expect(query.isObjectMatch({ instanceId: 'cccccc', type: 'advancedpdftemplate' })).toBeTruthy()
        })

        it('should not match objects that do not match the received regexes', () => {
          expect(query.isObjectMatch({ instanceId: 'aaaaaa', type: 'notExists' })).toBeFalsy()
          expect(query.isObjectMatch({ instanceId: 'cccccc', type: 'addressForm' })).toBeFalsy()
        })

        it('should match custom segment object with its custom record type object', () => {
          expect(query.isObjectMatch({ instanceId: 'customrecord_cseg123', type: 'customrecordtype' })).toBeTruthy()
          expect(query.isObjectMatch({ instanceId: 'cseg123', type: 'customsegment' })).toBeTruthy()

          expect(query.isObjectMatch({ instanceId: 'cseg124', type: 'customsegment' })).toBeFalsy()
        })
      })

      describe('areSomeFilesMatch', () => {
        it('when has files match should return true', () => {
          expect(query.areSomeFilesMatch()).toBeTruthy()
        })

        it('when does not` has files match should return false', () => {
          const q = buildNetsuiteQuery({
            types: [
              { name: 'addressForm', ids: ['aaa.*', 'bbb.*'] },
              { name: 'advancedpdftemplate', ids: ['ccc.*', 'ddd.*'] },
            ],
            fileCabinet: [],
          })
          expect(q.areSomeFilesMatch()).toBeFalsy()
        })
      })
      describe('areAllObjectsMatch', () => {
        it('when there is .* should return true', () => {
          expect(query.areAllObjectsMatch('account')).toBeTruthy()
          expect(query.areAllObjectsMatch('addressForm')).toBeFalsy()
        })
      })
      describe('validQueryWithOldFormat', () => {
        const queryOldFormat = buildNetsuiteQuery(
          convertToQueryParams({
            types: {
              addressForm: ['aaa.*', 'bbb.*'],
            },
            filePaths: ['eee.*', 'fff.*'],
            customRecords: {
              customrecord1: ['.*'],
            },
          }),
        )
        it('should match the received types from (old format)', () => {
          expect(queryOldFormat.isTypeMatch('addressForm')).toBeTruthy()
        })
        it('should not match types that were not received (old format)', () => {
          expect(queryOldFormat.isTypeMatch('wrongType')).toBeFalsy()
        })
        it('should match file paths that match the received regexes (old format)', () => {
          expect(queryOldFormat.isFileMatch('eeeaaa')).toBeTruthy()
          expect(queryOldFormat.isFileMatch('ffffqqqq')).toBeTruthy()
        })
        it('should match the received custom record type', () => {
          expect(queryOldFormat.isCustomRecordTypeMatch('customrecord1')).toBeTruthy()
          expect(queryOldFormat.isCustomRecordTypeMatch('customrecord2')).toBeFalsy()
        })
      })
      describe('isCustomRecordTypeMatch', () => {
        it('should match the received types', () => {
          expect(query.isCustomRecordTypeMatch('custrecord1')).toBeTruthy()
          expect(query.isCustomRecordTypeMatch('custrecord2')).toBeTruthy()
        })

        it('should not match types the were not received', () => {
          expect(query.isCustomRecordTypeMatch('custrecord3')).toBeFalsy()
        })
      })
      describe('areAllCustomRecordsMatch', () => {
        it('when there is .* should return true', () => {
          expect(query.areAllCustomRecordsMatch('custrecord1')).toBeTruthy()
          expect(query.areAllCustomRecordsMatch('custrecord2')).toBeFalsy()
        })
      })
      describe('isCustomRecordMatch', () => {
        it('should match objects that match the received regexes', () => {
          expect(query.isCustomRecordMatch({ instanceId: 'record1', type: 'custrecord1' })).toBeTruthy()
          expect(query.isCustomRecordMatch({ instanceId: 'record1', type: 'custrecord2' })).toBeTruthy()
        })

        it('should not match objects that do not match the received regexes', () => {
          expect(query.isCustomRecordMatch({ instanceId: 'record3', type: 'custrecord2' })).toBeFalsy()
          expect(query.isCustomRecordMatch({ instanceId: 'record1', type: 'custrecord3' })).toBeFalsy()
        })
      })
    })

    // For the migration between the PascalCase and the camelCase in the SuiteApp type names
    it('Support PascalCase SuiteApp names', () => {
      const query = buildNetsuiteQuery({
        types: [{ name: 'Subsidiary' }],
        fileCabinet: [],
      })
      expect(query.isTypeMatch('subsidiary')).toBeTruthy()
      expect(query.isObjectMatch({ type: 'subsidiary', instanceId: 'aaa' })).toBeTruthy()
    })

    it('support complex file cabinet regexes', () => {
      const query = andQuery(
        buildNetsuiteQuery({
          types: [],
          fileCabinet: ['^/SuiteScripts.*'],
        }),
        notQuery(
          buildNetsuiteQuery({
            types: [],
            fileCabinet: ['^/SuiteScripts/[^/]+\\.xml'],
          }),
        ),
      )
      expect(query.isFileMatch('/SuiteScripts/inner/test.xml')).toBeTruthy()
      expect(query.isFileMatch('/SuiteScripts/test.xml')).toBeFalsy()
    })
  })

  describe('andQuery', () => {
    const firstQuery = buildNetsuiteQuery({
      types: [
        { name: 'addressForm', ids: ['aaa.*'] },
        { name: 'advancedpdftemplate', ids: ['.*'] },
        { name: 'account', ids: ['.*'] },
      ],
      fileCabinet: ['bbb.*'],
      customRecords: [{ name: 'cust.*' }],
    })
    const secondQuery = buildNetsuiteQuery({
      types: [
        { name: 'addressForm', ids: ['.*ccc'] },
        { name: 'bankstatementparserplugin', ids: ['.*'] },
        { name: 'account', ids: ['.*'] },
      ],
      fileCabinet: ['.*ddd'],
      customRecords: [{ name: '.*record1' }, { name: '.*record2', ids: ['record1', 'record2'] }],
    })
    const bothQuery = andQuery(firstQuery, secondQuery)

    it('should match only types that match both queries', () => {
      expect(bothQuery.isTypeMatch('addressForm')).toBeTruthy()
      expect(bothQuery.isTypeMatch('advancedpdftemplate')).toBeFalsy()
      expect(bothQuery.isTypeMatch('bankstatementparserplugin')).toBeFalsy()
    })

    it('should match all objects if both queries match all objects', () => {
      expect(bothQuery.areAllObjectsMatch('account')).toBeTruthy()
      expect(bothQuery.areAllObjectsMatch('bankstatementparserplugin')).toBeFalsy()
    })

    it('should match only files that match both queries', () => {
      expect(bothQuery.isFileMatch('bbbdddd')).toBeTruthy()
      expect(bothQuery.isFileMatch('bbb')).toBeFalsy()
      expect(bothQuery.isFileMatch('ddd')).toBeFalsy()
    })

    it('should match only folders that match both queries', () => {
      expect(bothQuery.isParentFolderMatch('bb')).toBeTruthy()
      expect(bothQuery.isParentFolderMatch('bbd')).toBeFalsy()
      expect(bothQuery.isParentFolderMatch('ddd')).toBeFalsy()
    })

    it('should match only objects that match both queries', () => {
      expect(bothQuery.isObjectMatch({ instanceId: 'aaacccc', type: 'addressForm' })).toBeTruthy()
      expect(bothQuery.isObjectMatch({ instanceId: 'aaa', type: 'addressForm' })).toBeFalsy()
      expect(bothQuery.isObjectMatch({ instanceId: 'aaa', type: 'advancedpdftemplate' })).toBeFalsy()
    })

    it('should return whether both queries has some files match', () => {
      expect(bothQuery.areSomeFilesMatch()).toBeTruthy()
    })

    it('should match only custom record types that match both queries', () => {
      expect(bothQuery.isCustomRecordTypeMatch('custrecord1')).toBeTruthy()
      expect(bothQuery.isCustomRecordTypeMatch('custrecord2')).toBeTruthy()
      expect(bothQuery.isCustomRecordTypeMatch('custrecord3')).toBeFalsy()
    })

    it('should match all custom records if both queries match all objects', () => {
      expect(bothQuery.areAllCustomRecordsMatch('custrecord1')).toBeTruthy()
      expect(bothQuery.areAllCustomRecordsMatch('custrecord2')).toBeFalsy()
    })

    it('should match only custom records that match both queries', () => {
      expect(bothQuery.isCustomRecordMatch({ instanceId: 'record1', type: 'custrecord2' })).toBeTruthy()
      expect(bothQuery.isCustomRecordMatch({ instanceId: 'record3', type: 'custrecord2' })).toBeFalsy()
    })
  })

  describe('notQuery', () => {
    const query = buildNetsuiteQuery({
      types: [{ name: 'addressForm', ids: ['aaa.*'] }],
      fileCabinet: ['bbb.*'],
      customRecords: [{ name: 'custrecord1', ids: ['record1'] }],
    })
    const inverseQuery = notQuery(query)

    it('should match all types', () => {
      expect(inverseQuery.isTypeMatch('addressForm')).toBeTruthy()
      expect(inverseQuery.isTypeMatch('advancedpdftemplate')).toBeTruthy()
    })

    it('should match all objects if did not match any object before', () => {
      expect(inverseQuery.areAllObjectsMatch('account')).toBeTruthy()
      expect(inverseQuery.areAllObjectsMatch('addressForm')).toBeFalsy()
    })

    it('should match only files that do not match the original query', () => {
      expect(inverseQuery.isFileMatch('bbb')).toBeFalsy()
      expect(inverseQuery.isFileMatch('ddd')).toBeTruthy()
    })

    it('should match only objects that do not match the original query', () => {
      expect(inverseQuery.isObjectMatch({ instanceId: 'aaa', type: 'addressForm' })).toBeFalsy()
      expect(inverseQuery.isObjectMatch({ instanceId: 'aaa', type: 'advancedpdftemplate' })).toBeTruthy()
      expect(inverseQuery.isObjectMatch({ instanceId: 'bbb', type: 'addressForm' })).toBeTruthy()
    })

    it('should match all custom record types', () => {
      expect(inverseQuery.isCustomRecordTypeMatch('custrecord1')).toBeTruthy()
      expect(inverseQuery.isCustomRecordTypeMatch('custrecord2')).toBeTruthy()
    })

    it('should match all custom records if did not match any object before', () => {
      expect(inverseQuery.areAllCustomRecordsMatch('custrecord2')).toBeTruthy()
      expect(inverseQuery.areAllCustomRecordsMatch('custrecord1')).toBeFalsy()
    })

    it('should match only custom records that do not match the original query', () => {
      expect(inverseQuery.isCustomRecordMatch({ instanceId: 'record1', type: 'custrecord1' })).toBeFalsy()
      expect(inverseQuery.isCustomRecordMatch({ instanceId: 'record2', type: 'custrecord1' })).toBeTruthy()
      expect(inverseQuery.isCustomRecordMatch({ instanceId: 'record1', type: 'custrecord2' })).toBeTruthy()
    })
  })
})
