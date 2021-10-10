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
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce(undefined)
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: '3', internalid: '3' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: '1', id: '1' },
    ])
    accountInstance = new InstanceElement('account', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }))
    accountInstance.value.internalId = '1'
    customTypeInstance = new InstanceElement('customRecordType', new ObjectType({ elemID: new ElemID(NETSUITE, 'customRecordType') }))
    customTypeInstance.value.scriptid = '1'
    customListInstance = new InstanceElement('customList', new ObjectType({ elemID: new ElemID(NETSUITE, 'customList') }))
    customListInstance.value.scriptid = '3'
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
  })
  describe('fetch', () => {
    it('should query information from api', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, 'SELECT scriptid, internalid FROM customRecordType')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, 'SELECT scriptid, internalid FROM customList')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(3, 'SELECT scriptid, id FROM customRecordType')
      expect(runSuiteQLMock).toHaveBeenCalledTimes(3)
    })
    it('should add internal ids to elements', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(accountInstance.value.internalId).toBe('1')
      expect(customTypeInstance.value.internalId).toBe('1')
      expect(customListInstance.value.internalId).toBe('3')
    })
  })
  describe('predeploy', () => {
    it('should add internal ids to elements', async () => {
      customListInstance.value.internalId = '3'
      customTypeInstance.value.internalId = '1'
      await filterCreator(filterOpts).preDeploy?.(
        elements.map(element => toChange({ after: element }))
      )
      expect(accountInstance.value.internalId).toBe('1')
      expect(customTypeInstance.value.internalId).toBe(undefined)
      expect(customListInstance.value.internalId).toBe(undefined)
    })
  })
})
