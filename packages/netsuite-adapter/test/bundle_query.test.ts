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

import { buildNetsuiteBundlesQuery } from '../src/config/bundle_query'

describe(('bundle_query'), () => {
  describe('buildNetsuiteBundlesQuery', () => {
    const query = buildNetsuiteBundlesQuery([
      {
        id: '58416',
        version: '2.00.0',
      },
      {
        id: '53195',
        version: '1.11.5',
      },
      {
        id: '39609',
        version: 'v4.0.0',
      },
    ])
    describe('isTypeMatch', () => {
      it('should be true for all types', () => {
        expect(query.isTypeMatch('someType')).toBeTruthy()
      })
    })

    describe('isFileMatch', () => {
      it('should match files paths that contain bundle name', () => {
        expect(query.isFileMatch('./SuiteBundles/Bundle 58416/SomeFile.js')).toBeFalsy()
      })

      it('should not match files paths that do not contain bundle name', () => {
        expect(query.isFileMatch('./SuiteScripts/ScriptFolder/someScript.js')).toBeTruthy()
      })
    })

    describe('isObjectMatch', () => {
      const notInBundleObjectId = {
        instanceId: 'notInBundleId',
        type: 'account',
      }
      const inBundleObjectId = {
        instanceId: 'customlist_ns_ps_process_list',
        type: 'customlist',
      }
      it('should match objects that are not in any bundle', () => {
        expect(query.isObjectMatch(notInBundleObjectId)).toBeTruthy()
      })

      it('should not match objects that are in any bundle', () => {
        expect(query.isObjectMatch(inBundleObjectId)).toBeFalsy()
      })
    })

    describe('isCustomeRecordTypeMatch', () => {
      it('should match custom record types that are not in any bundle', () => {
        expect(query.isCustomRecordTypeMatch('someCustomRecordType')).toBeTruthy()
      })

      it('should not match custom record types that are in a bundle', () => {
        expect(query.isCustomRecordTypeMatch('customrecord_lsa')).toBeFalsy()
      })
    })

    describe('isCustomRecordMatch', () => {
      it('should not match custom record instance if it or its type are in a bundle', () => {
        expect(query.isCustomRecordMatch({ instanceId: 'recrod1', type: 'customrecord_lsa' })).toBeFalsy()
        expect(query.isCustomRecordMatch({ instanceId: 'record1', type: 'someRecordType' })).toBeTruthy()
      })
    })
  })
})
