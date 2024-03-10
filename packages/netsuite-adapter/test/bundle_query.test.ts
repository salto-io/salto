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

import { BundlesQueryAndSupportedBundles, buildNetsuiteBundlesQuery } from '../src/config/bundle_query'

jest.mock('../src/autogen/bundle_components/bundle_components', () => ({
  BUNDLE_ID_TO_COMPONENTS: {
    39609: {
      'v4.0.0': new Set(['customlist_ns_ps_process_list']),
    },
    53195: {
      '1.11.5': new Set(['record1', 'customrecord_lsa']),
    },
  },
}))

describe('bundle_query', () => {
  const installedBundles = [
    {
      id: '58416',
    },
    {
      id: '53195',
      version: '1.11.5',
    },
    {
      id: '39609',
      version: 'v4.0.0',
    },
    {
      id: '369637',
      version: '3.05',
    },
  ]
  const bundlesToExclude = ['58416', '39609', '53195']

  it('should return no supported bundles if all are excluded', () => {
    const { bundlesToInclude } = buildNetsuiteBundlesQuery(installedBundles, ['All'])
    expect(bundlesToInclude).toHaveLength(0)
    expect(bundlesToInclude).toEqual([])
  })

  it('should return all supported bundles if none are excluded', () => {
    const { bundlesToInclude } = buildNetsuiteBundlesQuery(installedBundles, [])
    expect(bundlesToInclude).toHaveLength(4)
    expect(bundlesToInclude).toEqual(installedBundles)
  })
  describe('buildNetsuiteBundlesQuery', () => {
    let queryAndBundles: BundlesQueryAndSupportedBundles
    beforeEach(() => {
      queryAndBundles = buildNetsuiteBundlesQuery(installedBundles, bundlesToExclude)
    })

    describe('isTypeMatch', () => {
      it('should be true for all types', () => {
        const { query } = queryAndBundles
        expect(query.isTypeMatch('someType')).toBeTruthy()
      })
    })

    describe('isFileMatch', () => {
      it('should match files paths that contain bundle name', () => {
        const { query } = queryAndBundles
        expect(query.isFileMatch('./SuiteBundles/Bundle 58416/SomeFile.js')).toBeFalsy()
      })

      it('should not match files paths that do not contain bundle name', () => {
        const { query } = queryAndBundles
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
        const { query } = queryAndBundles
        expect(query.isObjectMatch(notInBundleObjectId)).toBeTruthy()
      })

      it('should not match objects that are in any bundle', () => {
        const { query } = queryAndBundles
        expect(query.isObjectMatch(inBundleObjectId)).toBeFalsy()
      })
    })

    describe('isCustomRecordMatch', () => {
      it('should not match custom record instance if its in a bundle', () => {
        const { query } = queryAndBundles
        expect(query.isCustomRecordMatch({ instanceId: 'customrecord_lsa', type: 'customrecordtype' })).toBeFalsy()
        expect(query.isCustomRecordMatch({ instanceId: 'record2', type: 'someRecordType' })).toBeTruthy()
      })
    })
  })
})
