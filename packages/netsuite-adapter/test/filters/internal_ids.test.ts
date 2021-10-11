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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/internal_ids'
import { NETSUITE } from '../../src/constants'
import NetsuiteClient from '../../src/client/client'
import { FilterOpts } from '../../src/filter'
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../client/sdf_client'

describe('netsuite internal ids', () => {
  let filterOpts: FilterOpts
  let elements: InstanceElement[]
  let accountInstance: InstanceElement
  let customTypeInstance: InstanceElement
  let customListInstance: InstanceElement
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const SDFClient = mockSdfClient()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(SDFClient, suiteAppClient)
  beforeEach(() => {
    accountInstance = new InstanceElement('account', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }))
    customTypeInstance = new InstanceElement('customRecordType', new ObjectType({ elemID: new ElemID(NETSUITE, 'customRecordType') }))
    customListInstance = new InstanceElement('customList', new ObjectType({ elemID: new ElemID(NETSUITE, 'customList') }))
    accountInstance.value.internalId = '1'
    customTypeInstance.value.scriptid = 'scriptId2'
    customListInstance.value.scriptid = 'scriptId3'
    elements = [accountInstance, customTypeInstance, customListInstance]
    filterOpts = {
      client,
      elementsSourceIndex: { getIndexes: () => Promise.resolve({
        serviceIdsIndex: {},
        internalIdsIndex: {},
        customFieldsIndex: {},
      }) },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
    }
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce(undefined)
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: 'scriptId3', internalid: '3' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: 'scriptId2', id: '2' },
    ])
  })
  describe('fetch', () => {
    beforeEach(async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
    })
    it('should query information from api', () => {
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, 'SELECT scriptid, internalid FROM customRecordType ORDER BY internalid ASC')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, 'SELECT scriptid, internalid FROM customList ORDER BY internalid ASC')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(3, 'SELECT scriptid, id FROM customRecordType ORDER BY id ASC')
      expect(runSuiteQLMock).toHaveBeenCalledTimes(3)
    })
    it('should add internal ids to elements', () => {
      expect(accountInstance.value.internalId).toBe('1')
      expect(customTypeInstance.value.internalId).toBe('2')
      expect(customListInstance.value.internalId).toBe('3')
    })
  })
  describe('pre deploy', () => {
    it('should remove internal ids from elements', async () => {
      customTypeInstance.value.internalId = '2'
      customListInstance.value.internalId = '3'
      await filterCreator(filterOpts).preDeploy?.(
        elements.map(element => toChange({ after: element }))
      )
      expect(accountInstance.value.internalId).toBe('1')
      expect(customTypeInstance.value.internalId).toBe(undefined)
      expect(customListInstance.value.internalId).toBe(undefined)
    })
  })
  describe('deploy', () => {
    beforeEach(async () => {
      await filterCreator(filterOpts).onDeploy?.(
        [
          toChange({ before: accountInstance, after: accountInstance }),
          toChange({ after: customTypeInstance }),
          toChange({ after: customListInstance }),
        ],
        {
          appliedChanges: [],
          errors: [],
        },
      )
    })
    it('should query information from api', () => {
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, 'SELECT scriptid, internalid FROM customRecordType ORDER BY internalid ASC')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, 'SELECT scriptid, internalid FROM customList ORDER BY internalid ASC')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(3, 'SELECT scriptid, id FROM customRecordType ORDER BY id ASC')
      expect(runSuiteQLMock).toHaveBeenCalledTimes(3)
    })
    it('should add internal ids to new elements', () => {
      expect(customTypeInstance.value.internalId).toBe('2')
      expect(customListInstance.value.internalId).toBe('3')
    })
    it('should do nothing to modified elements', () => {
      expect(accountInstance.value.internalId).toBe('1')
    })
  })
})
